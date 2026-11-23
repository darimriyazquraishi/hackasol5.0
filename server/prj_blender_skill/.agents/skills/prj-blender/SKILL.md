---
name: prj-blender
description: >-
  Start, control, inspect, render, and open Blender 3.6+ using the local `prj` Blender engine.
  Use this skill whenever any AI model needs to launch Blender, generate or incrementally edit
  3D models or P&ID technical diagrams, render EEVEE previews, inspect scene state (objects,
  bounding boxes, groups, materials), or start the `prj` Blender AI web server.
---

# `prj` Blender Automation Skill

Drive the exact Blender 3.6+ automation pipeline in `prj/` from **any AI model** (Gemini, Claude, GPT/OpenAI, Ollama, CLI agents, or Python code) — with or without Ollama or the web UI running.

## Entry Points

- **Python skill function** (direct import or tool-calling): `prj/blender_skill.py` -> `blender_skill(action, **kwargs)`
- **Portable CLI wrapper**: [scripts/run.py](./scripts/run.py) (forwards to `prj/blender_skill.py`)
- **Full JSON Plan Contract**: [references/plan_schema.json](./references/plan_schema.json)
- **LLM Function-Calling Schemas** (OpenAI / Anthropic / Gemini / Ollama): [references/tool_schemas.json](./references/tool_schemas.json)

---

## Standard Workflow

### 1. Check Blender & Environment
Verify Blender 3.6+ is detected before running jobs:
```bash
python .agents/skills/prj-blender/scripts/run.py status
```

### 2. Build a New 3D Scene or Technical Diagram (Recommended: `execute-plan`)
Any capable AI model should author the structured JSON plan directly and execute it through `prj/blender_engine/runner.py`:

```bash
python .agents/skills/prj-blender/scripts/run.py execute-plan \
  --project-id my_desk \
  --plan-file plan.json
```

Or inline JSON:
```bash
python .agents/skills/prj-blender/scripts/run.py execute-plan \
  --project-id demo_scene \
  --plan-json '{"project_name":"demo","clear_scene":true,"actions":[{"action":"CREATE_OBJECT","object_data":{"name":"Table_Top","geometry_type":"BEVEL_BOX","dimensions":[1.6,0.8,0.06],"position":[0,0,0.75],"material":{"name":"Oak","color":[0.55,0.35,0.18,1],"roughness":0.45}}}]}'
```

Outputs saved automatically into `prj/projects/<project_id>/`:
- `model.blend` — Saved Blender scene (compatible with `prj` web UI)
- `preview.png` — Auto-framed 960×640 EEVEE preview render (skip with `--no-render`)
- `scene_state.json` — Live world bounding boxes, transforms, groups, hierarchy, materials
- `metadata.json` — Project metadata, plan, and execution stats

### 3. Inspect & Incrementally Edit an Existing Scene
Always inspect first so you know exact object names, groups, and bounding boxes:
```bash
python .agents/skills/prj-blender/scripts/run.py inspect --project-id my_desk
```

Then send **discrete actions** with `"clear_scene": false` and the same `--project-id` (the runner loads `model.blend` automatically and preserves existing objects):
```json
{
  "project_name": "add_lamp",
  "clear_scene": false,
  "actions": [
    {
      "action": "CREATE_OBJECT",
      "relative_to": {"target": "Table_Top", "relation": "ON_TOP", "gap": 0.0},
      "object_data": {
        "name": "Lamp_Base",
        "group_id": "lamp_1",
        "group_name": "Lamp",
        "is_root": true,
        "geometry_type": "PRIMITIVE",
        "primitive": "CYLINDER",
        "dimensions": [0.18, 0.18, 0.03],
        "material": {"name": "Brass", "color": [0.8, 0.65, 0.3, 1.0], "metallic": 0.9, "roughness": 0.2}
      }
    }
  ]
}
```

### 4. Natural-Language Generation (via `prj` Planner / Blueprints)
Use `prj`'s built-in planner (local Ollama if running, or deterministic blueprints & spatial interpreter with `--no-ollama`):
```bash
python .agents/skills/prj-blender/scripts/run.py generate \
  --prompt "Create an industrial water pumping system P&ID diagram" \
  --no-ollama
```

### 5. Launch Blender GUI or `prj` Web Workstation
- **Open a project visibly in Blender GUI** (or pass `--open-gui` on `execute-plan`/`generate`):
  ```bash
  python .agents/skills/prj-blender/scripts/run.py start-blender --project-id my_desk
  ```
- **Launch empty Blender GUI**:
  ```bash
  python .agents/skills/prj-blender/scripts/run.py start-blender
  ```
- **Start the `prj` FastAPI + React Web UI** (`http://127.0.0.1:8000`):
  ```bash
  python .agents/skills/prj-blender/scripts/run.py start-server --port 8000
  ```

---

## Supported Plan Primitives & Actions (Quick Reference)

See [references/plan_schema.json](./references/plan_schema.json) for full field definitions.

- **Actions**: `CREATE_OBJECT`, `MOVE_OBJECT`, `ROTATE_OBJECT`, `SCALE_OBJECT`, `CHANGE_MATERIAL`, `DELETE_OBJECT`, `GROUP_OBJECTS`, `MODIFY_OBJECT`
- **Scopes**: `GROUP` (transforms entire assembly around group centroid), `SINGLE`, `AUTO`
- **Spatial Relations (`relative_to.relation`)**: `ON_TOP`, `UNDER`, `BEHIND`, `IN_FRONT_OF`, `BESIDE`, `LEFT_OF`, `RIGHT_OF`, `INSIDE`
- **3D Geometry (`geometry_type`)**:
  - `PRIMITIVE` (`primitive`: `CUBE`, `CYLINDER`, `SPHERE`, `CONE`, `TORUS`, `PLANE`)
  - `BEVEL_BOX`
  - `PROFILE_EXTRUSION` (`profile_type`: `HEXAGON`, `STAR`, `RECTANGLE`)
  - `LATHE_REVOLUTION`
- **P&ID / Technical Diagrams (`is_diagram: true`)**: `TEXT_LABEL`, `PIPELINE`, `SIGNAL_LINE`, `FLOW_ARROW`, `VALVE` (`GATE`, `CONTROL`, `CHECK`), `PUMP`, `VESSEL`/`TANK`, `INSTRUMENT`/`SENSOR`, `CONTROLLER`/`PLC`, `LEGEND`/`TITLE_BLOCK`
- **PBR Materials**: `name`, `color` (`[r,g,b,a]`), `metallic`, `roughness`, `transmission` (glass), `emission_color`, `emission_strength`
- **Modifiers**: `BEVEL`, `SUBSURF`, `SOLIDIFY`, `MIRROR`, `ARRAY`, `BOOLEAN`

---

## Using `blender_skill` from Any AI Model / Python SDK

```python
from prj.blender_skill import blender_skill, get_tool_schema, handle_tool_call

# Register with OpenAI, Anthropic, Gemini, or Ollama
tool_def = get_tool_schema("openai")   # or "anthropic", "gemini", "ollama"

# Direct call
result = blender_skill("execute_plan", project_id="chair_01", plan={...})

# Or dispatch a model's tool call payload directly
result = handle_tool_call(model_tool_call)
```

---

## Verification Checklist
After running `execute-plan` or `generate`:
1. Confirm `"success": true` in the returned JSON.
2. Check `"total_objects"` and `"scene_state.objects"` bounding boxes to verify placement and dimensions.
3. Confirm `blend_path` (`.blend`) and `render_path` (`preview.png`) exist on disk; inspect `preview.png` visually when possible.
