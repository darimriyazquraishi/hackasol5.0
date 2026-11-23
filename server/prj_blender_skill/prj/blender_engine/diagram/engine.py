"""
Technical Diagram & Engineering Schematic Engine for Blender 3.6.
Generates 2D/3D technical schematics, P&ID diagrams, flowcharts, pipelines,
standard engineering symbols (valves, pumps, instruments, vessels),
directional flow arrows, and 3D extruded vector text labels.
"""
import math
import uuid
from typing import Dict, Any, List, Tuple, Optional

try:
    import bpy
    from mathutils import Vector, Euler, Matrix
except ImportError:
    bpy = None
    Vector = None
    Euler = None
    Matrix = None

from blender_engine.components.manager import assign_to_collection
from blender_engine.materials.pbr import create_pbr_material, assign_material_to_object


def create_diagram_material(name: str, color_rgba: List[float], metallic: float = 0.1, roughness: float = 0.4, emission: float = 0.0) -> "bpy.types.Material":
    """Creates a clean PBR or emission material for technical schematics."""
    mat_data = {
        "name": name,
        "color": color_rgba,
        "metallic": metallic,
        "roughness": roughness
    }
    if emission > 0.0:
        mat_data["emission_color"] = color_rgba
        mat_data["emission_strength"] = emission
    return create_pbr_material(mat_data)


def create_text_label(
    name: str,
    text: str,
    position: List[float],
    size: float = 0.22,
    color_rgba: List[float] = [0.95, 0.95, 0.98, 1.0],
    rotation: List[float] = [0.0, 0.0, 0.0],
    align_x: str = 'CENTER',
    align_y: str = 'CENTER',
    extrude: float = 0.015,
    collection: str = "Labels"
) -> "bpy.types.Object":
    """Creates an extruded 3D text label in the Blender scene."""
    text_data = bpy.data.curves.new(name=f"TextData_{name}", type='FONT')
    text_data.body = str(text)
    text_data.size = size
    text_data.extrude = extrude
    text_data.align_x = align_x
    text_data.align_y = align_y

    obj = bpy.data.objects.new(name=name, object_data=text_data)
    obj.location = Vector(position)
    obj.rotation_euler = Euler((math.radians(rotation[0]), math.radians(rotation[1]), math.radians(rotation[2])), 'XYZ')
    obj["ai_id"] = f"label_{uuid.uuid4().hex[:6]}"
    obj["geom_type"] = "TEXT_LABEL"

    mat = create_diagram_material(f"Mat_{name}_Text", color_rgba, metallic=0.0, roughness=0.2, emission=1.2)
    assign_material_to_object(obj, mat)

    assign_to_collection(obj, collection)
    bpy.context.view_layer.update()
    return obj


def create_pipeline(
    name: str,
    points: List[List[float]],
    radius: float = 0.035,
    color_rgba: List[float] = [0.2, 0.65, 0.95, 1.0],
    is_signal: bool = False,
    collection: str = "Pipelines"
) -> "bpy.types.Object":
    """
    Creates a beveled 3D polyline pipeline or dashed signal line.
    """
    if len(points) < 2:
        return None

    curve_data = bpy.data.curves.new(name=f"CurveData_{name}", type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.bevel_depth = 0.012 if is_signal else radius
    curve_data.bevel_resolution = 4

    spline = curve_data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for i, pt in enumerate(points):
        spline.points[i].co = (pt[0], pt[1], pt[2], 1.0)

    obj = bpy.data.objects.new(name=name, object_data=curve_data)
    obj["ai_id"] = f"pipe_{uuid.uuid4().hex[:6]}"
    obj["geom_type"] = "SIGNAL_LINE" if is_signal else "PIPELINE"

    mat_color = [0.95, 0.70, 0.15, 1.0] if is_signal else color_rgba
    emission_val = 1.8 if is_signal else 0.4
    mat = create_diagram_material(f"Mat_{name}", mat_color, metallic=0.8 if not is_signal else 0.0, roughness=0.3, emission=emission_val)
    assign_material_to_object(obj, mat)

    assign_to_collection(obj, collection)
    bpy.context.view_layer.update()
    return obj


def create_flow_arrow(
    name: str,
    position: List[float],
    direction: List[float] = [1.0, 0.0, 0.0],
    length: float = 0.28,
    radius: float = 0.10,
    color_rgba: List[float] = [0.1, 0.85, 0.35, 1.0],
    collection: str = "Flow_Arrows"
) -> "bpy.types.Object":
    """Creates a 3D directional arrow pointing along the pipeline flow direction."""
    dir_vec = Vector(direction).normalized()
    if dir_vec.length < 0.001:
        dir_vec = Vector((1.0, 0.0, 0.0))

    bpy.ops.mesh.primitive_cone_add(
        vertices=16,
        radius1=radius,
        radius2=0.0,
        depth=length,
        location=position
    )
    obj = bpy.context.active_object
    obj.name = name
    obj["ai_id"] = f"arrow_{uuid.uuid4().hex[:6]}"
    obj["geom_type"] = "FLOW_ARROW"

    # Aim cone along direction vector (+Z cone tip points along dir_vec)
    rot_quat = Vector((0.0, 0.0, 1.0)).rotation_difference(dir_vec)
    obj.rotation_euler = rot_quat.to_euler()

    mat = create_diagram_material(f"Mat_{name}", color_rgba, metallic=0.1, roughness=0.3, emission=1.5)
    assign_material_to_object(obj, mat)

    assign_to_collection(obj, collection)
    bpy.context.view_layer.update()
    return obj


def create_valve_symbol(
    name: str,
    position: List[float],
    valve_type: str = "GATE",
    size: float = 0.26,
    rotation_z: float = 0.0,
    color_rgba: List[float] = [0.95, 0.45, 0.15, 1.0],
    tag: str = "",
    collection: str = "Valves"
) -> List["bpy.types.Object"]:
    """
    Creates standard P&ID bowtie valve symbol with stem, handle or control diaphragm.
    """
    created = []
    v_type = valve_type.upper()

    # Left triangle cone
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=size * 0.5, depth=size, location=position)
    left_cone = bpy.context.active_object
    left_cone.name = f"{name}_Cone_Left"
    left_cone.rotation_euler = Euler((0.0, math.radians(90), math.radians(rotation_z)), 'XYZ')
    left_cone.location.x += -size * 0.4
    created.append(left_cone)

    # Right triangle cone
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=size * 0.5, depth=size, location=position)
    right_cone = bpy.context.active_object
    right_cone.name = f"{name}_Cone_Right"
    right_cone.rotation_euler = Euler((0.0, math.radians(-90), math.radians(rotation_z)), 'XYZ')
    right_cone.location.x += size * 0.4
    created.append(right_cone)

    # Valve Stem & Handle / Actuator
    if "CONTROL" in v_type:
        # Diaphragm actuator dome
        bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.08, depth=size * 0.6, location=[position[0], position[1], position[2] + size * 0.4])
        stem = bpy.context.active_object
        stem.name = f"{name}_Stem"
        created.append(stem)

        bpy.ops.mesh.primitive_uv_sphere_add(radius=size * 0.35, location=[position[0], position[1], position[2] + size * 0.8])
        dome = bpy.context.active_object
        dome.name = f"{name}_Actuator"
        dome.scale.z = 0.5
        created.append(dome)
    elif "CHECK" in v_type:
        # Check valve / non-return valve disc
        bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.4, depth=0.03, location=position)
        disc = bpy.context.active_object
        disc.name = f"{name}_CheckDisc"
        created.append(disc)
    else:
        # Standard handwheel stem
        bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.06, depth=size * 0.5, location=[position[0], position[1], position[2] + size * 0.35])
        stem = bpy.context.active_object
        stem.name = f"{name}_Stem"
        created.append(stem)

        bpy.ops.mesh.primitive_torus_add(major_radius=size * 0.22, minor_radius=0.02, location=[position[0], position[1], position[2] + size * 0.6])
        wheel = bpy.context.active_object
        wheel.name = f"{name}_Wheel"
        created.append(wheel)

    # Apply material
    mat = create_diagram_material(f"Mat_{name}", color_rgba, metallic=0.7, roughness=0.3)
    for o in created:
        o["group_name"] = "Valve"
        o["ai_id"] = f"valve_{uuid.uuid4().hex[:6]}"
        assign_material_to_object(o, mat)
        assign_to_collection(o, collection)

    # Add tag label if provided
    if tag:
        lbl = create_text_label(f"Tag_{name}", tag, [position[0], position[1], position[2] + size * 1.1], size=0.18, color_rgba=[1.0, 0.9, 0.3, 1.0])
        created.append(lbl)

    bpy.context.view_layer.update()
    return created


def create_pump_symbol(
    name: str,
    position: List[float],
    size: float = 0.65,
    tag: str = "P-101",
    subtext: str = "Centrifugal Pump",
    color_rgba: List[float] = [0.25, 0.75, 0.95, 1.0],
    collection: str = "Equipment"
) -> List["bpy.types.Object"]:
    """
    Creates standard P&ID centrifugal pump symbol: cylindrical casing, tangential nozzle, base, and label.
    """
    created = []
    # 1. Pump casing circle
    bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.5, depth=0.15, location=position)
    casing = bpy.context.active_object
    casing.name = f"{name}_Casing"
    created.append(casing)

    # 2. Tangential discharge nozzle triangle
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=size * 0.45, depth=0.15, location=[position[0] + size * 0.18, position[1], position[2] + size * 0.35])
    nozzle = bpy.context.active_object
    nozzle.name = f"{name}_Nozzle"
    nozzle.rotation_euler = Euler((0.0, 0.0, math.radians(-30)), 'XYZ')
    created.append(nozzle)

    # 3. Base support
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=[position[0], position[1], position[2] - size * 0.55])
    base = bpy.context.active_object
    base.name = f"{name}_Base"
    base.scale = Vector((size * 0.9, 0.2, 0.12))
    created.append(base)

    mat = create_diagram_material(f"Mat_{name}", color_rgba, metallic=0.8, roughness=0.25)
    for o in created:
        o["group_name"] = "Pumps"
        o["ai_id"] = f"pump_{uuid.uuid4().hex[:6]}"
        assign_material_to_object(o, mat)
        assign_to_collection(o, collection)

    # Text tags
    tag_obj = create_text_label(f"Tag_{name}", tag, [position[0], position[1], position[2] - size * 0.9], size=0.22, color_rgba=[1.0, 1.0, 1.0, 1.0])
    created.append(tag_obj)
    if subtext:
        sub_obj = create_text_label(f"Sub_{name}", subtext, [position[0], position[1], position[2] - size * 1.25], size=0.15, color_rgba=[0.75, 0.85, 0.95, 1.0])
        created.append(sub_obj)

    bpy.context.view_layer.update()
    return created


def create_vessel_symbol(
    name: str,
    position: List[float],
    width: float = 2.4,
    height: float = 3.6,
    tag: str = "TK-101",
    subtext: str = "Water Storage Tank",
    color_rgba: List[float] = [0.35, 0.55, 0.85, 1.0],
    collection: str = "Equipment"
) -> List["bpy.types.Object"]:
    """
    Creates an industrial vertical tank vessel with dished heads, nozzles, and level indicator.
    """
    created = []
    # 1. Main vessel cylinder
    bpy.ops.mesh.primitive_cylinder_add(radius=width * 0.5, depth=height * 0.7, location=[position[0], position[1], position[2]])
    shell = bpy.context.active_object
    shell.name = f"{name}_Shell"
    created.append(shell)

    # 2. Top dished head (elliptical dome)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=width * 0.5, location=[position[0], position[1], position[2] + height * 0.35])
    top_head = bpy.context.active_object
    top_head.name = f"{name}_TopHead"
    top_head.scale.z = 0.35
    created.append(top_head)

    # 3. Bottom head
    bpy.ops.mesh.primitive_uv_sphere_add(radius=width * 0.5, location=[position[0], position[1], position[2] - height * 0.35])
    bot_head = bpy.context.active_object
    bot_head.name = f"{name}_BottomHead"
    bot_head.scale.z = 0.35
    created.append(bot_head)

    # 4. Level indicator sight glass line
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=height * 0.5, location=[position[0] + width * 0.55, position[1], position[2]])
    glass = bpy.context.active_object
    glass.name = f"{name}_LevelGauge"
    created.append(glass)

    mat_tank = create_diagram_material(f"Mat_{name}", color_rgba, metallic=0.5, roughness=0.35)
    mat_gauge = create_diagram_material(f"Mat_{name}_Gauge", [0.0, 0.9, 1.0, 1.0], metallic=0.1, roughness=0.1, emission=2.0)

    for o in created[:3]:
        o["group_name"] = "Vessels"
        o["ai_id"] = f"vessel_{uuid.uuid4().hex[:6]}"
        assign_material_to_object(o, mat_tank)
        assign_to_collection(o, collection)

    assign_material_to_object(glass, mat_gauge)
    assign_to_collection(glass, collection)

    # Vessel identification text
    tag_lbl = create_text_label(f"Tag_{name}", tag, [position[0], position[1], position[2] + 0.3], size=0.28, color_rgba=[1.0, 1.0, 1.0, 1.0])
    sub_lbl = create_text_label(f"Sub_{name}", subtext, [position[0], position[1], position[2] - 0.2], size=0.18, color_rgba=[0.8, 0.9, 1.0, 1.0])
    created.extend([tag_lbl, sub_lbl])

    bpy.context.view_layer.update()
    return created


def create_instrument_balloon(
    name: str,
    tag: str,
    position: List[float],
    size: float = 0.45,
    subtext: str = "",
    color_rgba: List[float] = [0.95, 0.85, 0.15, 1.0],
    collection: str = "Instruments"
) -> List["bpy.types.Object"]:
    """
    Creates standard ISA-5.1 circular instrument balloon (e.g. PT-101, FT-101).
    """
    created = []
    # 1. Circle disc
    bpy.ops.mesh.primitive_cylinder_add(radius=size * 0.5, depth=0.04, location=position)
    disc = bpy.context.active_object
    disc.name = f"{name}_Disc"
    created.append(disc)

    # 2. Outer ring border
    bpy.ops.mesh.primitive_torus_add(major_radius=size * 0.5, minor_radius=0.02, location=position)
    ring = bpy.context.active_object
    ring.name = f"{name}_Ring"
    created.append(ring)

    mat_disc = create_diagram_material(f"Mat_{name}_Disc", [0.08, 0.09, 0.12, 1.0], metallic=0.1, roughness=0.5)
    mat_ring = create_diagram_material(f"Mat_{name}_Ring", color_rgba, metallic=0.8, roughness=0.2, emission=1.0)
    assign_material_to_object(disc, mat_disc)
    assign_material_to_object(ring, mat_ring)

    for o in [disc, ring]:
        o["group_name"] = "Instruments"
        o["ai_id"] = f"inst_{uuid.uuid4().hex[:6]}"
        assign_to_collection(o, collection)

    # Tag inside circle
    tag_lbl = create_text_label(f"Tag_{name}", tag, [position[0], position[1], position[2] + 0.04], size=0.16, color_rgba=color_rgba)
    created.append(tag_lbl)

    if subtext:
        sub_lbl = create_text_label(f"Sub_{name}", subtext, [position[0], position[1], position[2] - size * 0.7], size=0.14, color_rgba=[0.8, 0.8, 0.8, 1.0])
        created.append(sub_lbl)

    bpy.context.view_layer.update()
    return created


def create_controller_symbol(
    name: str,
    tag: str = "PLC-100",
    position: List[float] = [0.0, 0.0, 0.0],
    width: float = 1.4,
    height: float = 1.0,
    color_rgba: List[float] = [0.95, 0.25, 0.35, 1.0],
    collection: str = "Control_Systems"
) -> List["bpy.types.Object"]:
    """
    Creates a PLC/DCS controller block with terminal indicator lights and labels.
    """
    created = []
    # 1. Beveled main controller box
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=position)
    box = bpy.context.active_object
    box.name = f"{name}_Box"
    box.scale = Vector((width, 0.15, height))
    created.append(box)

    mat = create_diagram_material(f"Mat_{name}_PLC", [0.12, 0.14, 0.18, 1.0], metallic=0.7, roughness=0.3)
    assign_material_to_object(box, mat)
    assign_to_collection(box, collection)

    # Header bar
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=[position[0], position[1], position[2] + height * 0.4])
    bar = bpy.context.active_object
    bar.name = f"{name}_Bar"
    bar.scale = Vector((width * 0.96, 0.16, 0.12))
    mat_bar = create_diagram_material(f"Mat_{name}_Bar", color_rgba, metallic=0.2, roughness=0.3, emission=1.0)
    assign_material_to_object(bar, mat_bar)
    assign_to_collection(bar, collection)
    created.append(bar)

    # Tag and label
    tag_lbl = create_text_label(f"Tag_{name}", tag, [position[0], position[1], position[2] + 0.05], size=0.22, color_rgba=[1.0, 1.0, 1.0, 1.0])
    sub_lbl = create_text_label(f"Sub_{name}", "AUTOMATION CONTROLLER", [position[0], position[1], position[2] - 0.25], size=0.12, color_rgba=[0.75, 0.85, 1.0, 1.0])
    created.extend([tag_lbl, sub_lbl])

    bpy.context.view_layer.update()
    return created


def create_legend_and_title_block(
    title: str = "INDUSTRIAL WATER PUMPING SYSTEM - P&ID",
    legend_items: Optional[List[Tuple[str, str]]] = None,
    position: List[float] = [0.0, 0.0, -3.2]
) -> List["bpy.types.Object"]:
    """
    Constructs a clean technical drawing title block, frame border and symbol legend.
    """
    created = []
    # Title Text
    t_obj = create_text_label("Diagram_Main_Title", title, [position[0], position[1], position[2] + 6.8], size=0.34, color_rgba=[1.0, 0.95, 0.5, 1.0])
    created.append(t_obj)

    sub_obj = create_text_label("Diagram_Sub_Title", "STANDARD PIPING & INSTRUMENTATION SCHEMATIC (ISA-5.1)", [position[0], position[1], position[2] + 6.35], size=0.18, color_rgba=[0.7, 0.85, 1.0, 1.0])
    created.append(sub_obj)

    # Legend text items
    if legend_items:
        start_x = -4.5
        y_pos = position[2] - 0.5
        for i, (sym_name, desc) in enumerate(legend_items):
            x_pos = start_x + (i * 2.8)
            lbl = create_text_label(f"Legend_{i}", f"{sym_name}: {desc}", [x_pos, position[1], y_pos], size=0.14, color_rgba=[0.8, 0.85, 0.9, 1.0])
            created.append(lbl)

    return created
