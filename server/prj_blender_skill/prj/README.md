# Blender AI – Local AI-Powered 3D Model Generator

A complete local application that connects **Ollama AI** to **Blender 3.6**. Users describe any 3D object in natural language, and the application automatically converts the prompt into a structured 3D modeling plan, automates Blender 3.6 to generate the geometry, materials, and lighting, saves the `.blend` file, renders a preview, and allows continuing modifications.

Everything runs 100% locally without cloud services or API keys.

---

## Architecture Overview

```text
Hackasol/prj/
├── frontend/                     # React + Vite CAD/Blender Workstation UI
│   ├── src/
│   │   ├── App.jsx               # Workspace, model selector, WebSocket listener, chat & preview
│   │   ├── App.css               # Clean professional dark theme UI
│   │   └── index.css
│   └── dist/                     # Production compiled frontend bundle
├── backend/                      # Python + FastAPI Backend
│   ├── api/
│   │   └── routes.py             # REST API & WebSockets for live logs & progress
│   ├── ollama/
│   │   └── client.py             # Dynamic Ollama model detection and inference
│   ├── planner/
│   │   └── engine.py             # Natural language to structured JSON modeling plan
│   ├── task_manager/
│   │   └── manager.py            # Async background tasks & Blender process manager
│   └── main.py                   # FastAPI server entry point
├── blender_engine/               # Pure Python modules executed by Blender 3.6
│   ├── geometry/
│   │   ├── primitives.py         # Cube, Cylinder, UV Sphere, Cone, Torus, Plane
│   │   └── custom_mesh.py        # Bevel box, profiles, lathe revolutions, extrusions
│   ├── components/
│   │   └── manager.py            # Relative alignment (ON_TOP, CENTER_OF, COAXIAL) & collections
│   ├── materials/
│   │   └── pbr.py                # Principled BSDF with metallic, roughness, glass transmission & RGB emission
│   ├── modifiers/
│   │   └── builder.py            # Bevel, Subdivision Surface, Solidify, Mirror, Array
│   ├── lighting/
│   │   └── setup.py              # Studio 3-point lighting and camera auto-framing
│   ├── validation/
│   │   └── mesh_checker.py       # Mesh manifold, normal recalculation & auto-healing
│   └── runner.py                 # CLI runner invoked by Blender (-b -P runner.py)
├── config/
│   └── settings.py               # Auto-detection of Blender 3.6 & Ollama configuration
├── projects/                     # Generated projects (.blend files, previews & metadata)
├── tasks/                        # Ephemeral task JSON & status files
├── requirements.txt
├── run.py                        # Single-command launcher
└── start.bat                     # Windows batch launcher
```

---

## Key Features

1. **Dynamic Ollama Integration**:
   - Detects running Ollama daemon (`http://localhost:11434`).
   - Retrieves all installed models (`qwen2.5:3b`, `llama3.2`, etc.) dynamically into the UI model selector without hardcoding.
   - Enforces JSON-structured modeling plans with fallback recovery.

2. **Blender 3.6 Automation**:
   - Auto-detects `C:\Program Files\Blender Foundation\Blender 3.6\blender.exe`.
   - Spawns Blender asynchronously to generate geometry, apply modifiers, setup materials, and frame the camera.
   - Saves production-ready `.blend` files into `projects/<project_id>/model.blend`.
   - Renders multi-view preview images (`preview.png`).
   - **"Open in Blender"** action launches Blender 3.6 GUI with the model loaded for interactive viewing.

3. **Parametric & Procedural Geometry Engine**:
   - Primitives: Cube, Cylinder, Sphere, Cone, Torus, Plane.
   - Engineered geometry: Bevel boxes, hexagonal and star profile extrusions, lathe revolutions.
   - Modifiers: Bevel (angle-gated), Subdivision Surface, Solidify, Mirror, Array, Boolean.
   - Materials: Principled BSDF with metallic, roughness, glass transmission (tempered glass panels), and emission (RGB glowing fans/LEDs).

4. **Conversational Refinement**:
   - Users can send follow-up instructions to modify previously generated models (e.g. "Add a top exhaust fan", "Change the color to white") without rebuilding from scratch.

5. **Real-time WebSockets**:
   - Live generation progress (0–100%) and console log messages streamed directly from Blender to the browser.

---

## Quick Start

### 1. Start the Application
Run the launcher from `Hackasol/prj`:

```bash
cd c:\Users\ThinkPad\Downloads\Hackathon\Hackasol\prj
python run.py
```
*(Or double-click `start.bat` on Windows)*

The application will start on **`http://127.0.0.1:8000`** and automatically open in your default browser.

### 2. Generate a 3D Model
1. Select your preferred Ollama model in the top header.
2. Enter a natural language description (e.g., *"Create a realistic gaming PC with RGB fans and glass panels"*).
3. Click **Generate** and watch the real-time console logs as Blender creates the geometry.
4. Click **"Open in Blender"** to inspect and edit the 3D model directly inside Blender 3.6!
