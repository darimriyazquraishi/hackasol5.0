"""
Spatial Reasoning & Bounding Box Calculation Engine for Blender 3.6.
Calculates world-space bounding boxes, hierarchical group bounds,
and precise non-intersecting relative placement for spatial relationships:
ON_TOP, UNDER, BEHIND, IN_FRONT_OF, BESIDE, LEFT_OF, RIGHT_OF, INSIDE, CENTERED.
"""
import math
from typing import Dict, Any, List, Tuple, Optional, Union

try:
    import bpy
    from mathutils import Vector, Matrix, Euler
except ImportError:
    bpy = None
    Vector = None
    Matrix = None
    Euler = None


def get_object_world_bounds(obj: "bpy.types.Object") -> Dict[str, Any]:
    """
    Computes exact world-space axis-aligned bounding box and key coordinates for an object.
    """
    matrix = obj.matrix_world
    bbox_corners = [matrix @ Vector(corner) for corner in obj.bound_box]

    min_x = min(v.x for v in bbox_corners)
    max_x = max(v.x for v in bbox_corners)
    min_y = min(v.y for v in bbox_corners)
    max_y = max(v.y for v in bbox_corners)
    min_z = min(v.z for v in bbox_corners)
    max_z = max(v.z for v in bbox_corners)

    min_v = Vector((min_x, min_y, min_z))
    max_v = Vector((max_x, max_y, max_z))
    center = (min_v + max_v) * 0.5
    size = max_v - min_v

    return {
        "min": min_v,
        "max": max_v,
        "center": center,
        "size": size,
        "top": max_z,
        "bottom": min_z,
        "left": min_x,
        "right": max_x,
        "front": min_y,  # In standard view: -Y is front
        "back": max_y,   # +Y is behind
    }


def get_group_world_bounds(objects: List["bpy.types.Object"]) -> Dict[str, Any]:
    """
    Computes collective world-space bounding box enclosing a list of objects.
    """
    mesh_objs = [o for o in objects if o.type == 'MESH']
    if not mesh_objs:
        if objects:
            loc = objects[0].location
            return {
                "min": Vector(loc),
                "max": Vector(loc),
                "center": Vector(loc),
                "size": Vector((0.1, 0.1, 0.1)),
                "top": loc.z, "bottom": loc.z,
                "left": loc.x, "right": loc.x,
                "front": loc.y, "back": loc.y
            }
        return {
            "min": Vector((0, 0, 0)), "max": Vector((0, 0, 0)),
            "center": Vector((0, 0, 0)), "size": Vector((0, 0, 0)),
            "top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0,
            "front": 0.0, "back": 0.0
        }

    min_x = float('inf')
    max_x = float('-inf')
    min_y = float('inf')
    max_y = float('-inf')
    min_z = float('inf')
    max_z = float('-inf')

    for obj in mesh_objs:
        b = get_object_world_bounds(obj)
        min_x = min(min_x, b["min"].x)
        max_x = max(max_x, b["max"].x)
        min_y = min(min_y, b["min"].y)
        max_y = max(max_y, b["max"].y)
        min_z = min(min_z, b["min"].z)
        max_z = max(max_z, b["max"].z)

    min_v = Vector((min_x, min_y, min_z))
    max_v = Vector((max_x, max_y, max_z))
    center = (min_v + max_v) * 0.5
    size = max_v - min_v

    return {
        "min": min_v,
        "max": max_v,
        "center": center,
        "size": size,
        "top": max_z,
        "bottom": min_z,
        "left": min_x,
        "right": max_x,
        "front": min_y,
        "back": max_y
    }


def calculate_spatial_placement(
    target_bounds: Dict[str, Any],
    ref_bounds: Dict[str, Any],
    relation: str,
    gap: float = 0.0,
    alignment: str = "CENTER"
) -> Vector:
    """
    Calculates the exact world-space center coordinate for target_bounds
    to satisfy the spatial relation relative to ref_bounds without intersecting or floating.
    """
    rel = relation.upper().strip().replace(" ", "_").replace("-", "_")
    t_size = target_bounds["size"]
    r_center = ref_bounds["center"]

    half_x = t_size.x * 0.5
    half_y = t_size.y * 0.5
    half_z = t_size.z * 0.5

    # Default to reference center
    new_x = r_center.x
    new_y = r_center.y
    new_z = r_center.z

    if rel in ("ON_TOP", "ON_TOP_OF", "ABOVE", "ATOP"):
        # Target bottom rests flush on Reference top + gap
        new_z = ref_bounds["top"] + half_z + gap
        new_x = r_center.x
        new_y = r_center.y

    elif rel in ("UNDER", "UNDERNEATH", "BELOW", "BENEATH"):
        # For under-desk/table placement:
        # If reference is a high surface (like table top), place on ground (z = half_z)
        # under the table center, or flush below the underside
        if ref_bounds["bottom"] > t_size.z:
            # Fits underneath on the ground level
            new_z = max(0.0, target_bounds["min"].z) + half_z
            new_x = r_center.x
            new_y = r_center.y
        else:
            new_z = ref_bounds["bottom"] - half_z - gap
            new_x = r_center.x
            new_y = r_center.y

    elif rel in ("BEHIND", "IN_BACK_OF", "BACK"):
        # In standard view, -Y is front, +Y is back/behind
        new_y = ref_bounds["back"] + half_y + gap
        new_x = r_center.x
        # Rest on same base elevation (e.g. tabletop or floor)
        new_z = ref_bounds["bottom"] + half_z

    elif rel in ("IN_FRONT_OF", "IN_FRONT", "FRONT", "BEFORE"):
        # In front of: towards -Y
        new_y = ref_bounds["front"] - half_y - gap
        new_x = r_center.x
        new_z = ref_bounds["bottom"] + half_z

    elif rel in ("BESIDE", "NEXT_TO", "ALONGSIDE", "ADJACENT"):
        # Place to the side (+X or right of reference by default)
        new_x = ref_bounds["right"] + half_x + gap
        new_y = r_center.y
        new_z = ref_bounds["bottom"] + half_z

    elif rel in ("LEFT_OF", "LEFT"):
        # Towards -X
        new_x = ref_bounds["left"] - half_x - gap
        new_y = r_center.y
        new_z = ref_bounds["bottom"] + half_z

    elif rel in ("RIGHT_OF", "RIGHT"):
        # Towards +X
        new_x = ref_bounds["right"] + half_x + gap
        new_y = r_center.y
        new_z = ref_bounds["bottom"] + half_z

    elif rel in ("INSIDE", "WITHIN", "CENTER_OF", "CONCENTRIC"):
        new_x = r_center.x
        new_y = r_center.y
        new_z = r_center.z

    return Vector((new_x, new_y, new_z))
