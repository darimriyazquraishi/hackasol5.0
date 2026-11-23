import os
import sys
from pathlib import Path

# Base Paths
PRJ_DIR = Path(__file__).resolve().parent.parent
HACKASOL_DIR = PRJ_DIR.parent
PROJECTS_DIR = PRJ_DIR / "projects"
TASKS_DIR = PRJ_DIR / "tasks"
PROMPTS_DIR = PRJ_DIR / "prompts"
CHATS_DIR = PRJ_DIR / "chats"
BLENDER_ENGINE_DIR = PRJ_DIR / "blender_engine"

# Ensure directories exist
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
TASKS_DIR.mkdir(parents=True, exist_ok=True)
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
CHATS_DIR.mkdir(parents=True, exist_ok=True)

# Ensure Hackasol root is in sys.path
if str(HACKASOL_DIR) not in sys.path:
    sys.path.insert(0, str(HACKASOL_DIR))
if str(PRJ_DIR) not in sys.path:
    sys.path.insert(0, str(PRJ_DIR))

# Ollama Settings
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.environ.get("DEFAULT_OLLAMA_MODEL", "qwen2.5:3b")

# Blender 3.6+ Detection (Windows, macOS, Linux)
DEFAULT_BLENDER_PATHS = [
    r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe",
    r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe",
    r"C:\Program Files\Blender Foundation\Blender 4.1\blender.exe",
    r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
    r"C:\Program Files\Blender Foundation\Blender\blender.exe",
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "/usr/bin/blender",
    "/usr/local/bin/blender",
    "/snap/bin/blender",
    os.environ.get("BLENDER_EXE", ""),
]

def find_blender_executable() -> str:
    """Finds installed Blender 3.6 executable."""
    env_path = os.environ.get("BLENDER_EXE")
    if env_path and os.path.isfile(env_path):
        return env_path
    
    for p in DEFAULT_BLENDER_PATHS:
        if p and os.path.isfile(p):
            return p
            
    # Try locating via shutil.which
    import shutil
    which_path = shutil.which("blender")
    if which_path and os.path.isfile(which_path):
        return which_path
        
    return ""

BLENDER_EXE = find_blender_executable()
