"""
Component placement, hierarchical alignment, and scene collection management.
"""
from typing import Dict, Any, List

try:
    import bpy
    from mathutils import Vector
except ImportError:
    pass


def get_bounding_box_world(obj: "bpy.types.Object"):
    """Returns world-space min and max bounds for an object."""
    bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_x = min(v.x for v in bbox)
    max_x = max(v.x for v in bbox)
    min_y = min(v.y for v in bbox)
    max_y = max(v.y for v in bbox)
    min_z = min(v.z for v in bbox)
    max_z = max(v.z for v in bbox)
    return Vector((min_x, min_y, min_z)), Vector((max_x, max_y, max_z))


def resolve_relative_position(
    obj: "bpy.types.Object",
    target_obj: "bpy.types.Object",
    relation: str,
    gap: float = 0.0,
):
    """
    Adjusts obj position relative to target_obj.
    Supported relations: ON_TOP, UNDER, CENTER_OF, COAXIAL, INSIDE, ADJACENT_X, ADJACENT_Y
    """
    bpy.context.view_layer.update()
    t_min, t_max = get_bounding_box_world(target_obj)
    o_min, o_max = get_bounding_box_world(obj)

    t_center = (t_min + t_max) * 0.5
    o_center = (o_min + o_max) * 0.5
    o_dim = o_max - o_min

    rel = relation.upper()

    if rel == "ON_TOP":
        # Place directly on top surface along Z
        new_z = t_max.z + (o_dim.z * 0.5) + gap
        obj.location.x = t_center.x
        obj.location.y = t_center.y
        obj.location.z = new_z

    elif rel == "UNDER":
        new_z = t_min.z - (o_dim.z * 0.5) - gap
        obj.location.x = t_center.x
        obj.location.y = t_center.y
        obj.location.z = new_z

    elif rel == "CENTER_OF":
        obj.location.x = t_center.x
        obj.location.y = t_center.y
        obj.location.z = t_center.z

    elif rel == "COAXIAL":
        obj.location.x = t_center.x
        obj.location.y = t_center.y

    elif rel == "INSIDE":
        obj.location = t_center

    elif rel == "ADJACENT_X":
        new_x = t_max.x + (o_dim.x * 0.5) + gap
        obj.location.x = new_x
        obj.location.y = t_center.y
        obj.location.z = t_center.z

    elif rel == "ADJACENT_Y":
        new_y = t_max.y + (o_dim.y * 0.5) + gap
        obj.location.x = t_center.x
        obj.location.y = new_y
        obj.location.z = t_center.z

    bpy.context.view_layer.update()


def assign_to_collection(obj: "bpy.types.Object", collection_name: str):
    """Assigns an object to a specific named collection, creating it if needed."""
    if not collection_name:
        collection_name = "Main"

    if collection_name in bpy.data.collections:
        col = bpy.data.collections[collection_name]
    else:
        col = bpy.data.collections.new(collection_name)
        bpy.context.scene.collection.children.link(col)

    # Remove from default scene collection if present
    if obj.name in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.unlink(obj)

    # Link to target collection if not already linked
    if obj.name not in col.objects:
        col.objects.link(obj)
