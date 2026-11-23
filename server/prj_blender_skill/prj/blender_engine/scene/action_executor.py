"""
Independent Action Executor for Blender 3.6.
Executes atomic and hierarchical operations:
CREATE_OBJECT, MOVE_OBJECT, ROTATE_OBJECT, SCALE_OBJECT, CHANGE_MATERIAL, DELETE_OBJECT, GROUP_OBJECTS.
Maintains persistent scene state, parent-child hierarchies, and spatial relationships.
"""
import math
import uuid
from typing import Dict, Any, List, Optional, Tuple

try:
    import bpy
    from mathutils import Vector, Euler, Matrix
except ImportError:
    bpy = None
    Vector = None
    Euler = None
    Matrix = None

from blender_engine.geometry.primitives import create_primitive
from blender_engine.geometry.custom_mesh import (
    create_bevel_box,
    create_profile_extrusion,
    create_lathe_revolution
)
from blender_engine.components.manager import assign_to_collection
from blender_engine.modifiers.builder import apply_modifiers
from blender_engine.materials.pbr import create_pbr_material, assign_material_to_object
from blender_engine.validation.mesh_checker import validate_and_heal_object
from blender_engine.spatial.engine import (
    get_object_world_bounds,
    get_group_world_bounds,
    calculate_spatial_placement
)
from blender_engine.diagram.engine import (
    create_text_label,
    create_pipeline,
    create_flow_arrow,
    create_valve_symbol,
    create_pump_symbol,
    create_vessel_symbol,
    create_instrument_balloon,
    create_controller_symbol,
    create_legend_and_title_block
)


def find_target_object(target_ref: str) -> Optional["bpy.types.Object"]:
    """
    Finds a single object by exact ID, exact name, or case-insensitive semantic match.
    """
    if not target_ref:
        return None
    ref_lower = target_ref.strip().lower()

    # 1. Match by custom ai_id
    for obj in bpy.data.objects:
        if obj.get("ai_id") == target_ref:
            return obj

    # 2. Match by exact name
    if target_ref in bpy.data.objects:
        return bpy.data.objects[target_ref]

    # 3. Match by case-insensitive name
    for obj in bpy.data.objects:
        if obj.name.lower() == ref_lower:
            return obj

    # 4. Semantic substring matching (e.g. "cube" matches "Geometric_Cube")
    candidates = []
    for obj in bpy.data.objects:
        o_name = obj.name.lower()
        if ref_lower in o_name or o_name in ref_lower:
            candidates.append(obj)

    if len(candidates) == 1:
        return candidates[0]
    elif len(candidates) > 1:
        # Prefer mesh type
        meshes = [o for o in candidates if o.type == 'MESH']
        if meshes:
            return meshes[0]
        return candidates[0]

    return None


def get_objects_in_group(group_ref: str) -> List["bpy.types.Object"]:
    """
    Returns all objects belonging to a group by group_id, group_name, or parent root.
    """
    if not group_ref:
        return []
    ref_lower = group_ref.strip().lower()

    # 1. Match by group_id
    group_objs = [o for o in bpy.data.objects if o.get("group_id") and str(o.get("group_id")).lower() == ref_lower]
    if group_objs:
        return group_objs

    # 2. Match by group_name
    group_objs = [o for o in bpy.data.objects if o.get("group_name") and str(o.get("group_name")).lower() == ref_lower]
    if group_objs:
        return group_objs

    # 3. Match by semantic group substring (e.g. "car" matches group_name "Car_Assembly")
    for obj in bpy.data.objects:
        g_name = str(obj.get("group_name", "")).lower()
        if g_name and (ref_lower in g_name or g_name in ref_lower):
            target_gid = obj.get("group_id")
            return [o for o in bpy.data.objects if o.get("group_id") == target_gid]

    # 4. Match by root object and its hierarchy
    target_obj = find_target_object(group_ref)
    if target_obj:
        if target_obj.get("group_id"):
            target_gid = target_obj.get("group_id")
            return [o for o in bpy.data.objects if o.get("group_id") == target_gid]
        # Check children hierarchy
        children = [o for o in bpy.data.objects if o.parent == target_obj]
        if children:
            return [target_obj] + children

    return []


def resolve_target_scope(
    target_ref: str,
    requested_scope: str = "AUTO"
) -> Tuple[List["bpy.types.Object"], str]:
    """
    Determines whether the target is an entire logical group or a single component.
    Returns: (list_of_objects, resolved_scope: 'GROUP' | 'SINGLE')
    """
    scope = (requested_scope or "AUTO").upper()

    if scope == "GROUP":
        group_objs = get_objects_in_group(target_ref)
        if group_objs:
            return group_objs, "GROUP"

    # If AUTO, check if target_ref clearly indicates an assembly / group
    if scope == "AUTO":
        group_objs = get_objects_in_group(target_ref)
        if group_objs and len(group_objs) > 1:
            # Check if target_ref specifically specifies a sub-component (e.g. "wheel", "seat", "leg")
            ref_lower = target_ref.lower()
            is_subcomponent = any(part in ref_lower for part in [
                "wheel", "tire", "door", "window", "roof", "headlight", "mirror",
                "leg", "backrest", "seat", "arm", "shade", "bulb", "fan", "screen"
            ])
            # If target_ref has exact match for a single object name, and is a subcomponent, use SINGLE
            exact_obj = find_target_object(target_ref)
            if exact_obj and is_subcomponent and not ("car" in ref_lower and "wheel" not in ref_lower):
                return [exact_obj], "SINGLE"
            return group_objs, "GROUP"

    # Default to single object
    target_obj = find_target_object(target_ref)
    if target_obj:
        return [target_obj], "SINGLE"

    # Fallback check for group
    group_objs = get_objects_in_group(target_ref)
    if group_objs:
        return group_objs, "GROUP"

    return [], "SINGLE"


class ActionExecutor:
    """Executes atomic and group operations on the active Blender scene."""

    @staticmethod
    def execute_create(action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a single object with a stable identifier and optional spatial placement."""
        comp = action_data.get("object_data") or action_data
        name = comp.get("name", "Object")
        geom_type = comp.get("geometry_type", "PRIMITIVE").upper()
        dims = comp.get("dimensions", [1.0, 1.0, 1.0])
        pos = comp.get("position", [0.0, 0.0, 0.0])
        rot = comp.get("rotation", [0.0, 0.0, 0.0])

        ai_id = comp.get("id") or f"obj_{uuid.uuid4().hex[:8]}"

        # Handle Diagram & Schematic Geometry Types
        if geom_type in ("TEXT", "TEXT_LABEL"):
            obj = create_text_label(
                name=name,
                text=comp.get("text", name),
                position=pos,
                size=float(comp.get("size", 0.22)),
                color_rgba=comp.get("color", [0.95, 0.95, 0.98, 1.0]),
                rotation=rot,
                collection=comp.get("collection", "Labels")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": obj.name, "position": list(obj.location)}

        elif geom_type in ("PIPELINE", "CURVE", "SIGNAL_LINE"):
            pts = comp.get("points") or [[pos[0] - 1.0, pos[1], pos[2]], [pos[0] + 1.0, pos[1], pos[2]]]
            obj = create_pipeline(
                name=name,
                points=pts,
                radius=float(comp.get("radius", 0.035)),
                color_rgba=comp.get("color", [0.2, 0.65, 0.95, 1.0]),
                is_signal=bool(comp.get("is_signal", False) or geom_type == "SIGNAL_LINE"),
                collection=comp.get("collection", "Pipelines")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": obj.name if obj else name}

        elif geom_type in ("FLOW_ARROW", "ARROW"):
            obj = create_flow_arrow(
                name=name,
                position=pos,
                direction=comp.get("direction", [1.0, 0.0, 0.0]),
                length=float(comp.get("length", 0.28)),
                radius=float(comp.get("radius", 0.10)),
                color_rgba=comp.get("color", [0.1, 0.85, 0.35, 1.0]),
                collection=comp.get("collection", "Flow_Arrows")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": obj.name if obj else name}

        elif geom_type == "VALVE":
            objs = create_valve_symbol(
                name=name,
                position=pos,
                valve_type=comp.get("valve_type", "GATE"),
                size=float(comp.get("size", 0.26)),
                rotation_z=float(rot[2]) if len(rot) > 2 else 0.0,
                color_rgba=comp.get("color", [0.95, 0.45, 0.15, 1.0]),
                tag=comp.get("tag", ""),
                collection=comp.get("collection", "Valves")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": name, "objects": [o.name for o in objs]}

        elif geom_type == "PUMP":
            objs = create_pump_symbol(
                name=name,
                position=pos,
                size=float(comp.get("size", 0.65)),
                tag=comp.get("tag", "P-101"),
                subtext=comp.get("subtext", "Centrifugal Pump"),
                color_rgba=comp.get("color", [0.25, 0.75, 0.95, 1.0]),
                collection=comp.get("collection", "Equipment")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": name, "objects": [o.name for o in objs]}

        elif geom_type in ("VESSEL", "TANK"):
            objs = create_vessel_symbol(
                name=name,
                position=pos,
                width=float(dims[0]) if dims else 2.4,
                height=float(dims[2]) if len(dims) > 2 else 3.6,
                tag=comp.get("tag", "TK-101"),
                subtext=comp.get("subtext", "Storage Tank"),
                color_rgba=comp.get("color", [0.35, 0.55, 0.85, 1.0]),
                collection=comp.get("collection", "Equipment")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": name, "objects": [o.name for o in objs]}

        elif geom_type in ("INSTRUMENT", "SENSOR"):
            objs = create_instrument_balloon(
                name=name,
                tag=comp.get("tag", "PT-101"),
                position=pos,
                size=float(comp.get("size", 0.45)),
                subtext=comp.get("subtext", ""),
                color_rgba=comp.get("color", [0.95, 0.85, 0.15, 1.0]),
                collection=comp.get("collection", "Instruments")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": name, "objects": [o.name for o in objs]}

        elif geom_type in ("CONTROLLER", "PLC"):
            objs = create_controller_symbol(
                name=name,
                tag=comp.get("tag", "PLC-100"),
                position=pos,
                width=float(dims[0]) if dims else 1.4,
                height=float(dims[2]) if len(dims) > 2 else 1.0,
                color_rgba=comp.get("color", [0.95, 0.25, 0.35, 1.0]),
                collection=comp.get("collection", "Control_Systems")
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": name, "objects": [o.name for o in objs]}

        elif geom_type in ("LEGEND", "TITLE_BLOCK"):
            objs = create_legend_and_title_block(
                title=comp.get("title", "SYSTEM P&ID"),
                legend_items=comp.get("legend_items"),
                position=pos
            )
            return {"action": "CREATE_OBJECT", "success": True, "id": ai_id, "name": name, "objects": [o.name for o in objs]}

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

        obj["ai_id"] = ai_id
        obj["geom_type"] = geom_type

        # Group and Hierarchy tracking
        group_id = comp.get("group_id") or action_data.get("group_id")
        group_name = comp.get("group_name") or action_data.get("group_name")
        if group_id:
            obj["group_id"] = group_id
        if group_name:
            obj["group_name"] = group_name
        if "is_root" in comp:
            obj["is_root"] = bool(comp["is_root"])

        parent_name = comp.get("parent")
        if parent_name:
            parent_obj = find_target_object(parent_name)
            if parent_obj and parent_obj != obj:
                obj.parent = parent_obj
                obj.matrix_parent_inverse = parent_obj.matrix_world.inverted()

        col_name = comp.get("collection", "Main")
        assign_to_collection(obj, col_name)

        if "modifiers" in comp:
            apply_modifiers(obj, comp["modifiers"])

        if "material" in comp:
            mat = create_pbr_material(comp["material"])
            assign_material_to_object(obj, mat)

        validate_and_heal_object(obj)
        bpy.context.view_layer.update()

        # Handle relative spatial placement if specified
        rel_info = action_data.get("relative_to") or comp.get("relative_to")
        if rel_info and isinstance(rel_info, dict):
            ref_name = rel_info.get("target") or rel_info.get("reference")
            relation = rel_info.get("relation", "ON_TOP")
            gap = float(rel_info.get("gap", 0.0))
            ref_objs, _ = resolve_target_scope(ref_name, "AUTO")
            if ref_objs:
                ref_bounds = get_group_world_bounds(ref_objs) if len(ref_objs) > 1 else get_object_world_bounds(ref_objs[0])
                obj_bounds = get_object_world_bounds(obj)
                target_pos = calculate_spatial_placement(obj_bounds, ref_bounds, relation, gap)
                obj.location = target_pos
                bpy.context.view_layer.update()

        return {
            "action": "CREATE_OBJECT",
            "success": True,
            "id": ai_id,
            "name": obj.name,
            "group_id": obj.get("group_id"),
            "group_name": obj.get("group_name"),
            "position": [round(v, 4) for v in obj.location]
        }

    @staticmethod
    def execute_move(action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Translates an existing object or group without altering internal relations."""
        target_ref = action_data.get("target")
        requested_scope = action_data.get("scope", "AUTO")
        targets, scope = resolve_target_scope(target_ref, requested_scope)

        if not targets:
            return {"action": "MOVE_OBJECT", "success": False, "error": f"Target '{target_ref}' not found"}

        # 1. Spatial relative move (e.g. "place the lamp on top of the table")
        rel_info = action_data.get("relative_to") or action_data.get("placement")
        if rel_info and isinstance(rel_info, dict):
            ref_name = rel_info.get("target") or rel_info.get("reference")
            relation = rel_info.get("relation", "ON_TOP")
            gap = float(rel_info.get("gap", 0.0))
            ref_targets, _ = resolve_target_scope(ref_name, "AUTO")
            if not ref_targets:
                return {"action": "MOVE_OBJECT", "success": False, "error": f"Reference object '{ref_name}' not found"}

            ref_bounds = get_group_world_bounds(ref_targets) if len(ref_targets) > 1 else get_object_world_bounds(ref_targets[0])
            t_bounds = get_group_world_bounds(targets) if len(targets) > 1 else get_object_world_bounds(targets[0])
            target_center = calculate_spatial_placement(t_bounds, ref_bounds, relation, gap)
            delta = target_center - t_bounds["center"]

            for obj in targets:
                obj.location += delta

            bpy.context.view_layer.update()
            return {
                "action": "MOVE_OBJECT",
                "success": True,
                "scope": scope,
                "targets": [o.name for o in targets],
                "relation": relation,
                "reference": ref_name
            }

        # 2. Vector delta / absolute translation
        trans = action_data.get("translation", {})
        mode = trans.get("mode", "RELATIVE").upper()
        vec = trans.get("vector", [0.0, 0.0, 0.0])
        delta = Vector([float(vec[0]), float(vec[1]), float(vec[2])])

        if scope == "GROUP" or len(targets) > 1:
            if mode == "ABSOLUTE":
                # Shift group so that group centroid aligns with absolute position
                g_bounds = get_group_world_bounds(targets)
                shift = delta - g_bounds["center"]
                for obj in targets:
                    obj.location += shift
            else:
                # Relative shift: move each object by delta
                for obj in targets:
                    obj.location += delta
        else:
            obj = targets[0]
            if mode == "ABSOLUTE":
                obj.location = delta
            else:
                obj.location += delta

        bpy.context.view_layer.update()
        return {
            "action": "MOVE_OBJECT",
            "success": True,
            "scope": scope,
            "targets": [o.name for o in targets],
            "new_positions": {o.name: [round(v, 4) for v in o.location] for o in targets}
        }

    @staticmethod
    def execute_rotate(action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Rotates an existing object or group around its centroid while preserving component relations."""
        target_ref = action_data.get("target")
        requested_scope = action_data.get("scope", "AUTO")
        targets, scope = resolve_target_scope(target_ref, requested_scope)

        if not targets:
            return {"action": "ROTATE_OBJECT", "success": False, "error": f"Target '{target_ref}' not found"}

        rot_info = action_data.get("rotation", {})
        mode = rot_info.get("mode", "RELATIVE").upper()
        angles = rot_info.get("angles", [0.0, 0.0, 0.0])
        rad_angles = [math.radians(float(a)) for a in angles]

        # Rotation matrix
        rot_mat = Euler(rad_angles, 'XYZ').to_matrix().to_4x4()

        if scope == "GROUP" or len(targets) > 1:
            g_bounds = get_group_world_bounds(targets)
            centroid = g_bounds["center"]

            for obj in targets:
                # Calculate relative offset from centroid
                offset = obj.location - centroid
                rotated_offset = rot_mat @ offset
                obj.location = centroid + rotated_offset

                # Rotate object's local orientation
                obj.rotation_euler.rotate(Euler(rad_angles, 'XYZ'))
        else:
            obj = targets[0]
            if mode == "ABSOLUTE":
                obj.rotation_euler = Euler(rad_angles, 'XYZ')
            else:
                obj.rotation_euler.x += rad_angles[0]
                obj.rotation_euler.y += rad_angles[1]
                obj.rotation_euler.z += rad_angles[2]

        bpy.context.view_layer.update()
        return {
            "action": "ROTATE_OBJECT",
            "success": True,
            "scope": scope,
            "targets": [o.name for o in targets]
        }

    @staticmethod
    def execute_scale(action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Proportionally scales an object or entire group around its centroid."""
        target_ref = action_data.get("target")
        requested_scope = action_data.get("scope", "AUTO")
        targets, scope = resolve_target_scope(target_ref, requested_scope)

        if not targets:
            return {"action": "SCALE_OBJECT", "success": False, "error": f"Target '{target_ref}' not found"}

        scale_info = action_data.get("scale", {})
        factors = scale_info.get("factors", [1.0, 1.0, 1.0])
        fx = float(factors[0])
        fy = float(factors[1])
        fz = float(factors[2])

        if scope == "GROUP" or len(targets) > 1:
            g_bounds = get_group_world_bounds(targets)
            centroid = g_bounds["center"]

            for obj in targets:
                # 1. Scale distance from centroid proportionally
                offset = obj.location - centroid
                scaled_offset = Vector((offset.x * fx, offset.y * fy, offset.z * fz))
                obj.location = centroid + scaled_offset

                # 2. Scale object dimensions
                obj.scale.x *= fx
                obj.scale.y *= fy
                obj.scale.z *= fz

                # Apply scale transform
                bpy.ops.object.select_all(action='DESELECT')
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        else:
            obj = targets[0]
            obj.scale.x *= fx
            obj.scale.y *= fy
            obj.scale.z *= fz

            bpy.ops.object.select_all(action='DESELECT')
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        bpy.context.view_layer.update()
        return {
            "action": "SCALE_OBJECT",
            "success": True,
            "scope": scope,
            "targets": [o.name for o in targets],
            "factors": [fx, fy, fz]
        }

    @staticmethod
    def execute_change_material(action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Changes material and color of target object or all objects in group."""
        target_ref = action_data.get("target")
        requested_scope = action_data.get("scope", "AUTO")
        targets, scope = resolve_target_scope(target_ref, requested_scope)

        if not targets:
            return {"action": "CHANGE_MATERIAL", "success": False, "error": f"Target '{target_ref}' not found"}

        mat_data = action_data.get("material", {})
        mat = create_pbr_material(mat_data)

        for obj in targets:
            assign_material_to_object(obj, mat)

        bpy.context.view_layer.update()
        return {
            "action": "CHANGE_MATERIAL",
            "success": True,
            "scope": scope,
            "targets": [o.name for o in targets],
            "material_name": mat.name
        }

    @staticmethod
    def execute_delete(action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Deletes target object or entire group."""
        target_ref = action_data.get("target")
        requested_scope = action_data.get("scope", "AUTO")
        targets, scope = resolve_target_scope(target_ref, requested_scope)

        if not targets:
            return {"action": "DELETE_OBJECT", "success": False, "error": f"Target '{target_ref}' not found"}

        names = [o.name for o in targets]
        for obj in targets:
            mesh = obj.data if obj.type == 'MESH' else None
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh and mesh.users == 0:
                bpy.data.meshes.remove(mesh)

        bpy.context.view_layer.update()
        return {"action": "DELETE_OBJECT", "success": True, "scope": scope, "deleted_targets": names}

    @staticmethod
    def execute_group(action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Explicitly links a set of objects into a logical group with hierarchy."""
        obj_names = action_data.get("objects", [])
        group_name = action_data.get("group_name", "Assembly")
        group_id = action_data.get("group_id") or f"grp_{uuid.uuid4().hex[:6]}"
        root_name = action_data.get("root")

        objects = [find_target_object(n) for n in obj_names if find_target_object(n)]
        if not objects:
            return {"action": "GROUP_OBJECTS", "success": False, "error": "No matching objects found to group"}

        root_obj = find_target_object(root_name) if root_name else objects[0]

        for obj in objects:
            obj["group_id"] = group_id
            obj["group_name"] = group_name
            obj["is_root"] = (obj == root_obj)

            if obj != root_obj:
                obj.parent = root_obj
                obj.matrix_parent_inverse = root_obj.matrix_world.inverted()

        bpy.context.view_layer.update()
        return {
            "action": "GROUP_OBJECTS",
            "success": True,
            "group_id": group_id,
            "group_name": group_name,
            "root": root_obj.name,
            "objects": [o.name for o in objects]
        }


def export_scene_state() -> Dict[str, Any]:
    """Inspects the live Blender scene and returns structured representation including groups and bounding boxes."""
    objects_list = []
    groups_dict = {}

    for obj in bpy.data.objects:
        if obj.type in ('MESH', 'CURVE', 'FONT'):
            mat_info = None
            if hasattr(obj.data, "materials") and obj.data.materials and obj.data.materials[0]:
                mat = obj.data.materials[0]
                mat_info = {"name": mat.name}
                if mat.use_nodes and mat.node_tree:
                    bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                    if bsdf:
                        color = list(bsdf.inputs['Base Color'].default_value)
                        metallic = bsdf.inputs['Metallic'].default_value
                        roughness = bsdf.inputs['Roughness'].default_value
                        mat_info.update({
                            "color": [round(c, 3) for c in color],
                            "metallic": round(metallic, 2),
                            "roughness": round(roughness, 2)
                        })

            b = get_object_world_bounds(obj)
            bbox_dict = {
                "min": [round(b["min"].x, 3), round(b["min"].y, 3), round(b["min"].z, 3)],
                "max": [round(b["max"].x, 3), round(b["max"].y, 3), round(b["max"].z, 3)],
                "center": [round(b["center"].x, 3), round(b["center"].y, 3), round(b["center"].z, 3)],
                "size": [round(b["size"].x, 3), round(b["size"].y, 3), round(b["size"].z, 3)]
            }

            gid = obj.get("group_id")
            gname = obj.get("group_name")
            is_root = bool(obj.get("is_root", False))

            obj_data = {
                "id": obj.get("ai_id") or obj.name,
                "name": obj.name,
                "type": obj.get("geom_type", "PRIMITIVE"),
                "group_id": gid,
                "group_name": gname,
                "is_root": is_root,
                "parent": obj.parent.name if obj.parent else None,
                "position": [round(v, 4) for v in obj.location],
                "rotation": [round(math.degrees(v), 2) for v in obj.rotation_euler],
                "scale": [round(v, 4) for v in obj.scale],
                "dimensions": [round(v, 4) for v in obj.dimensions],
                "bounding_box": bbox_dict,
                "material": mat_info,
                "collection": obj.users_collection[0].name if obj.users_collection else "Main"
            }
            objects_list.append(obj_data)

            if gid:
                if gid not in groups_dict:
                    groups_dict[gid] = {
                        "group_id": gid,
                        "group_name": gname or "Assembly",
                        "objects": [],
                        "root": None
                    }
                groups_dict[gid]["objects"].append(obj.name)
                if is_root or not groups_dict[gid]["root"]:
                    groups_dict[gid]["root"] = obj.name

    return {
        "object_count": len(objects_list),
        "objects": objects_list,
        "groups": groups_dict
    }
