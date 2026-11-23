"""
Asynchronous Task Manager & Blender Process Orchestrator.
Manages queues, subprocess execution, real-time logging, and WebSocket event dispatching.
"""
import os
import sys
import json
import time
import asyncio
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Set, Optional
from fastapi import WebSocket

from config.settings import (
    PRJ_DIR,
    PROJECTS_DIR,
    TASKS_DIR,
    BLENDER_EXE,
    BLENDER_ENGINE_DIR
)
from backend.planner.engine import ModelingPlannerEngine
from backend.chat_manager.manager import chat_manager


class ConnectionManager:
    """Manages active WebSockets for task progress streaming."""
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, task_id: str, websocket: WebSocket):
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = set()
        self.active_connections[task_id].add(websocket)

    def disconnect(self, task_id: str, websocket: WebSocket):
        if task_id in self.active_connections:
            self.active_connections[task_id].discard(websocket)
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]

    async def broadcast(self, task_id: str, message: dict):
        if task_id in self.active_connections:
            dead_sockets = []
            for connection in self.active_connections[task_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_sockets.append(connection)
            for ds in dead_sockets:
                self.disconnect(task_id, ds)


class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.conn_manager = ConnectionManager()
        self.planner = ModelingPlannerEngine()
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.active_processes: Dict[str, asyncio.subprocess.Process] = {}

    async def broadcast_update(self, task_id: str, status: str, progress: int, log_message: str = None, extra: dict = None):
        """Updates task state and notifies WebSocket subscribers."""
        task = self.tasks.get(task_id)
        if not task:
            return

        task["status"] = status
        task["progress"] = progress
        if log_message:
            timestamp = datetime.now().strftime("%H:%M:%S")
            entry = f"[{timestamp}] {log_message}"
            task["logs"].append(entry)
            print(f"[Task {task_id}] {entry}")

        payload = {
            "task_id": task_id,
            "status": status,
            "progress": progress,
            "log": log_message,
            "timestamp": time.time()
        }
        if extra:
            payload.update(extra)
            task.update(extra)

        await self.conn_manager.broadcast(task_id, payload)

    async def create_and_run_task(
        self,
        prompt: str,
        model: str = "qwen2.5:3b",
        project_id: str = None,
        is_modification: bool = False,
        chat_id: str = None
    ) -> str:
        """Creates a modeling task and starts asynchronous background execution."""
        task_id = f"task_{int(time.time() * 1000)}"
        if not project_id:
            project_id = f"prj_{int(time.time() * 1000)}"

        project_dir = PROJECTS_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        task_record = {
            "task_id": task_id,
            "project_id": project_id,
            "chat_id": chat_id,
            "prompt": prompt,
            "model": model,
            "is_modification": is_modification,
            "status": "QUEUED",
            "progress": 5,
            "logs": [],
            "created_at": datetime.now().isoformat(),
            "blend_path": str(project_dir / "model.blend"),
            "render_path": str(project_dir / "preview.png"),
            "plan": None,
            "error": None
        }
        self.tasks[task_id] = task_record

        # Launch background coroutine
        coro = asyncio.create_task(self._execute_workflow(task_id))
        self.active_tasks[task_id] = coro
        return task_id

    async def _execute_workflow(self, task_id: str):
        task = self.tasks[task_id]
        project_id = task["project_id"]
        project_dir = PROJECTS_DIR / project_id
        prompt = task["prompt"]
        model = task["model"]
        is_mod = task["is_modification"]

        await self.broadcast_update(task_id, "INITIALIZING", 10, f"Task initiated for prompt: '{prompt}'")

        # 1. Check Blender Executable
        blender_exe = BLENDER_EXE
        if not blender_exe or not os.path.isfile(blender_exe):
            err = f"Blender 3.6 executable not found at: {blender_exe}"
            await self.broadcast_update(task_id, "FAILED", 100, err, {"error": err})
            return

        await self.broadcast_update(task_id, "PLANNING", 20, f"Consulting AI model '{model}' for 3D modeling plan...")

        # 2. Planning Phase with Scene Awareness
        existing_blend = str(project_dir / "model.blend") if (project_dir / "model.blend").is_file() else None
        scene_state = None
        if existing_blend:
            scene_state_path = project_dir / "scene_state.json"
            if scene_state_path.is_file():
                try:
                    with open(scene_state_path, "r", encoding="utf-8") as f:
                        scene_state = json.load(f)
                except Exception:
                    pass
            if not scene_state and (project_dir / "metadata.json").is_file():
                try:
                    with open(project_dir / "metadata.json", "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        scene_state = meta.get("scene_state")
                except Exception:
                    pass

        plan, source = self.planner.plan(
            prompt,
            model=model,
            scene_state=scene_state,
            is_modification=existing_blend is not None
        )
        task["plan"] = plan
        action_count = len(plan.get("actions", []))
        comp_count = len(plan.get("components", []))
        summary_msg = f"Generated {action_count} scene actions" if action_count > 0 else f"Generated plan with {comp_count} components"
        await self.broadcast_update(
            task_id,
            "PLAN_VALIDATED",
            40,
            f"{summary_msg} via {source}.",
            {"plan": plan}
        )

        # 3. Write Task File for Blender Runner
        task_file = TASKS_DIR / f"{task_id}.json"
        status_file = TASKS_DIR / f"{task_id}_status.json"
        blend_file = task["blend_path"]
        render_file = task["render_path"]

        task_payload = {
            "task_id": task_id,
            "project_id": project_id,
            "prompt": prompt,
            "plan": plan,
            "existing_blend": existing_blend
        }
        with open(task_file, "w", encoding="utf-8") as f:
            json.dump(task_payload, f, indent=2)

        # 4. Blender Automation Execution
        await self.broadcast_update(task_id, "GENERATING_BLENDER", 50, f"Launching Blender 3.6 engine...")

        runner_script = BLENDER_ENGINE_DIR / "runner.py"
        blender_cmd = [
            blender_exe,
            "-b", # Headless execution for deterministic background processing & rendering
            "-P", str(runner_script),
            "--",
            "--task-file", str(task_file),
            "--save-blend", str(blend_file),
            "--render-path", str(render_file),
            "--status-file", str(status_file)
        ]

        try:
            # Run Blender process asynchronously
            proc = await asyncio.create_subprocess_exec(
                *blender_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            self.active_processes[task_id] = proc

            await self.broadcast_update(task_id, "BUILDING_GEOMETRY", 65, "Procedurally creating meshes, materials and modifiers...")

            stdout_bytes, stderr_bytes = await proc.communicate()
            stdout_str = stdout_bytes.decode("utf-8", errors="replace")
            stderr_str = stderr_bytes.decode("utf-8", errors="replace")

            # Check status file
            if os.path.isfile(status_file):
                with open(status_file, "r", encoding="utf-8") as f:
                    status_info = json.load(f)

                if status_info.get("success"):
                    await self.broadcast_update(task_id, "RENDERING", 85, "Generated 3D geometry and rendered preview snapshot.")
                    
                    # Save project metadata
                    scene_state_data = status_info.get("scene_state")
                    metadata = {
                        "project_id": project_id,
                        "prompt": prompt,
                        "model": model,
                        "created_at": task["created_at"],
                        "updated_at": datetime.now().isoformat(),
                        "blend_path": str(blend_file),
                        "render_path": str(render_file) if os.path.isfile(render_file) else None,
                        "plan": plan,
                        "scene_state": scene_state_data,
                        "components": status_info.get("components_created", []),
                        "stats": status_info
                    }
                    with open(project_dir / "metadata.json", "w", encoding="utf-8") as f:
                        json.dump(metadata, f, indent=2)

                    if task.get("chat_id"):
                        chat_msg = "Scene updated successfully."
                        if plan.get("actions"):
                            act_names = [a.get("action", "") for a in plan["actions"]]
                            chat_msg = f"Operations applied: {', '.join(act_names)}."
                        elif plan.get("components"):
                            chat_msg = f"Created {len(plan['components'])} components."

                        chat_manager.add_message(
                            task["chat_id"],
                            "system",
                            chat_msg,
                            project_id=project_id
                        )

                    await self.broadcast_update(
                        task_id,
                        "COMPLETED",
                        100,
                        f"Model generated successfully! Saved to {Path(blend_file).name}",
                        {
                            "project_id": project_id,
                            "chat_id": task.get("chat_id"),
                            "blend_url": f"/api/projects/{project_id}/blend",
                            "preview_url": f"/api/projects/{project_id}/preview",
                            "completed": True
                        }
                    )
                    return
                else:
                    err_msg = status_info.get("error", "Unknown Blender execution error")
                    if task.get("chat_id"):
                        chat_manager.add_message(task["chat_id"], "system", f"Failed: {err_msg}", project_id=project_id)
                    await self.broadcast_update(task_id, "FAILED", 100, f"Blender execution error: {err_msg}", {"error": err_msg})
                    return

            if proc.returncode != 0:
                err_msg = f"Blender exited with code {proc.returncode}: {stderr_str[:300]}"
                await self.broadcast_update(task_id, "FAILED", 100, err_msg, {"error": err_msg})
            else:
                await self.broadcast_update(task_id, "FAILED", 100, "No status file produced by Blender", {"error": "Missing status"})

        except asyncio.CancelledError:
            print(f"[TaskManager] Task {task_id} received cancellation request.")
            proc = self.active_processes.get(task_id)
            if proc and proc.returncode is None:
                try:
                    proc.kill()
                except Exception:
                    pass
            await self.broadcast_update(
                task_id,
                "CANCELLED",
                0,
                "Generation stopped by user.",
                {"cancelled": True, "error": "Generation stopped by user"}
            )
            if task.get("chat_id"):
                chat_manager.add_message(
                    task["chat_id"],
                    "system",
                    "Generation stopped by user.",
                    project_id=project_id
                )
            raise
        except Exception as e:
            err_msg = f"Task execution exception: {str(e)}"
            await self.broadcast_update(task_id, "FAILED", 100, err_msg, {"error": err_msg})
        finally:
            self.active_processes.pop(task_id, None)
            self.active_tasks.pop(task_id, None)

    async def stop_task(self, task_id: Optional[str] = None) -> bool:
        """
        Immediately stops and cancels an in-progress generation task and terminates Blender if running.
        If task_id is None, stops any currently active task.
        """
        targets = []
        if task_id:
            targets = [task_id]
        else:
            targets = list(self.active_tasks.keys())

        if not targets and task_id:
            task = self.tasks.get(task_id)
            if task and task.get("status") not in ("COMPLETED", "FAILED", "CANCELLED"):
                task["status"] = "CANCELLED"
                await self.broadcast_update(task_id, "CANCELLED", 0, "Generation stopped by user.", {"cancelled": True})
                return True
            return False

        stopped_any = False
        for tid in targets:
            proc = self.active_processes.pop(tid, None)
            if proc and proc.returncode is None:
                try:
                    proc.kill()
                    print(f"[TaskManager] Terminated subprocess for task {tid}")
                except Exception as e:
                    print(f"[TaskManager] Error terminating process for task {tid}: {e}")

            task_coro = self.active_tasks.pop(tid, None)
            if task_coro and not task_coro.done():
                task_coro.cancel()
                stopped_any = True

            t_record = self.tasks.get(tid)
            if t_record:
                t_record["status"] = "CANCELLED"
                await self.broadcast_update(
                    tid,
                    "CANCELLED",
                    0,
                    "Generation stopped by user.",
                    {"cancelled": True, "error": "Generation stopped by user"}
                )
                if t_record.get("chat_id"):
                    chat_manager.add_message(
                        t_record["chat_id"],
                        "system",
                        "Generation stopped by user.",
                        project_id=t_record.get("project_id")
                    )

        return stopped_any or len(targets) > 0

    def open_project_in_blender(self, project_id: str) -> bool:
        """Launches Blender GUI with the project's .blend file."""
        blend_file = PROJECTS_DIR / project_id / "model.blend"
        if not blend_file.is_file():
            return False

        blender_exe = BLENDER_EXE
        if not blender_exe or not os.path.isfile(blender_exe):
            return False

        # Open visibly in GUI mode (detached subprocess)
        subprocess.Popen([blender_exe, str(blend_file)], shell=False)
        return True


# Global Singleton Instance
task_manager = TaskManager()
