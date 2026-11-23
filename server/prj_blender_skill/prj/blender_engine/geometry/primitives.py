"""
Primitive geometry generator for Blender 3.6.
Executes within Blender Python environment.
"""
import math
from typing import List, Tuple

try:
    import bpy
    import bmesh
    from mathutils import Vector, Euler
except ImportError:
    pass


def create_primitive(
    primitive_type: str,
    name: str,
    dimensions: List[float],
    position: List[float] = None,
    rotation: List[float] = None,
) -> "bpy.types.Object":
    """
    Creates a basic geometric primitive, scaled to exact dimensions [dx, dy, dz].
    """
    p_type = primitive_type.upper()
    pos = Vector(position) if position else Vector((0.0, 0.0, 0.0))
    rot = Euler([math.radians(r) for r in (rotation or [0.0, 0.0, 0.0])], 'XYZ')
    dx, dy, dz = dimensions[0], dimensions[1], dimensions[2]

    if p_type == "CUBE" or p_type == "BOX":
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, rotation=rot)
        obj = bpy.context.active_object
        obj.scale = Vector((dx, dy, dz))

    elif p_type == "CYLINDER":
        radius = max(dx, dy) / 2.0
        depth = dz
        bpy.ops.mesh.primitive_cylinder_add(
            radius=radius,
            depth=depth,
            vertices=32,
            location=pos,
            rotation=rot
        )
        obj = bpy.context.active_object

    elif p_type == "SPHERE" or p_type == "UVSPHERE":
        radius = max(dx, dy, dz) / 2.0
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=radius,
            segments=32,
            ring_count=16,
            location=pos,
            rotation=rot
        )
        obj = bpy.context.active_object
        obj.scale = Vector((dx / (2 * radius), dy / (2 * radius), dz / (2 * radius)))

    elif p_type == "CONE":
        radius1 = max(dx, dy) / 2.0
        depth = dz
        bpy.ops.mesh.primitive_cone_add(
            radius1=radius1,
            depth=depth,
            vertices=32,
            location=pos,
            rotation=rot
        )
        obj = bpy.context.active_object

    elif p_type == "TORUS":
        major_r = max(dx, dy) / 2.0
        minor_r = dz / 2.0
        bpy.ops.mesh.primitive_torus_add(
            major_radius=major_r,
            minor_radius=minor_r,
            location=pos,
            rotation=rot
        )
        obj = bpy.context.active_object

    elif p_type == "PLANE":
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=pos, rotation=rot)
        obj = bpy.context.active_object
        obj.scale = Vector((dx, dy, 1.0))

    else:
        # Default fallback to cube
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, rotation=rot)
        obj = bpy.context.active_object
        obj.scale = Vector((dx, dy, dz))

    # Apply scale to freeze dimensions into mesh data
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.name = name
    return obj
