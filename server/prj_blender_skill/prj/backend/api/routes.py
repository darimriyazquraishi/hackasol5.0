"""
FastAPI Routes for Blender AI.
Endpoints for Ollama status, model generation, task streaming, and project management.
"""
import os
import json
import psutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config.settings import PROJECTS_DIR, BLENDER_EXE
from backend.ollama.client import OllamaClient
from backend.task_manager.manager import task_manager
from backend.chat_manager.manager import chat_manager

router = APIRouter()
ollama_client = OllamaClient()


class CreateChatRequest(BaseModel):
    title: Optional[str] = "New Conversation"


class UpdateChatTitleRequest(BaseModel):
    title: str


class GenerateRequest(BaseModel):
    prompt: str
    model: Optional[str] = "qwen2.5:3b"
    project_id: Optional[str] = None
    is_modification: Optional[bool] = False
    chat_id: Optional[str] = None


@router.get("/chats")
def list_chats():
    """Lists all saved chat conversations."""
    return {"chats": chat_manager.list_chats()}


@router.post("/chats")
def create_new_chat(req: CreateChatRequest = None):
    """Creates a new isolated chat conversation."""
    title = req.title if req and req.title else "New Conversation"
    new_chat = chat_manager.create_chat(title=title)
    return new_chat


@router.get("/chats/{chat_id}")
def get_chat_conversation(chat_id: str):
    """Retrieves all messages and details for a specific chat."""
    chat = chat_manager.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.put("/chats/{chat_id}/title")
def update_chat_title(chat_id: str, req: UpdateChatTitleRequest):
    """Updates the title of a chat."""
    success = chat_manager.update_chat_title(chat_id, req.title)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"success": True, "chat_id": chat_id, "title": req.title}


@router.delete("/chats/{chat_id}")
def delete_chat_conversation(chat_id: str):
    """Permanently deletes a chat conversation and its messages."""
    success = chat_manager.delete_chat(chat_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found or already deleted")
    return {"success": True, "chat_id": chat_id}


@router.get("/status")
def get_system_status():
    """Detects Ollama, Blender 3.6, and hardware state."""
    ollama_ok = ollama_client.check_connection()
    models = ollama_client.get_installed_models() if ollama_ok else []
    blender_ok = bool(BLENDER_EXE and os.path.isfile(BLENDER_EXE))

    cpu_cores = os.cpu_count() or 4
    try:
        ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 1)
    except Exception:
        ram_gb = 16.0

    return {
        "ollama": {
            "connected": ollama_ok,
            "models_count": len(models),
            "models": [m["name"] for m in models]
        },
        "blender": {
            "installed": blender_ok,
            "path": BLENDER_EXE,
            "version": "3.6+" if blender_ok else "Not Detected"
        },
        "system": {
            "cpu_cores": cpu_cores,
            "ram_gb": ram_gb
        }
    }


@router.get("/ollama/models")
def list_ollama_models():
    """Returns all installed models in the local Ollama instance."""
    models = ollama_client.get_installed_models()
    return {"models": models}


@router.post("/generate")
async def start_generation(req: GenerateRequest):
    """Submits a 3D modeling request for asynchronous generation."""
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    prompt = req.prompt.strip()

    # Ensure a valid chat session
    chat_id = req.chat_id
    chat = chat_manager.get_chat(chat_id) if chat_id else None
    if not chat:
        chat = chat_manager.create_chat(title="New Conversation")
        chat_id = chat["chat_id"]

    # If the conversation is linked to an existing project, continue on that project
    project_id = req.project_id or chat.get("project_id")
    is_modification = bool(req.is_modification) or bool(
        project_id and (PROJECTS_DIR / project_id / "model.blend").is_file()
    )

    # Record user message in the isolated chat thread
    chat_manager.add_message(chat_id, "user", prompt, project_id=project_id)

    task_id = await task_manager.create_and_run_task(
        prompt=prompt,
        model=req.model or "qwen2.5:3b",
        project_id=project_id,
        is_modification=is_modification,
        chat_id=chat_id
    )

    task_info = task_manager.tasks[task_id]
    return {
        "task_id": task_id,
        "project_id": task_info["project_id"],
        "chat_id": chat_id,
        "status": "QUEUED"
    }


@router.post("/tasks/{task_id}/stop")
async def stop_specific_task(task_id: str):
    """Stops/cancels an active modeling generation task."""
    success = await task_manager.stop_task(task_id)
    return {"success": success, "task_id": task_id, "status": "CANCELLED"}


@router.post("/generate/stop")
async def stop_current_generation():
    """Stops the currently running modeling generation task."""
    success = await task_manager.stop_task(None)
    return {"success": success, "status": "CANCELLED"}


@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    """Retrieves current state and logs for a task."""
    task = task_manager.tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/projects")
def list_projects():
    """Lists all saved projects with metadata and preview status."""
    projects = []
    if not PROJECTS_DIR.exists():
        return {"projects": []}

    for p_dir in PROJECTS_DIR.iterdir():
        if p_dir.is_dir():
            meta_file = p_dir / "metadata.json"
            if meta_file.is_file():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    has_blend = (p_dir / "model.blend").is_file()
                    has_preview = (p_dir / "preview.png").is_file()
                    projects.append({
                        "project_id": p_dir.name,
                        "prompt": data.get("prompt", "Untitled"),
                        "model": data.get("model", "Unknown"),
                        "created_at": data.get("created_at", ""),
                        "components": data.get("components", []),
                        "has_blend": has_blend,
                        "has_preview": has_preview,
                        "preview_url": f"/api/projects/{p_dir.name}/preview" if has_preview else None,
                        "blend_url": f"/api/projects/{p_dir.name}/blend" if has_blend else None
                    })
                except Exception:
                    pass

    # Sort latest first
    projects.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"projects": projects}


@router.get("/projects/{project_id}")
def get_project_details(project_id: str):
    """Retrieves metadata and modeling plan for a project."""
    meta_file = PROJECTS_DIR / project_id / "metadata.json"
    if not meta_file.is_file():
        raise HTTPException(status_code=404, detail="Project not found")
    with open(meta_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


@router.get("/projects/{project_id}/preview")
def get_project_preview(project_id: str):
    """Serves the rendered preview image."""
    img_file = PROJECTS_DIR / project_id / "preview.png"
    if not img_file.is_file():
        raise HTTPException(status_code=404, detail="Preview image not found")
    return FileResponse(str(img_file), media_type="image/png")


@router.get("/projects/{project_id}/blend")
def download_blend_file(project_id: str):
    """Downloads the generated Blender .blend file."""
    blend_file = PROJECTS_DIR / project_id / "model.blend"
    if not blend_file.is_file():
        raise HTTPException(status_code=404, detail="Blend file not found")
    return FileResponse(
        str(blend_file),
        filename=f"{project_id}.blend",
        media_type="application/x-blender"
    )


@router.post("/projects/{project_id}/open")
def open_in_blender_gui(project_id: str):
    """Opens Blender 3.6 GUI with the project model."""
    success = task_manager.open_project_in_blender(project_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not open Blender with project file")
    return {"success": True, "message": "Blender launched"}


@router.websocket("/ws/tasks/{task_id}")
async def task_websocket_endpoint(websocket: WebSocket, task_id: str):
    """Real-time WebSocket connection for live task progress and logs."""
    await task_manager.conn_manager.connect(task_id, websocket)
    try:
        # Send current task state immediately
        task = task_manager.tasks.get(task_id)
        if task:
            await websocket.send_json({
                "task_id": task_id,
                "status": task["status"],
                "progress": task["progress"],
                "logs": task["logs"]
            })
        while True:
            # Keep alive and handle client pings
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        task_manager.conn_manager.disconnect(task_id, websocket)
    except Exception:
        task_manager.conn_manager.disconnect(task_id, websocket)
