#!/usr/bin/env python3
"""
Universal AI-Model-Agnostic Blender Skill Interface for `prj`.

Allows ANY AI model (Gemini, Claude, GPT/OpenAI, local Ollama, CLI agents, or Python scripts)
to start, control, inspect, render, and open Blender 3.6+ using the exact same `prj`
blender_engine pipeline, project layout, spatial reasoning, PBR materials, modifiers,
P&ID diagram engine, and incremental scene state system.

Usage as a Python skill function:
    from prj.blender_skill import blender_skill

    # 1. Check Blender & environment
    res = blender_skill("status")

    # 2. Execute a structured 3D modeling / action plan directly (model-agnostic)
    res = blender_skill("execute_plan", plan={
        "project_name": "desk_lamp",
        "clear_scene": True,
        "actions": [
            {
                "action": "CREATE_OBJECT",
                "object_data": {
                    "name": "Table_Top",
                    "geometry_type": "BEVEL_BOX",
                    "dimensions": [1.6, 0.8, 0.06],
                    "position": [0.0, 0.0, 0.75],
                    "material": {"name": "Oak", "color": [0.55, 0.35, 0.18, 1.0], "roughness": 0.45}
                }
            }
        ]
    })

    # 3. Incrementally modify that project (loads model.blend & scene_state.json automatically)
    res = blender_skill("execute_plan", project_id=res["project_id"], plan={
        "clear_scene": False,
        "actions": [
            {
                "action": "CREATE_OBJECT",
                "relative_to": {"target": "Table_Top", "relation": "ON_TOP", "gap": 0.0},
                "object_data": {
                    "name": "Red_Sphere",
                    "geometry_type": "PRIMITIVE",
                    "primitive": "SPHERE",
                    "dimensions": [0.25, 0.25, 0.25],
                    "material": {"name": "Red", "color": [0.9, 0.1, 0.1, 1.0], "roughness": 0.2}
                }
            }
        ]
    })

    # 4. Natural-language prompt using prj's planner (Ollama or offline blueprints)
    res = blender_skill("generate", prompt="Create a modern chair", use_ollama=False)

    # 5. Open the result visibly in Blender GUI
    res = blender_skill("start_blender", project_id=res["project_id"])

Usage as a CLI (for any terminal-capable AI agent):
    python prj/blender_skill.py status
    python prj/blender_skill.py execute-plan --plan-file plan.json --project-id my_scene
    python prj/blender_skill.py generate --prompt "Create a red cube" --no-ollama
    python prj/blender_skill.py inspect --project-id my_scene
    python prj/blender_skill.py start-blender --project-id my_scene
    python prj/blender_skill.py start-server --port 8000
    python prj/blender_skill.py list-projects
    python prj/blender_skill.py tool-schema --format openai
"""
import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# ---------------------------------------------------------------------------
# Path bootstrap — works whether imported as `prj.blender_skill`, `blender_skill`,
# or executed directly as a script from any working directory.
# ---------------------------------------------------------------------------
PRJ_DIR = Path(__file__).resolve().parent
HACKASOL_DIR = PRJ_DIR.parent
PROJECTS_DIR = PRJ_DIR / "projects"
TASKS_DIR = PRJ_DIR / "tasks"
BLENDER_ENGINE_DIR = PRJ_DIR / "blender_engine"
RUNNER_SCRIPT = BLENDER_ENGINE_DIR / "runner.py"

for _p in (str(PRJ_DIR), str(HACKASOL_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
TASKS_DIR.mkdir(parents=True, exist_ok=True)

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.environ.get("DEFAULT_OLLAMA_MODEL", "qwen2.5:3b")

VALID_ACTIONS = {
    "CREATE_OBJECT",
    "MODIFY_OBJECT",
    "MOVE_OBJECT",
    "ROTATE_OBJECT",
    "SCALE_OBJECT",
    "CHANGE_MATERIAL",
    "DELETE_OBJECT",
    "GROUP_OBJECTS",
}


# ---------------------------------------------------------------------------
# Blender & Environment Detection
# ---------------------------------------------------------------------------
def find_blender_executable() -> str:
    """Dynamically detects Blender 3.6+ across Windows, macOS, and Linux."""
    env_path = os.environ.get("BLENDER_EXE", "").strip()
    if env_path and os.path.isfile(env_path):
        return env_path

    # Reuse prj's own configured detector first
    try:
        from config.settings import find_blender_executable as _prj_find
        found = _prj_find()
        if found and os.path.isfile(found):
            return found
    except Exception:
        pass

    candidates = [
        r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 4.1\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender\blender.exe",
        "/Applications/Blender.app/Contents/MacOS/Blender",
        "/usr/bin/blender",
        "/usr/local/bin/blender",
        "/snap/bin/blender",
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path

    # Scan Windows Blender Foundation folder if present
    bf_dir = Path(r"C:\Program Files\Blender Foundation")
    if bf_dir.is_dir():
        for sub in sorted(bf_dir.iterdir(), reverse=True):
            exe = sub / "blender.exe"
            if exe.is_file():
                return str(exe)

    which_path = shutil.which("blender")
    if which_path and os.path.isfile(which_path):
        return which_path

    return ""


def _get_blender_version(blender_exe: str) -> str:
    if not blender_exe or not os.path.isfile(blender_exe):
        return "Not Detected"
    try:
        out = subprocess.check_output(
            [blender_exe, "--version"],
            stderr=subprocess.STDOUT,
            timeout=10,
            text=True,
        )
        first_line = out.strip().splitlines()[0] if out.strip() else "Detected"
        return first_line
    except Exception:
        return "3.6+"


def _check_http_json(url: str, timeout: float = 2.0) -> Optional[Dict[str, Any]]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BlenderSkill"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    return None


def check_environment(server_url: str = "http://127.0.0.1:8000") -> Dict[str, Any]:
    """Inspects Blender, Ollama, prj FastAPI server, and workspace paths."""
    blender_exe = find_blender_executable()
    blender_ok = bool(blender_exe and os.path.isfile(blender_exe))

    ollama_tags = _check_http_json(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=2.0)
    ollama_models = [m.get("name") for m in (ollama_tags or {}).get("models", []) if m.get("name")]

    server_status = _check_http_json(f"{server_url.rstrip('/')}/api/status", timeout=1.5)

    return {
        "success": True,
        "blender": {
            "installed": blender_ok,
            "executable": blender_exe,
            "version": _get_blender_version(blender_exe) if blender_ok else "Not Detected",
        },
        "ollama": {
            "connected": ollama_tags is not None,
            "base_url": OLLAMA_BASE_URL,
            "models": ollama_models,
        },
        "prj_server": {
            "running": server_status is not None,
            "url": server_url,
        },
        "paths": {
            "prj_dir": str(PRJ_DIR),
            "runner_script": str(RUNNER_SCRIPT),
            "projects_dir": str(PROJECTS_DIR),
            "tasks_dir": str(TASKS_DIR),
        },
        "system": {
            "os": platform.system(),
            "cpu_cores": os.cpu_count() or 4,
            "python": sys.version.split()[0],
        },
    }


# ---------------------------------------------------------------------------
# Plan Normalization
# ---------------------------------------------------------------------------
def _normalize_plan(plan: Union[Dict[str, Any], List[Dict[str, Any]], str], has_existing: bool) -> Dict[str, Any]:
    """
    Accepts flexible plan shapes from any AI model and normalizes them into the
    exact schema expected by `prj/blender_engine/runner.py`.
    """
    if isinstance(plan, str):
        plan = json.loads(plan)

    # Allow passing a raw list of actions or components directly
    if isinstance(plan, list):
        if plan and isinstance(plan[0], dict) and "action" in plan[0]:
            plan = {"project_name": "ai_scene", "clear_scene": not has_existing, "actions": plan}
        else:
            plan = {"project_name": "ai_scene", "clear_scene": not has_existing, "components": plan}

    if not isinstance(plan, dict):
        raise ValueError("`plan` must be a JSON object, a list of actions/components, or a JSON string.")

    # Allow passing a single action object directly
    if "action" in plan and "actions" not in plan:
        plan = {"project_name": "ai_scene", "clear_scene": not has_existing, "actions": [plan]}

    normalized = dict(plan)
    normalized.setdefault("project_name", "ai_scene")
    if "clear_scene" not in normalized:
        normalized["clear_scene"] = not has_existing

    actions = normalized.get("actions") or []
    components = normalized.get("components") or []

    if actions:
        if not isinstance(actions, list):
            raise ValueError("`plan.actions` must be a list.")
        for idx, act in enumerate(actions):
            if not isinstance(act, dict):
                raise ValueError(f"Action at index {idx} must be an object.")
            act_type = str(act.get("action", "")).upper().strip()
            if act_type not in VALID_ACTIONS:
                raise ValueError(
                    f"Unsupported action '{act_type}' at index {idx}. "
                    f"Valid actions: {sorted(VALID_ACTIONS)}"
                )
            act["action"] = act_type
        normalized["actions"] = actions

    if components:
        if not isinstance(components, list):
            raise ValueError("`plan.components` must be a list.")
        normalized["components"] = components

    return normalized


# ---------------------------------------------------------------------------
# Core Execution Functions (Mirrors prj/backend/task_manager/manager.py)
# ---------------------------------------------------------------------------
def execute_plan(
    plan: Union[Dict[str, Any], List[Dict[str, Any]], str],
    project_id: Optional[str] = None,
    existing_blend: Optional[str] = None,
    save_blend: Optional[str] = None,
    render_preview: bool = True,
    render_path: Optional[str] = None,
    open_gui: bool = False,
    prompt: str = "",
    model_name: str = "external_ai",
    timeout: int = 300,
) -> Dict[str, Any]:
    """
    Executes a structured JSON modeling plan or discrete scene actions inside Blender 3.6+
    using `prj/blender_engine/runner.py`.

    Works with ANY AI model without requiring Ollama or the web UI to be running.
    Automatically saves `model.blend`, `scene_state.json`, `preview.png` (optional),
    and `metadata.json` in `prj/projects/<project_id>/`.
    """
    blender_exe = find_blender_executable()
    if not blender_exe or not os.path.isfile(blender_exe):
        return {
            "success": False,
            "error": "Blender executable not found. Install Blender 3.6+ or set BLENDER_EXE.",
        }

    if not RUNNER_SCRIPT.is_file():
        return {"success": False, "error": f"Runner script not found: {RUNNER_SCRIPT}"}

    now_ms = int(time.time() * 1000)
    task_id = f"task_{now_ms}"
    project_id = project_id or f"prj_{now_ms}"
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    blend_file = Path(save_blend) if save_blend else (project_dir / "model.blend")
    preview_file = Path(render_path) if render_path else (project_dir / "preview.png")

    # Determine whether we are incrementally modifying an existing .blend file
    resolved_existing: Optional[str] = None
    if existing_blend and os.path.isfile(existing_blend):
        resolved_existing = str(Path(existing_blend).resolve())
    elif blend_file.is_file():
        resolved_existing = str(blend_file.resolve())

    try:
        normalized_plan = _normalize_plan(plan, has_existing=resolved_existing is not None)
    except Exception as exc:
        return {"success": False, "error": f"Invalid plan: {exc}"}

    # If the caller explicitly requested clear_scene=True, start clean instead of opening existing_blend
    if normalized_plan.get("clear_scene") is True:
        resolved_existing = None

    task_file = TASKS_DIR / f"{task_id}.json"
    status_file = TASKS_DIR / f"{task_id}_status.json"

    task_payload = {
        "task_id": task_id,
        "project_id": project_id,
        "prompt": prompt or normalized_plan.get("project_name", "AI Modeling Task"),
        "plan": normalized_plan,
        "existing_blend": resolved_existing,
    }
    with open(task_file, "w", encoding="utf-8") as f:
        json.dump(task_payload, f, indent=2)

    blender_cmd = [
        blender_exe,
        "-b",
        "-P", str(RUNNER_SCRIPT),
        "--",
        "--task-file", str(task_file),
        "--save-blend", str(blend_file),
        "--status-file", str(status_file),
    ]
    if render_preview:
        blender_cmd.extend(["--render-path", str(preview_file)])

    try:
        proc = subprocess.run(
            blender_cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout if timeout and timeout > 0 else None,
        )
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "task_id": task_id,
            "project_id": project_id,
            "error": f"Blender execution timed out after {timeout}s.",
        }
    except Exception as exc:
        return {
            "success": False,
            "task_id": task_id,
            "project_id": project_id,
            "error": f"Failed to launch Blender: {exc}",
        }

    if not status_file.is_file():
        return {
            "success": False,
            "task_id": task_id,
            "project_id": project_id,
            "returncode": proc.returncode,
            "error": "Blender did not produce a status file.",
            "stderr": (proc.stderr or "")[-1200:],
            "stdout": (proc.stdout or "")[-1200:],
        }

    with open(status_file, "r", encoding="utf-8") as f:
        status_info = json.load(f)

    if not status_info.get("success"):
        return {
            "success": False,
            "task_id": task_id,
            "project_id": project_id,
            "error": status_info.get("error", "Unknown Blender execution error"),
            "traceback": status_info.get("traceback"),
            "stderr": (proc.stderr or "")[-800:],
        }

    # Persist metadata.json in the exact format used by prj's FastAPI UI
    scene_state = status_info.get("scene_state")
    created_at = datetime.now().isoformat()
    meta_file = project_dir / "metadata.json"
    if meta_file.is_file():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                created_at = json.load(f).get("created_at", created_at)
        except Exception:
            pass

    metadata = {
        "project_id": project_id,
        "prompt": prompt or normalized_plan.get("project_name", "AI Modeling Task"),
        "model": model_name,
        "created_at": created_at,
        "updated_at": datetime.now().isoformat(),
        "blend_path": str(blend_file.resolve()),
        "render_path": str(preview_file.resolve()) if (render_preview and preview_file.is_file()) else None,
        "plan": normalized_plan,
        "scene_state": scene_state,
        "components": status_info.get("components_created", []),
        "stats": status_info,
    }
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    gui_opened = False
    if open_gui and blend_file.is_file():
        gui_res = start_blender(blend_path=str(blend_file))
        gui_opened = bool(gui_res.get("success"))

    scene_state_path = blend_file.parent / "scene_state.json"

    return {
        "success": True,
        "task_id": task_id,
        "project_id": project_id,
        "blend_path": str(blend_file.resolve()),
        "render_path": str(preview_file.resolve()) if (render_preview and preview_file.is_file()) else None,
        "scene_state_path": str(scene_state_path.resolve()) if scene_state_path.is_file() else None,
        "total_objects": status_info.get("total_objects", 0),
        "actions_executed": status_info.get("actions_executed", []),
        "components_created": status_info.get("components_created", []),
        "scene_state": scene_state,
        "gui_opened": gui_opened,
    }


def run_prompt(
    prompt: str,
    project_id: Optional[str] = None,
    model: Optional[str] = None,
    use_ollama: bool = True,
    render_preview: bool = True,
    open_gui: bool = False,
    timeout: int = 300,
    is_modification: bool = False,
) -> Dict[str, Any]:
    """
    Runs a natural-language prompt through `prj`'s ModelingPlannerEngine
    (Ollama when enabled & running, otherwise prj's built-in spatial action
    interpreter & parametric/P&ID blueprint engine) and executes it in Blender.
    """
    if not prompt or not prompt.strip():
        return {"success": False, "error": "Prompt cannot be empty."}

    prompt = prompt.strip()
    project_id = project_id or f"prj_{int(time.time() * 1000)}"
    project_dir = PROJECTS_DIR / project_id
    existing_blend = project_dir / "model.blend"
    has_existing = bool(is_modification) and existing_blend.is_file()

    scene_state = None
    if has_existing:
        inspected = inspect_scene(project_id=project_id)
        if inspected.get("success"):
            scene_state = inspected.get("scene_state")

    try:
        from backend.planner.engine import ModelingPlannerEngine
    except Exception as exc:
        return {"success": False, "error": f"Could not load prj ModelingPlannerEngine: {exc}"}

    planner = ModelingPlannerEngine()
    chosen_model = model or DEFAULT_OLLAMA_MODEL

    if use_ollama and planner.ollama.check_connection():
        plan, source = planner.plan(
            prompt=prompt,
            model=chosen_model,
            scene_state=scene_state,
            is_modification=has_existing,
        )
    else:
        # Check if diagram first
        if planner._is_diagram_request(prompt):
            plan, source = planner._generate_diagram_blueprint(prompt), "isa_5_1_diagram_engine"
        else:
            # Directly use prj's deterministic action interpreter & parametric/P&ID blueprints
            existing_objects = (scene_state or {}).get("objects", []) if isinstance(scene_state, dict) else []
            plan = None
            source = "prj_blueprint"
            if has_existing:
                plan = planner._interpret_scene_operations(prompt, existing_objects)
                if plan:
                    source = "prj_scene_action"
            if not plan:
                plan = planner._generate_parametric_blueprint(prompt, is_incremental=has_existing)
                source = "prj_blueprint"

    result = execute_plan(
        plan=plan,
        project_id=project_id,
        existing_blend=str(existing_blend) if has_existing else None,
        render_preview=render_preview,
        open_gui=open_gui,
        prompt=prompt,
        model_name=source,
        timeout=timeout,
    )
    result["planner_source"] = source
    result["plan"] = plan
    return result


def inspect_scene(
    project_id: Optional[str] = None,
    blend_path: Optional[str] = None,
    refresh: bool = False,
) -> Dict[str, Any]:
    """
    Returns live scene state (objects, bounding boxes, positions, rotations, scales,
    groups, parents, materials) for a project or `.blend` file.
    """
    target_blend: Optional[Path] = None
    state_file: Optional[Path] = None

    if project_id:
        p_dir = PROJECTS_DIR / project_id
        state_file = p_dir / "scene_state.json"
        candidate_blend = p_dir / "model.blend"
        if candidate_blend.is_file():
            target_blend = candidate_blend

    if blend_path:
        target_blend = Path(blend_path)
        if not state_file:
            state_file = target_blend.parent / "scene_state.json"

    if not refresh and state_file and state_file.is_file():
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
            return {
                "success": True,
                "source": "cached_scene_state",
                "project_id": project_id,
                "blend_path": str(target_blend.resolve()) if target_blend and target_blend.is_file() else None,
                "scene_state": state,
            }
        except Exception:
            pass

    if not target_blend or not target_blend.is_file():
        return {
            "success": False,
            "error": "No existing project or .blend file found to inspect.",
        }

    # Live-inspect the .blend file inside Blender using prj's export_scene_state()
    blender_exe = find_blender_executable()
    if not blender_exe or not os.path.isfile(blender_exe):
        return {"success": False, "error": "Blender executable not found for live inspection."}

    inline_py = (
        "import sys, json; "
        f"sys.path.insert(0, {str(PRJ_DIR)!r}); "
        "from blender_engine.scene.action_executor import export_scene_state; "
        "print('__SCENE_STATE_JSON__' + json.dumps(export_scene_state()))"
    )
    try:
        proc = subprocess.run(
            [blender_exe, "-b", str(target_blend), "--python-expr", inline_py],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        marker = "__SCENE_STATE_JSON__"
        for line in (proc.stdout or "").splitlines():
            if marker in line:
                raw_json = line.split(marker, 1)[1].strip()
                state = json.loads(raw_json)
                if state_file:
                    state_file.parent.mkdir(parents=True, exist_ok=True)
                    with open(state_file, "w", encoding="utf-8") as f:
                        json.dump(state, f, indent=2)
                return {
                    "success": True,
                    "source": "live_blender_inspect",
                    "project_id": project_id,
                    "blend_path": str(target_blend.resolve()),
                    "scene_state": state,
                }
        return {
            "success": False,
            "error": "Failed to extract scene state from Blender.",
            "stderr": (proc.stderr or "")[-800:],
        }
    except Exception as exc:
        return {"success": False, "error": f"Scene inspection error: {exc}"}


def start_blender(
    project_id: Optional[str] = None,
    blend_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Launches the interactive Blender GUI (detached) either empty or loaded with
    a project's `model.blend` or an arbitrary `.blend` file.
    """
    blender_exe = find_blender_executable()
    if not blender_exe or not os.path.isfile(blender_exe):
        return {
            "success": False,
            "error": "Blender executable not found. Install Blender 3.6+ or set BLENDER_EXE.",
        }

    cmd = [blender_exe]
    resolved_blend: Optional[str] = None

    if blend_path:
        if not os.path.isfile(blend_path):
            return {"success": False, "error": f"Blend file not found: {blend_path}"}
        resolved_blend = str(Path(blend_path).resolve())
        cmd.append(resolved_blend)
    elif project_id:
        candidate = PROJECTS_DIR / project_id / "model.blend"
        if not candidate.is_file():
            return {"success": False, "error": f"Project blend file not found: {candidate}"}
        resolved_blend = str(candidate.resolve())
        cmd.append(resolved_blend)

    try:
        popen_kwargs: Dict[str, Any] = {
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
        }
        if platform.system() == "Windows":
            popen_kwargs["creationflags"] = (
                subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            popen_kwargs["start_new_session"] = True

        proc = subprocess.Popen(cmd, **popen_kwargs)
        return {
            "success": True,
            "pid": proc.pid,
            "executable": blender_exe,
            "blend_path": resolved_blend,
            "message": f"Blender GUI launched{f' with {Path(resolved_blend).name}' if resolved_blend else ''}.",
        }
    except Exception as exc:
        return {"success": False, "error": f"Failed to start Blender GUI: {exc}"}


def start_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    open_browser: bool = False,
    wait_seconds: float = 10.0,
) -> Dict[str, Any]:
    """
    Starts the `prj` FastAPI + React web server (equivalent to `python prj/run.py`)
    in a detached background process if it is not already running.
    """
    base_url = f"http://{host}:{port}"
    existing = _check_http_json(f"{base_url}/api/status", timeout=1.5)
    if existing is not None:
        return {
            "success": True,
            "already_running": True,
            "url": base_url,
            "status": existing,
        }

    cmd = [
        sys.executable,
        "-m", "uvicorn",
        "backend.main:app",
        "--host", host,
        "--port", str(port),
    ]
    try:
        popen_kwargs: Dict[str, Any] = {
            "cwd": str(PRJ_DIR),
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
        }
        if platform.system() == "Windows":
            popen_kwargs["creationflags"] = (
                subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            popen_kwargs["start_new_session"] = True

        proc = subprocess.Popen(cmd, **popen_kwargs)
    except Exception as exc:
        return {"success": False, "error": f"Failed to start prj server: {exc}"}

    deadline = time.time() + max(1.0, wait_seconds)
    while time.time() < deadline:
        status = _check_http_json(f"{base_url}/api/status", timeout=1.0)
        if status is not None:
            if open_browser:
                try:
                    import webbrowser
                    webbrowser.open(base_url)
                except Exception:
                    pass
            return {
                "success": True,
                "already_running": False,
                "pid": proc.pid,
                "url": base_url,
                "status": status,
            }
        time.sleep(0.4)

    return {
        "success": False,
        "pid": proc.pid,
        "url": base_url,
        "error": f"Server process started (PID {proc.pid}) but did not respond on {base_url}/api/status within {wait_seconds}s.",
    }


def list_projects(limit: int = 20) -> Dict[str, Any]:
    """Lists generated Blender projects stored in `prj/projects/`."""
    projects: List[Dict[str, Any]] = []
    if PROJECTS_DIR.is_dir():
        for p_dir in PROJECTS_DIR.iterdir():
            if not p_dir.is_dir():
                continue
            blend_file = p_dir / "model.blend"
            preview_file = p_dir / "preview.png"
            meta_file = p_dir / "metadata.json"
            meta: Dict[str, Any] = {}
            if meta_file.is_file():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                except Exception:
                    pass
            if not blend_file.is_file() and not meta:
                continue
            scene_state = meta.get("scene_state") or {}
            projects.append({
                "project_id": p_dir.name,
                "prompt": meta.get("prompt", "Untitled"),
                "model": meta.get("model", "Unknown"),
                "created_at": meta.get("created_at", ""),
                "updated_at": meta.get("updated_at", meta.get("created_at", "")),
                "object_count": scene_state.get("object_count", len(meta.get("components", []))),
                "blend_path": str(blend_file.resolve()) if blend_file.is_file() else None,
                "render_path": str(preview_file.resolve()) if preview_file.is_file() else None,
            })

    projects.sort(key=lambda item: item.get("updated_at") or item.get("created_at") or "", reverse=True)
    return {
        "success": True,
        "count": len(projects),
        "projects": projects[:limit],
    }


# ---------------------------------------------------------------------------
# Universal Single-Entry-Point Skill Function
# ---------------------------------------------------------------------------
def blender_skill(action: str, **kwargs: Any) -> Dict[str, Any]:
    """
    Unified skill function that ANY AI model can call to start and operate Blender
    via `prj`'s engine.

    Supported `action` values:
      - "status"        : Detect Blender, Ollama, prj server, and paths.
      - "execute_plan"  : Run a structured JSON plan (`actions` and/or `components`) in Blender.
      - "generate"      : Convert natural-language `prompt` into a plan and run it in Blender.
      - "inspect"       : Return live/cached `scene_state` (objects, bounds, groups, materials).
      - "start_blender" : Launch Blender GUI (optionally with `project_id` or `blend_path`).
      - "start_server"  : Start the `prj` FastAPI + React workstation server.
      - "list_projects" : List saved projects in `prj/projects/`.
    """
    act = (action or "").strip().lower().replace("-", "_")

    try:
        if act in ("status", "check", "check_environment", "detect"):
            return check_environment(server_url=kwargs.get("server_url", "http://127.0.0.1:8000"))

        if act in ("execute_plan", "plan", "run_plan", "exec"):
            plan = kwargs.get("plan")
            if plan is None:
                # Convenience: allow passing actions or components directly at top level
                if "actions" in kwargs or "components" in kwargs:
                    plan = {
                        k: kwargs[k]
                        for k in ("project_name", "clear_scene", "actions", "components", "lighting", "camera", "is_diagram", "category")
                        if k in kwargs
                    }
                else:
                    return {"success": False, "error": "Missing required argument `plan` (or `actions`/`components`)."}
            return execute_plan(
                plan=plan,
                project_id=kwargs.get("project_id"),
                existing_blend=kwargs.get("existing_blend"),
                save_blend=kwargs.get("save_blend"),
                render_preview=bool(kwargs.get("render_preview", True)),
                render_path=kwargs.get("render_path"),
                open_gui=bool(kwargs.get("open_gui", False)),
                prompt=kwargs.get("prompt", ""),
                model_name=kwargs.get("model_name", "external_ai"),
                timeout=int(kwargs.get("timeout", 300)),
            )

        if act in ("generate", "prompt", "run_prompt"):
            return run_prompt(
                prompt=kwargs.get("prompt", ""),
                project_id=kwargs.get("project_id"),
                model=kwargs.get("model"),
                use_ollama=bool(kwargs.get("use_ollama", True)),
                render_preview=bool(kwargs.get("render_preview", True)),
                open_gui=bool(kwargs.get("open_gui", False)),
                timeout=int(kwargs.get("timeout", 300)),
                is_modification=bool(kwargs.get("is_modification", False)),
            )

        if act in ("inspect", "inspect_scene", "scene_state"):
            return inspect_scene(
                project_id=kwargs.get("project_id"),
                blend_path=kwargs.get("blend_path"),
                refresh=bool(kwargs.get("refresh", False)),
            )

        if act in ("start_blender", "open", "open_blender", "gui"):
            return start_blender(
                project_id=kwargs.get("project_id"),
                blend_path=kwargs.get("blend_path"),
            )

        if act in ("start_server", "server", "start_ui"):
            return start_server(
                host=kwargs.get("host", "127.0.0.1"),
                port=int(kwargs.get("port", 8000)),
                open_browser=bool(kwargs.get("open_browser", False)),
                wait_seconds=float(kwargs.get("wait_seconds", 10.0)),
            )

        if act in ("list_projects", "projects", "list"):
            return list_projects(limit=int(kwargs.get("limit", 20)))

        return {
            "success": False,
            "error": (
                f"Unknown action '{action}'. Supported actions: "
                "status, execute_plan, generate, inspect, start_blender, start_server, list_projects."
            ),
        }
    except Exception as exc:
        return {"success": False, "action": act, "error": str(exc)}


# ---------------------------------------------------------------------------
# Multi-Provider LLM Tool / Function-Calling Schema & Dispatcher
# ---------------------------------------------------------------------------
_PARAMETERS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": [
                "status",
                "execute_plan",
                "generate",
                "inspect",
                "start_blender",
                "start_server",
                "list_projects",
            ],
            "description": (
                "Operation to perform: "
                "'status' checks Blender/Ollama/server; "
                "'execute_plan' runs a structured JSON 3D modeling plan (actions/components) in Blender and renders preview.png; "
                "'generate' converts a natural-language prompt via prj's planner and runs Blender; "
                "'inspect' returns current scene_state (objects, bounding boxes, groups, materials); "
                "'start_blender' launches Blender GUI (empty or with a project/.blend); "
                "'start_server' launches prj's FastAPI + React web app; "
                "'list_projects' lists saved projects."
            ),
        },
        "project_id": {
            "type": "string",
            "description": "Project folder ID inside prj/projects/. Pass an existing project_id to incrementally edit, inspect, or open it.",
        },
        "plan": {
            "type": "object",
            "description": (
                "Structured Blender plan for 'execute_plan'. Contains optional project_name, clear_scene (bool), "
                "is_diagram (bool), actions (list of CREATE_OBJECT, MOVE_OBJECT, ROTATE_OBJECT, SCALE_OBJECT, "
                "CHANGE_MATERIAL, DELETE_OBJECT, GROUP_OBJECTS, MODIFY_OBJECT), components (list), lighting, and camera."
            ),
        },
        "prompt": {
            "type": "string",
            "description": "Natural-language 3D modeling or editing prompt (required for 'generate', optional label for 'execute_plan').",
        },
        "blend_path": {
            "type": "string",
            "description": "Optional explicit path to a .blend file (for 'inspect' or 'start_blender').",
        },
        "existing_blend": {
            "type": "string",
            "description": "Optional path to an existing .blend file to modify incrementally during 'execute_plan'.",
        },
        "save_blend": {
            "type": "string",
            "description": "Optional custom output .blend file path for 'execute_plan'.",
        },
        "render_preview": {
            "type": "boolean",
            "description": "Whether to render a 960x640 EEVEE preview.png (default: true).",
        },
        "open_gui": {
            "type": "boolean",
            "description": "If true, opens the resulting .blend file visibly in Blender GUI after execution.",
        },
        "is_modification": {
            "type": "boolean",
            "description": "Whether this prompt modifies an existing scene (default: false). When false, a fresh scene is generated.",
        },
        "use_ollama": {
            "type": "boolean",
            "description": "For 'generate': whether to query local Ollama first before falling back to prj blueprints (default: true).",
        },
        "model": {
            "type": "string",
            "description": "For 'generate': Ollama model name (e.g. 'qwen2.5:3b').",
        },
        "refresh": {
            "type": "boolean",
            "description": "For 'inspect': force live inspection inside Blender instead of reading cached scene_state.json.",
        },
        "port": {
            "type": "integer",
            "description": "For 'start_server': HTTP port (default: 8000).",
        },
        "open_browser": {
            "type": "boolean",
            "description": "For 'start_server': open the web UI in the default browser.",
        },
    },
    "required": ["action"],
}

_TOOL_DESCRIPTION = (
    "Start and operate Blender 3.6+ via the local prj Blender engine. "
    "Supports checking Blender availability, creating and incrementally editing 3D models "
    "and P&ID technical diagrams via structured JSON actions (CREATE_OBJECT, MOVE_OBJECT, "
    "ROTATE_OBJECT, SCALE_OBJECT, CHANGE_MATERIAL, DELETE_OBJECT, GROUP_OBJECTS) with "
    "bounding-box spatial relations (ON_TOP, UNDER, BEHIND, IN_FRONT_OF, BESIDE, LEFT_OF, "
    "RIGHT_OF, INSIDE), PBR materials, modifiers, studio lighting, EEVEE preview rendering, "
    "scene inspection, launching Blender GUI, and starting the prj web server."
)


def get_tool_schema(fmt: str = "openai") -> Dict[str, Any]:
    """
    Returns the function-calling tool definition for `blender_skill` formatted for:
      - "openai" / "ollama": {"type": "function", "function": {...}}
      - "anthropic": {"name": ..., "description": ..., "input_schema": {...}}
      - "gemini": {"name": ..., "description": ..., "parameters": {...}}
      - "generic": {"name": ..., "description": ..., "parameters": {...}}
    """
    f = (fmt or "openai").lower().strip()
    if f in ("openai", "ollama"):
        return {
            "type": "function",
            "function": {
                "name": "blender_skill",
                "description": _TOOL_DESCRIPTION,
                "parameters": _PARAMETERS_SCHEMA,
            },
        }
    if f == "anthropic":
        return {
            "name": "blender_skill",
            "description": _TOOL_DESCRIPTION,
            "input_schema": _PARAMETERS_SCHEMA,
        }
    # gemini / generic
    return {
        "name": "blender_skill",
        "description": _TOOL_DESCRIPTION,
        "parameters": _PARAMETERS_SCHEMA,
    }


def handle_tool_call(
    tool_call: Union[Dict[str, Any], str],
    arguments: Optional[Union[Dict[str, Any], str]] = None,
) -> Dict[str, Any]:
    """
    Universal tool-call dispatcher compatible with OpenAI, Anthropic, Gemini, and Ollama
    function-calling payloads.
    """
    args: Dict[str, Any] = {}
    if isinstance(tool_call, dict):
        # OpenAI / Ollama style: {"function": {"name": ..., "arguments": ...}}
        if "function" in tool_call and isinstance(tool_call["function"], dict):
            raw_args = tool_call["function"].get("arguments", {})
        # Anthropic style: {"name": ..., "input": {...}}
        elif "input" in tool_call:
            raw_args = tool_call.get("input", {})
        # Gemini / generic style: {"name": ..., "args": {...}} or {"arguments": {...}}
        elif "args" in tool_call:
            raw_args = tool_call.get("args", {})
        elif "arguments" in tool_call:
            raw_args = tool_call.get("arguments", {})
        else:
            raw_args = tool_call
        args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args or {})
    else:
        if isinstance(arguments, str):
            args = json.loads(arguments)
        elif isinstance(arguments, dict):
            args = dict(arguments)

    action = args.pop("action", None)
    if not action:
        return {"success": False, "error": "Tool call missing required 'action' field."}
    return blender_skill(action, **args)


# ---------------------------------------------------------------------------
# CLI Entry Point (for any shell-capable AI agent)
# ---------------------------------------------------------------------------
def _build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="blender_skill",
        description="Universal AI-model-agnostic CLI to start and operate Blender via prj.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # status
    p_status = sub.add_parser("status", help="Check Blender, Ollama, and prj server status.")
    p_status.add_argument("--server-url", default="http://127.0.0.1:8000")

    # execute-plan
    p_exec = sub.add_parser("execute-plan", help="Execute a structured JSON plan in Blender.")
    src = p_exec.add_mutually_exclusive_group(required=True)
    src.add_argument("--plan-file", help="Path to JSON file containing the plan.")
    src.add_argument("--plan-json", help="Inline JSON string containing the plan.")
    p_exec.add_argument("--project-id", default=None)
    p_exec.add_argument("--existing-blend", default=None)
    p_exec.add_argument("--save-blend", default=None)
    p_exec.add_argument("--render-path", default=None)
    p_exec.add_argument("--no-render", action="store_true", help="Skip preview.png rendering.")
    p_exec.add_argument("--open-gui", action="store_true", help="Open Blender GUI after execution.")
    p_exec.add_argument("--prompt", default="")
    p_exec.add_argument("--model-name", default="external_ai")
    p_exec.add_argument("--timeout", type=int, default=300)

    # generate
    p_gen = sub.add_parser("generate", help="Run a natural-language prompt via prj's planner + Blender.")
    p_gen.add_argument("--prompt", required=True)
    p_gen.add_argument("--project-id", default=None)
    p_gen.add_argument("--model", default=None, help="Ollama model name (optional).")
    p_gen.add_argument("--is-modification", action="store_true", help="Incrementally modify the existing scene instead of creating fresh.")
    p_gen.add_argument("--no-ollama", action="store_true", help="Use prj blueprints/action interpreter only.")
    p_gen.add_argument("--no-render", action="store_true", help="Skip preview.png rendering.")
    p_gen.add_argument("--open-gui", action="store_true", help="Open Blender GUI after execution.")
    p_gen.add_argument("--timeout", type=int, default=300)

    # inspect
    p_insp = sub.add_parser("inspect", help="Inspect scene objects, bounds, groups, and materials.")
    p_insp.add_argument("--project-id", default=None)
    p_insp.add_argument("--blend-path", default=None)
    p_insp.add_argument("--refresh", action="store_true", help="Force live Blender inspection.")

    # start-blender
    p_gui = sub.add_parser("start-blender", help="Launch Blender GUI (empty or with a project/.blend).")
    p_gui.add_argument("--project-id", default=None)
    p_gui.add_argument("--blend-path", default=None)

    # start-server
    p_srv = sub.add_parser("start-server", help="Start the prj FastAPI + React web app.")
    p_srv.add_argument("--host", default="127.0.0.1")
    p_srv.add_argument("--port", type=int, default=8000)
    p_srv.add_argument("--open-browser", action="store_true")
    p_srv.add_argument("--wait-seconds", type=float, default=10.0)

    # list-projects
    p_list = sub.add_parser("list-projects", help="List saved projects in prj/projects/.")
    p_list.add_argument("--limit", type=int, default=20)

    # tool-schema
    p_schema = sub.add_parser("tool-schema", help="Print LLM function-calling schema JSON.")
    p_schema.add_argument("--format", choices=["openai", "anthropic", "gemini", "ollama", "generic"], default="openai")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_cli_parser()
    args = parser.parse_args(argv)

    if args.command == "status":
        result = check_environment(server_url=args.server_url)
    elif args.command == "execute-plan":
        if args.plan_file:
            with open(args.plan_file, "r", encoding="utf-8") as f:
                plan_data = json.load(f)
        else:
            plan_data = json.loads(args.plan_json)
        result = execute_plan(
            plan=plan_data,
            project_id=args.project_id,
            existing_blend=args.existing_blend,
            save_blend=args.save_blend,
            render_preview=not args.no_render,
            render_path=args.render_path,
            open_gui=args.open_gui,
            prompt=args.prompt,
            model_name=args.model_name,
            timeout=args.timeout,
        )
    elif args.command == "generate":
        result = run_prompt(
            prompt=args.prompt,
            project_id=args.project_id,
            model=args.model,
            use_ollama=not args.no_ollama,
            render_preview=not args.no_render,
            open_gui=args.open_gui,
            timeout=args.timeout,
            is_modification=args.is_modification,
        )
    elif args.command == "inspect":
        result = inspect_scene(
            project_id=args.project_id,
            blend_path=args.blend_path,
            refresh=args.refresh,
        )
    elif args.command == "start-blender":
        result = start_blender(project_id=args.project_id, blend_path=args.blend_path)
    elif args.command == "start-server":
        result = start_server(
            host=args.host,
            port=args.port,
            open_browser=args.open_browser,
            wait_seconds=args.wait_seconds,
        )
    elif args.command == "list-projects":
        result = list_projects(limit=args.limit)
    elif args.command == "tool-schema":
        result = get_tool_schema(args.format)
    else:
        result = {"success": False, "error": f"Unknown command: {args.command}"}

    print(json.dumps(result, indent=2))
    return 0 if result.get("success", True) else 1


if __name__ == "__main__":
    sys.exit(main())
