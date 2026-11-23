"""
FastAPI Server Entry Point for Blender AI.
Run with: uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Add prj to sys.path
PRJ_DIR = Path(__file__).resolve().parent.parent
if str(PRJ_DIR) not in sys.path:
    sys.path.insert(0, str(PRJ_DIR))

from backend.api.routes import router

app = FastAPI(
    title="Blender AI Assistant",
    description="Local AI-powered 3D model generator connecting Ollama and Blender 3.6",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")
app.include_router(router, prefix="") # for direct /ws routing

# Mount frontend dist if exists
frontend_dist = PRJ_DIR / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
