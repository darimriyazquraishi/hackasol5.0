#!/usr/bin/env python3
"""
Runnable cross-device demo for `prj_blender_skill`.
Creates a table top, incrementally places a red sphere on top of it,
renders preview.png, and prints the live scene state.
"""
import json
from prj.blender_skill import blender_skill, get_tool_schema, handle_tool_call


def main():
    print("1) Checking environment...")
    env = blender_skill("status")
    print(json.dumps(env, indent=2))
    if not env["blender"]["installed"]:
        print("\n[!] Blender not detected. Install Blender 3.6+ or set BLENDER_EXE.")
        return

    project_id = "demo_portable_scene"

    print("\n2) Creating Table_Top in Blender...")
    r1 = blender_skill(
        "execute_plan",
        project_id=project_id,
        plan={
            "project_name": "portable_demo",
            "clear_scene": True,
            "actions": [
                {
                    "action": "CREATE_OBJECT",
                    "object_data": {
                        "name": "Table_Top",
                        "geometry_type": "BEVEL_BOX",
                        "dimensions": [1.6, 0.8, 0.08],
                        "position": [0.0, 0.0, 0.75],
                        "material": {
                            "name": "Oak_Wood",
                            "color": [0.55, 0.35, 0.18, 1.0],
                            "roughness": 0.45,
                        },
                    },
                }
            ],
        },
    )
    print("   Created:", r1.get("blend_path"))

    print("\n3) Incrementally adding Red_Sphere ON_TOP via tool-call dispatcher...")
    r2 = handle_tool_call(
        {
            "name": "blender_skill",
            "args": {
                "action": "execute_plan",
                "project_id": project_id,
                "plan": {
                    "clear_scene": False,
                    "actions": [
                        {
                            "action": "CREATE_OBJECT",
                            "relative_to": {
                                "target": "Table_Top",
                                "relation": "ON_TOP",
                                "gap": 0.0,
                            },
                            "object_data": {
                                "name": "Red_Sphere",
                                "geometry_type": "PRIMITIVE",
                                "primitive": "SPHERE",
                                "dimensions": [0.28, 0.28, 0.28],
                                "material": {
                                    "name": "Glossy_Red",
                                    "color": [0.9, 0.1, 0.1, 1.0],
                                    "roughness": 0.2,
                                },
                            },
                        }
                    ],
                },
            },
        }
    )
    print("   Total objects:", r2.get("total_objects"))
    print("   Blend file:   ", r2.get("blend_path"))
    print("   Preview PNG:  ", r2.get("render_path"))
    print("   Scene state:  ", r2.get("scene_state_path"))
    print("\n4) Example OpenAI tool schema name:", get_tool_schema("openai")["function"]["name"])


if __name__ == "__main__":
    main()
