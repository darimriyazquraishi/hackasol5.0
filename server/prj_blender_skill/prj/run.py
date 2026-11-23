"""
Single-command launcher for Blender AI Local Application.
Launches the FastAPI backend and serves the React frontend at http://127.0.0.1:8000.
"""
import os
import sys
import webbrowser
import subprocess
from pathlib import Path

# Paths
PRJ_DIR = Path(__file__).resolve().parent
HACKASOL_DIR = PRJ_DIR.parent

if str(PRJ_DIR) not in sys.path:
    sys.path.insert(0, str(PRJ_DIR))
if str(HACKASOL_DIR) not in sys.path:
    sys.path.insert(0, str(HACKASOL_DIR))

from config.settings import BLENDER_EXE, OLLAMA_BASE_URL
from backend.ollama.client import OllamaClient


def check_prerequisites():
    print("==================================================")
    print("       Blender AI - Local 3D Model Generator      ")
    print("==================================================")
    
    # 1. Blender Check
    if BLENDER_EXE and os.path.isfile(BLENDER_EXE):
        print(f"[OK] Blender 3.6 detected: {BLENDER_EXE}")
    else:
        print(f"[WARNING] Blender 3.6 not found. Please set BLENDER_EXE environment variable.")

    # 2. Ollama Check
    ollama = OllamaClient(OLLAMA_BASE_URL)
    if ollama.check_connection():
        models = ollama.get_installed_models()
        model_names = [m['name'] for m in models]
        print(f"[OK] Ollama connected on {OLLAMA_BASE_URL}")
        print(f"     Installed models ({len(models)}): {', '.join(model_names) if model_names else 'None'}")
    else:
        print(f"[WARNING] Ollama is not running on {OLLAMA_BASE_URL}. Start Ollama with 'ollama serve'.")

    print("==================================================\n")


def main():
    check_prerequisites()
    
    port = 8000
    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    
    print(f"Starting Blender AI server on {url}...")
    webbrowser.open(url)
    
    import uvicorn
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
