"""
Blender 3.6 Automated Scene Generation Runner.
Executed directly inside Blender's embedded Python.
"""
import sys
import os
import json
import math
import uuid
from pathlib import Path

# Add prj directory and blender_engine to sys.path
script_dir = Path(__file__).resolve().parent
prj_dir = script_dir.parent
hackasol_dir = prj_dir.parent

for p in [str(prj_dir), str(script_dir), str(hackasol_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import bpy
from mathutils import Vector, Euler

from blender_engine.geometry.primitives import create_primitive
from blender_engine.geometry.custom_mesh import (
    create_bevel_box,
    create_profile_extrusion,
    create_lathe_revolution
)
from blender_engine.components.manager import assign_to_collection
from blender_engine.spatial.engine import (
    get_object_world_bounds,
    get_group_world_bounds,
    calculate_spatial_placement
)
from blender_engine.modifiers.builder import apply_modifiers
from blender_engine.materials.pbr import create_pbr_material, assign_material_to_object
from blender_engine.lighting.setup import setup_lighting, setup_camera
from blender_engine.validation.mesh_checker import validate_and_heal_object
from blender_engine.scene.action_executor import ActionExecutor, export_scene_state, find_target_object


def clear_scene():
    """Removes all default and existing objects completely from the scene."""
    for obj in list(bpy.data.objects):
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception:
            pass
    # Remove orphan data
    for col in [bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.armatures]:
        for item in list(col):
            try:
                col.remove(item)
            except Exception:
                pass


def auto_frame_camera(cam_obj: bpy.types.Object, objects: list, is_diagram: bool = False):
    """Positions and aims camera to frame all generated objects aesthetically."""
    if not objects or not cam_obj:
        return

    # Calculate collective bounding box across MESH, CURVE, FONT
    min_co = Vector((float('inf'), float('inf'), float('inf')))
    max_co = Vector((float('-inf'), float('-inf'), float('-inf')))

    for obj in objects:
        if obj.type in ('MESH', 'CURVE', 'FONT'):
            try:
                b = get_object_world_bounds(obj)
                b_min, b_max = b["min"], b["max"]
                min_co.x = min(min_co.x, b_min.x)
                min_co.y = min(min_co.y, b_min.y)
                min_co.z = min(min_co.z, b_min.z)
                max_co.x = max(max_co.x, b_max.x)
                max_co.y = max(max_co.y, b_max.y)
                max_co.z = max(max_co.z, b_max.z)
            except Exception:
                min_co.x = min(min_co.x, obj.location.x - 0.5)
                max_co.x = max(max_co.x, obj.location.x + 0.5)
                min_co.z = min(min_co.z, obj.location.z - 0.5)
                max_co.z = max(max_co.z, obj.location.z + 0.5)

    if min_co.x == float('inf'):
        return

    center = (min_co + max_co) * 0.5
    size = max_co - min_co
    max_dim = max(size.x, size.y, size.z, 0.5)

    if is_diagram:
        # Technical drawing front-facing camera aligned with diagram plane
        distance = max(size.x, size.z, 5.0) * 1.55
        cam_pos = center + Vector((0.0, -distance, 0.0))
        cam_obj.location = cam_pos
        cam_obj.rotation_euler = Euler((math.radians(90.0), 0.0, 0.0), 'XYZ')
    else:
        # Place camera at isometric 3/4 perspective
        distance = max_dim * 2.5
        cam_pos = center + Vector((distance * 0.75, -distance * 0.9, distance * 0.6))
        cam_obj.location = cam_pos
        direction = center - cam_obj.location
        rot_quat = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot_quat.to_euler()


def execute_plan(plan_data: dict, existing_blend: str = None) -> dict:
    """Executes atomic operations or incremental component creation inside Blender."""
    is_incremental = False
    if plan_data.get("clear_scene", True):
        clear_scene()
    elif existing_blend and os.path.isfile(existing_blend):
        print(f"[Blender Runner] Preserving existing scene: {existing_blend}")
        bpy.ops.wm.open_mainfile(filepath=existing_blend)
        is_incremental = True

    executed_actions_log = []

    # 1. ACTION-BASED EXECUTION (Priority)
    actions = plan_data.get("actions", [])
    if actions:
        print(f"[Blender Runner] Executing {len(actions)} discrete actions...")
        for act in actions:
            act_type = act.get("action", "").upper()
            res = {}
            if act_type == "CREATE_OBJECT":
                res = ActionExecutor.execute_create(act)
            elif act_type == "MOVE_OBJECT":
                res = ActionExecutor.execute_move(act)
            elif act_type == "ROTATE_OBJECT":
                res = ActionExecutor.execute_rotate(act)
            elif act_type == "SCALE_OBJECT":
                res = ActionExecutor.execute_scale(act)
            elif act_type == "CHANGE_MATERIAL":
                res = ActionExecutor.execute_change_material(act)
            elif act_type == "DELETE_OBJECT":
                res = ActionExecutor.execute_delete(act)
            elif act_type == "GROUP_OBJECTS":
                res = ActionExecutor.execute_group(act)
            elif act_type == "MODIFY_OBJECT":
                # If modification has translation/rotation/scale/material
                if "translation" in act:
                    res = ActionExecutor.execute_move(act)
                if "rotation" in act:
                    res = ActionExecutor.execute_rotate(act)
                if "scale" in act:
                    res = ActionExecutor.execute_scale(act)
                if "material" in act:
                    res = ActionExecutor.execute_change_material(act)
            executed_actions_log.append(res)

    # 2. COMPONENT-BASED EXECUTION (Fallback / Compatibility)
    components = plan_data.get("components", [])
    created_objects = {}
    if components and not actions:
        print(f"[Blender Runner] Creating/updating {len(components)} components...")
        for comp in components:
            name = comp.get("name", "Component")
            # If scene is incremental, check if exact object already exists
            existing_obj = find_target_object(name) if is_incremental else None
            if existing_obj:
                print(f"[Blender Runner] Object '{name}' already exists in scene. Skipping duplicate creation.")
                created_objects[name] = existing_obj
                continue

            geom_type = comp.get("geometry_type", "PRIMITIVE").upper()
            dims = comp.get("dimensions", [1.0, 1.0, 1.0])
            pos = comp.get("position", [0.0, 0.0, 0.0])
            rot = comp.get("rotation", [0.0, 0.0, 0.0])

            if geom_type in ("TEXT", "TEXT_LABEL", "PIPELINE", "CURVE", "SIGNAL_LINE", "FLOW_ARROW", "ARROW", "VALVE", "PUMP", "VESSEL", "TANK", "INSTRUMENT", "SENSOR", "CONTROLLER", "PLC", "LEGEND", "TITLE_BLOCK"):
                ActionExecutor.execute_create(comp)
                created_objects[name] = find_target_object(name) or bpy.context.active_object
                continue

            obj = None
            if geom_type == "BEVEL_BOX":
                obj = create_bevel_box(name, dims, pos, rot)
            elif geom_type == "PROFILE_EXTRUSION":
                p_type = comp.get("profile_type", "RECTANGLE")
                obj = create_profile_extrusion(name, p_type, dims, pos, rot)
            elif geom_type == "LATHE_REVOLUTION":
                obj = create_lathe_revolution(name, dims, pos, rot)
            else:
                prim_type = comp.get("primitive", "CUBE")
                obj = create_primitive(prim_type, name, dims, pos, rot)

            obj["ai_id"] = comp.get("id") or f"obj_{uuid.uuid4().hex[:8]}"
            obj["geom_type"] = geom_type

            col_name = comp.get("collection", "Main")
            assign_to_collection(obj, col_name)

            if "modifiers" in comp:
                apply_modifiers(obj, comp["modifiers"])

            if "material" in comp:
                mat = create_pbr_material(comp["material"])
                assign_material_to_object(obj, mat)

            # Group and hierarchy tags
            group_id = comp.get("group_id") or plan_data.get("group_id")
            group_name = comp.get("group_name") or plan_data.get("group_name") or plan_data.get("project_name")
            if group_id:
                obj["group_id"] = group_id
            if group_name:
                obj["group_name"] = group_name
            if "is_root" in comp:
                obj["is_root"] = bool(comp["is_root"])

            created_objects[name] = obj

        # Resolve parent-child hierarchy and relative alignments for new components
        for comp in components:
            name = comp.get("name")
            if name not in created_objects:
                continue
            curr_obj = created_objects[name]

            # Parent-child
            parent_name = comp.get("parent")
            if parent_name:
                p_obj = created_objects.get(parent_name) or find_target_object(parent_name)
                if p_obj and p_obj != curr_obj:
                    curr_obj.parent = p_obj
                    curr_obj.matrix_parent_inverse = p_obj.matrix_world.inverted()

            # Relative spatial positioning using bounding boxes
            rel_info = comp.get("relative_to")
            if rel_info:
                target_name = rel_info.get("target")
                relation = rel_info.get("relation", "ON_TOP")
                gap = float(rel_info.get("gap", 0.0))
                target_obj = created_objects.get(target_name) or find_target_object(target_name)
                if target_obj and target_obj != curr_obj:
                    ref_b = get_object_world_bounds(target_obj)
                    cur_b = get_object_world_bounds(curr_obj)
                    curr_obj.location = calculate_spatial_placement(cur_b, ref_b, relation, gap)
                    bpy.context.view_layer.update()

    # 3. Setup lighting and primary camera
    if not is_incremental or plan_data.get("lighting"):
        setup_lighting(plan_data.get("lighting"))

    cam_obj = bpy.data.objects.get("Render_Camera")
    if not cam_obj:
        setup_camera(plan_data.get("camera"))
        cam_obj = bpy.data.objects.get("Render_Camera")

    # Auto-frame camera to encompass all current scene meshes, curves and text
    is_diagram = bool(plan_data.get("is_diagram", False) or plan_data.get("category") == "DIAGRAM")
    all_scene_objects = [o for o in bpy.data.objects if o.type in ('MESH', 'CURVE', 'FONT')]
    auto_frame_camera(cam_obj, all_scene_objects, is_diagram=is_diagram)

    # 4. Export Live Scene State
    current_scene_state = export_scene_state()

    return {
        "success": True,
        "actions_executed": executed_actions_log,
        "components_created": list(created_objects.keys()),
        "scene_state": current_scene_state,
        "total_objects": len(all_scene_objects)
    }


def main():
    # Find arguments after '--'
    argv = sys.argv
    if "--" not in argv:
        print("[Error] No task arguments provided after '--'", file=sys.stderr)
        sys.exit(1)

    args = argv[argv.index("--") + 1:]
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--task-file", required=True, help="Path to task JSON file")
    parser.add_argument("--save-blend", required=True, help="Path to output .blend file")
    parser.add_argument("--render-path", help="Path to render preview image")
    parser.add_argument("--status-file", required=True, help="Path to output status JSON file")

    parsed = parser.parse_args(args)

    with open(parsed.task_file, "r", encoding="utf-8") as f:
        task_data = json.load(f)

    plan = task_data.get("plan", {})
    existing_blend = task_data.get("existing_blend")

    status_result = {
        "success": False,
        "task_id": task_data.get("task_id"),
        "blend_path": parsed.save_blend,
        "render_path": parsed.render_path
    }

    try:
        exec_info = execute_plan(plan, existing_blend)
        status_result.update(exec_info)

        # Save .blend
        project_folder = os.path.dirname(os.path.abspath(parsed.save_blend))
        os.makedirs(project_folder, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=parsed.save_blend)
        print(f"[Blender Runner] Successfully saved: {parsed.save_blend}")

        # Save scene_state.json in project folder
        if "scene_state" in exec_info:
            scene_state_file = os.path.join(project_folder, "scene_state.json")
            with open(scene_state_file, "w", encoding="utf-8") as f:
                json.dump(exec_info["scene_state"], f, indent=2)

        # Render preview if requested
        if parsed.render_path:
            os.makedirs(os.path.dirname(os.path.abspath(parsed.render_path)), exist_ok=True)
            scene = bpy.context.scene
            scene.render.image_settings.file_format = 'PNG'
            scene.render.filepath = parsed.render_path
            scene.render.resolution_x = 960
            scene.render.resolution_y = 640
            scene.render.resolution_percentage = 100
            
            # Select EEVEE across Blender 3.6–4.1 (BLENDER_EEVEE) and 4.2+ (BLENDER_EEVEE_NEXT)
            available_engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
            if 'BLENDER_EEVEE' in available_engines:
                scene.render.engine = 'BLENDER_EEVEE'
            elif 'BLENDER_EEVEE_NEXT' in available_engines:
                scene.render.engine = 'BLENDER_EEVEE_NEXT'
            elif 'BLENDER_WORKBENCH' in available_engines:
                scene.render.engine = 'BLENDER_WORKBENCH'
            bpy.ops.render.render(write_still=True)
            print(f"[Blender Runner] Rendered preview: {parsed.render_path}")

        status_result["success"] = True

    except Exception as e:
        import traceback
        status_result["error"] = str(e)
        status_result["traceback"] = traceback.format_exc()
        print(f"[Blender Runner Error] {e}", file=sys.stderr)

    # Write status file
    with open(parsed.status_file, "w", encoding="utf-8") as f:
        json.dump(status_result, f, indent=2)


if __name__ == "__main__":
    main()
