"""
Modifier pipeline manager for Blender 3.6.
"""
import math
from typing import Dict, Any, List

try:
    import bpy
except ImportError:
    pass


def apply_modifier_dict(obj: "bpy.types.Object", mod_data: Dict[str, Any]):
    """Applies a single modifier configuration dictionary to a Blender object."""
    mod_type = mod_data.get("type", "").upper()

    if mod_type == "BEVEL":
        mod = obj.modifiers.new(name="Bevel", type='BEVEL')
        mod.width = float(mod_data.get("width", 0.02))
        mod.segments = int(mod_data.get("segments", 3))
        limit_m = mod_data.get("limit_method", "ANGLE").upper()
        if limit_m in ['NONE', 'ANGLE', 'WEIGHT', 'VGROUP']:
            mod.limit_method = limit_m
        if mod.limit_method == 'ANGLE':
            mod.angle_limit = math.radians(float(mod_data.get("angle_limit", 35.0)))

    elif mod_type in ["SUBSURF", "SUBDIVISION"]:
        mod = obj.modifiers.new(name="Subsurf", type='SUBSURF')
        mod.levels = int(mod_data.get("levels", 1))
        mod.render_levels = int(mod_data.get("render_levels", 2))

    elif mod_type == "SOLIDIFY":
        mod = obj.modifiers.new(name="Solidify", type='SOLIDIFY')
        mod.thickness = float(mod_data.get("thickness", 0.01))
        mod.offset = float(mod_data.get("offset", -1.0))

    elif mod_type == "MIRROR":
        mod = obj.modifiers.new(name="Mirror", type='MIRROR')
        axis = mod_data.get("use_axis", [True, False, False])
        mod.use_axis[0] = bool(axis[0])
        mod.use_axis[1] = bool(axis[1]) if len(axis) > 1 else False
        mod.use_axis[2] = bool(axis[2]) if len(axis) > 2 else False

    elif mod_type == "ARRAY":
        mod = obj.modifiers.new(name="Array", type='ARRAY')
        mod.count = int(mod_data.get("count", 2))
        offset = mod_data.get("relative_offset_displace", [1.0, 0.0, 0.0])
        mod.relative_offset_displace[0] = float(offset[0])
        mod.relative_offset_displace[1] = float(offset[1]) if len(offset) > 1 else 0.0
        mod.relative_offset_displace[2] = float(offset[2]) if len(offset) > 2 else 0.0

    elif mod_type == "BOOLEAN":
        target_name = mod_data.get("object")
        operation = mod_data.get("operation", "DIFFERENCE").upper()
        if target_name and target_name in bpy.data.objects:
            mod = obj.modifiers.new(name="Boolean", type='BOOLEAN')
            mod.object = bpy.data.objects[target_name]
            if operation in ['DIFFERENCE', 'UNION', 'INTERSECT']:
                mod.operation = operation


def apply_modifiers(obj: "bpy.types.Object", modifiers_list: List[Dict[str, Any]]):
    """Applies a sequence of modifiers to the object."""
    if not modifiers_list:
        return
    for mod_data in modifiers_list:
        try:
            apply_modifier_dict(obj, mod_data)
        except Exception as e:
            print(f"[Warning] Failed to apply modifier {mod_data.get('type')} on {obj.name}: {e}")
