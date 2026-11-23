"""
PBR Material creation using Blender 3.6 Principled BSDF.
"""
from typing import Dict, Any, List

try:
    import bpy
except ImportError:
    pass


def create_pbr_material(mat_data: Dict[str, Any]) -> "bpy.types.Material":
    """
    Creates or configures a Principled BSDF material.
    Supports color, metallic, roughness, transmission (glass), and emission (RGB / LED).
    """
    name = mat_data.get("name", "PBR_Material")
    
    # Check if already exists
    if name in bpy.data.materials:
        mat = bpy.data.materials[name]
    else:
        mat = bpy.data.materials.new(name=name)

    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Find Principled BSDF node
    bsdf = None
    for n in nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bsdf = n
            break

    if not bsdf:
        bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
        output = nodes.get('Material Output') or nodes.new(type='ShaderNodeOutputMaterial')
        links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    # Base Color
    color = mat_data.get("color", [0.8, 0.8, 0.8, 1.0])
    if len(color) == 3:
        color = [color[0], color[1], color[2], 1.0]
    bsdf.inputs['Base Color'].default_value = tuple(color)

    # Metallic & Roughness
    metallic = float(mat_data.get("metallic", 0.0))
    roughness = float(mat_data.get("roughness", 0.4))
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness

    # Transmission (for Glass Panels, windshields, liquids)
    transmission = float(mat_data.get("transmission", 0.0))
    if 'Transmission Weight' in bsdf.inputs:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    elif 'Transmission' in bsdf.inputs:
        bsdf.inputs['Transmission'].default_value = transmission

    # If glass / transparent, set blend and shadow methods for EEVEE / Viewport
    if transmission > 0.05:
        if hasattr(mat, "blend_method"):
            mat.blend_method = 'BLEND'
        if hasattr(mat, "shadow_method"):
            mat.shadow_method = 'HASHED'
        if hasattr(mat, "use_screen_refraction"):
            mat.use_screen_refraction = True

    # Emission (for RGB fans, LEDs, neon lights)
    emission_strength = float(mat_data.get("emission_strength", 0.0))
    if emission_strength > 0.0 or "emission_color" in mat_data:
        em_color = mat_data.get("emission_color", [1.0, 1.0, 1.0, 1.0])
        if len(em_color) == 3:
            em_color = [em_color[0], em_color[1], em_color[2], 1.0]
        
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = tuple(em_color)
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = tuple(em_color)

        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = max(emission_strength, 2.5)

    return mat


def assign_material_to_object(obj: "bpy.types.Object", mat: "bpy.types.Material"):
    """Assigns material to object, replacing existing or appending."""
    if not obj or not mat:
        return
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
