# PRJ Blender AI Skill — Portable Cross-Device Package

A self-contained, AI-model-agnostic Blender 3.6+ automation package extracted from `prj/`.
Any AI model (**Gemini, Claude, GPT/OpenAI, local Ollama, CLI agents, Cursor, Antigravity, Codex, or custom Python scripts**) can use this package to start Blender, generate & incrementally edit 3D models and P&ID technical diagrams, render EEVEE previews, inspect live scene state, open `.blend` files in Blender GUI, or launch the local web workstation.

---

## Requirements on a New Device

1. **Python 3.9+** (standard library only for the core skill — **zero `pip install` required** to run `blender_skill`, `execute-plan`, `generate`, `inspect`, `start-blender`, or `list-projects`).
2. **Blender 3.6+** (tested on Blender 3.6.23; also compatible with Blender 4.x/5.x EEVEE & Principled BSDF):
   - Download from https://www.blender.org/download/
   - Auto-detected on **Windows**, **macOS**, and **Linux** via standard install folders and `PATH`.
   - If Blender is installed in a custom folder, set the environment variable:
     - **Windows (PowerShell):** `$env:BLENDER_EXE = "C:\Path\To\blender.exe"`
     - **Windows (CMD):** `set BLENDER_EXE=C:\Path\To\blender.exe`
     - **macOS / Linux:** `export BLENDER_EXE="/path/to/blender"`
3. *(Optional)* **FastAPI Web Workstation (`start-server` / `prj/run.py`)**:
   - Only needed if you want the browser UI on `http://127.0.0.1:8000` (the React frontend is already pre-built in `prj/frontend/dist/` — **Node.js is NOT required**).
   - Install Python dependencies:
     ```bash
     pip install -r requirements.txt
     ```
4. *(Optional)* **Local Ollama** (only needed if you want `generate` to query a local LLM instead of passing structured JSON plans directly from Gemini/Claude/GPT or using `--no-ollama` blueprints):
   - Install from https://ollama.com and pull a model (e.g., `ollama pull qwen2.5:3b`).
   - Optionally override URL/model with `OLLAMA_BASE_URL` (default `http://localhost:11434`) and `DEFAULT_OLLAMA_MODEL` (default `qwen2.5:3b`).

---

## Quick Setup & Verification

### Windows
Double-click `setup.bat` or run in PowerShell/CMD:
```powershell
python .agents/skills/prj-blender/scripts/run.py status
```

### macOS / Linux
```bash
chmod +x setup.sh
./setup.sh
python3 .agents/skills/prj-blender/scripts/run.py status
```

A healthy `status` output reports `"blender": {"installed": true, ...}` with your detected Blender executable and version.

---

## Package Structure

```text
prj_blender_skill/
├── README.md                             # This cross-device setup & usage guide
├── requirements.txt                      # Optional pip deps for FastAPI web server only
├── setup.bat / setup.sh                  # Cross-platform environment check & optional pip setup
├── example_usage.py                      # Runnable smoke test & SDK integration demo
├── .agents/skills/prj-blender/           # Standard Agent Skill (Antigravity, Claude Code, Cursor, Codex, Gemini CLI)
│   ├── SKILL.md                          # Agent instructions & workflow
│   ├── scripts/run.py                    # Portable CLI wrapper
│   └── references/
│       ├── plan_schema.json              # Full JSON Schema for plans, actions, materials, modifiers, P&ID diagrams
│       └── tool_schemas.json             # Function-calling schemas for OpenAI, Ollama, Anthropic, Gemini
└── prj/
    ├── blender_skill.py                  # Core skill function `blender_skill(action, **kwargs)` + CLI + tool dispatcher
    ├── run.py / start.bat                # Optional FastAPI + React web server launcher
    ├── config/settings.py                # Cross-OS Blender & Ollama configuration
    ├── prompts/modeling_system_prompt.txt
    ├── backend/                          # Planner, Ollama client, FastAPI routes, task & chat managers
    ├── blender_engine/                   # Pure bpy runner, geometry, materials, modifiers, spatial, P&ID diagram, lighting, validation
    └── frontend/dist/                    # Pre-compiled React Web UI (no Node.js needed)
```

---

## Using With Any AI Model

### 1. AI Coding Agents (Antigravity, Claude Code, Cursor, Codex, Gemini CLI)
Copy `.agents/skills/prj-blender/` into your project's `.agents/skills/` (or open this unzipped folder directly as your workspace). The agent discovers `SKILL.md` automatically and runs `.agents/skills/prj-blender/scripts/run.py`.

If you copy `.agents/skills/prj-blender/` into a separate directory without `prj/` nearby, set:
```bash
export PRJ_BLENDER_DIR="/absolute/path/to/prj_blender_skill/prj"
```

### 2. Python Function Call (Direct)
```python
from prj.blender_skill import blender_skill

# Check environment
print(blender_skill("status"))

# Create a 3D scene and render EEVEE preview.png
res = blender_skill("execute_plan", project_id="desk_01", plan={
    "project_name": "desk_01",
    "clear_scene": True,
    "actions": [
        {
            "action": "CREATE_OBJECT",
            "object_data": {
                "name": "Table_Top",
                "geometry_type": "BEVEL_BOX",
                "dimensions": [1.6, 0.8, 0.08],
                "position": [0.0, 0.0, 0.75],
                "material": {"name": "Oak", "color": [0.55, 0.35, 0.18, 1.0], "roughness": 0.45}
            }
        }
    ]
})

# Incrementally add an object ON_TOP of Table_Top (loads existing model.blend automatically)
res2 = blender_skill("execute_plan", project_id="desk_01", plan={
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

# Launch Blender GUI with the generated .blend file
blender_skill("start_blender", project_id="desk_01")
```

### 3. LLM Function / Tool Calling (OpenAI, Anthropic, Gemini, Ollama)
```python
from prj.blender_skill import get_tool_schema, handle_tool_call

# Get provider-formatted tool schema: "openai" | "anthropic" | "gemini" | "ollama" | "generic"
tool_definition = get_tool_schema("openai")

# Dispatch any model's tool call payload directly:
result = handle_tool_call(model_tool_call)
```

### 4. CLI Commands
```bash
# Environment check
python prj/blender_skill.py status

# Execute a JSON plan file
python prj/blender_skill.py execute-plan --project-id my_model --plan-file plan.json

# Natural-language generation without Ollama (built-in spatial & P&ID blueprints)
python prj/blender_skill.py generate --prompt "Create an industrial water pumping system P&ID diagram" --no-ollama

# Inspect live scene objects, bounding boxes, groups, and materials
python prj/blender_skill.py inspect --project-id my_model

# Open project visibly in Blender GUI
python prj/blender_skill.py start-blender --project-id my_model

# Start optional FastAPI + React web workstation (requires `pip install -r requirements.txt`)
python prj/blender_skill.py start-server --port 8000 --open-browser

# Print tool-calling schema JSON for a provider
python prj/blender_skill.py tool-schema --format gemini
```

---

## Troubleshooting on a New Device

- **Blender not detected**: Install Blender 3.6+ and either add it to `PATH` or set `BLENDER_EXE` to the full path of `blender.exe` / `blender`.
- **Headless preview render fails on headless Linux servers without a display**: Pass `--no-render` (CLI) or `render_preview=False` (Python) to skip EEVEE OpenGL rendering, or run under `xvfb-run`.
- **Web server fails to start (`No module named fastapi` / `uvicorn` / `psutil`)**: Run `pip install -r requirements.txt` first. The core `blender_skill` CLI and Python API do not need these packages.
