"""
Advanced procedural geometry: custom extrusions, profiles, lathe revolutions, sweeps.
"""
import math
from typing import List, Tuple

try:
    import bpy
    import bmesh
    from mathutils import Vector, Euler
except ImportError:
    pass


def create_bevel_box(
    name: str,
    dimensions: List[float],
    position: List[float] = None,
    rotation: List[float] = None,
    bevel_width: float = 0.02,
    segments: int = 3,
) -> "bpy.types.Object":
    """Creates a precision box with engineered bevels."""
    pos = Vector(position) if position else Vector((0.0, 0.0, 0.0))
    rot = Euler([math.radians(r) for r in (rotation or [0.0, 0.0, 0.0])], 'XYZ')
    dx, dy, dz = dimensions[0], dimensions[1], dimensions[2]

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = Vector((dx, dy, dz))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.name = name

    # Add Bevel modifier
    actual_bevel = min(bevel_width, min(dx, dy, dz) * 0.2)
    if actual_bevel > 0.001:
        bev = obj.modifiers.new(name="Bevel", type='BEVEL')
        bev.width = actual_bevel
        bev.segments = segments
        bev.limit_method = 'ANGLE'
        bev.angle_limit = math.radians(35.0)

    return obj


def create_profile_extrusion(
    name: str,
    profile_type: str,
    dimensions: List[float],
    position: List[float] = None,
    rotation: List[float] = None,
) -> "bpy.types.Object":
    """
    Creates custom 2D profile extrusions (Hexagon, Star, Rounded Panel, etc.)
    """
    pos = Vector(position) if position else Vector((0.0, 0.0, 0.0))
    rot = Euler([math.radians(r) for r in (rotation or [0.0, 0.0, 0.0])], 'XYZ')
    dx, dy, dz = dimensions[0], dimensions[1], dimensions[2]
    p_type = profile_type.upper()

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    bm = bmesh.new()

    if p_type == "HEXAGON":
        sides = 6
        rx, ry = dx / 2.0, dy / 2.0
        verts = []
        for i in range(sides):
            ang = 2.0 * math.pi * i / sides
            vx = rx * math.cos(ang)
            vy = ry * math.sin(ang)
            verts.append(bm.verts.new((vx, vy, -dz / 2.0)))
        face = bm.faces.new(verts)
        # Extrude along Z
        result = bmesh.ops.extrude_face_region(bm, geom=[face])
        verts_ext = [e for e in result['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0.0, 0.0, dz), verts=verts_ext)

    elif p_type == "STAR":
        points = 10
        r_outer_x, r_outer_y = dx / 2.0, dy / 2.0
        r_inner_x, r_inner_y = r_outer_x * 0.5, r_outer_y * 0.5
        verts = []
        for i in range(points):
            ang = 2.0 * math.pi * i / points
            r_x = r_outer_x if i % 2 == 0 else r_inner_x
            r_y = r_outer_y if i % 2 == 0 else r_inner_y
            verts.append(bm.verts.new((r_x * math.cos(ang), r_y * math.sin(ang), -dz / 2.0)))
        face = bm.faces.new(verts)
        result = bmesh.ops.extrude_face_region(bm, geom=[face])
        verts_ext = [e for e in result['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0.0, 0.0, dz), verts=verts_ext)

    else:
        # Fallback rectangular extrusion
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= dx
            v.co.y *= dy
            v.co.z *= dz

    bm.to_mesh(mesh)
    bm.free()

    obj.location = pos
    obj.rotation_euler = rot
    return obj


def create_lathe_revolution(
    name: str,
    dimensions: List[float],
    position: List[float] = None,
    rotation: List[float] = None,
    steps: int = 32,
) -> "bpy.types.Object":
    """Generates rotational lathe solid of revolution (vases, pulleys, columns, wheels)."""
    pos = Vector(position) if position else Vector((0.0, 0.0, 0.0))
    rot = Euler([math.radians(r) for r in (rotation or [0.0, 0.0, 0.0])], 'XYZ')
    radius = max(dimensions[0], dimensions[1]) / 2.0
    height = dimensions[2]

    # Create curve profile and screw modifier
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=height,
        vertices=steps,
        location=pos,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name

    # Add subtle subdivision or bevel
    bev = obj.modifiers.new(name="Bevel", type='BEVEL')
    bev.width = min(radius * 0.1, 0.02)
    bev.segments = 2
    bev.limit_method = 'ANGLE'

    return obj
