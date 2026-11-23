"""
Studio Lighting & Camera setup for Blender 3.6 scenes.
"""
import math
from typing import Dict, Any, List

try:
    import bpy
    from mathutils import Vector, Euler
except ImportError:
    pass


def setup_lighting(lights_data: List[Dict[str, Any]] = None):
    """Sets up studio 3-point lighting or custom lights."""
    if not lights_data:
        # Default 3-point studio lighting
        lights_data = [
            {
                "name": "Key_Light",
                "type": "AREA",
                "position": [3.0, -3.5, 3.5],
                "energy": 500.0,
                "color": [1.0, 0.98, 0.95],
                "size": 2.0
            },
            {
                "name": "Fill_Light",
                "type": "AREA",
                "position": [-3.5, -2.5, 2.0],
                "energy": 200.0,
                "color": [0.85, 0.92, 1.0],
                "size": 3.0
            },
            {
                "name": "Rim_Light",
                "type": "AREA",
                "position": [0.5, 4.0, 3.0],
                "energy": 350.0,
                "color": [1.0, 0.85, 0.9],
                "size": 2.5
            }
        ]

    # Create Lighting collection
    if "Lighting" in bpy.data.collections:
        col = bpy.data.collections["Lighting"]
    else:
        col = bpy.data.collections.new("Lighting")
        bpy.context.scene.collection.children.link(col)

    for l_info in lights_data:
        name = l_info.get("name", "Light")
        l_type = l_info.get("type", "AREA").upper()
        if l_type not in ['POINT', 'SUN', 'SPOT', 'AREA']:
            l_type = 'AREA'

        light_data = bpy.data.lights.new(name=name, type=l_type)
        light_data.energy = float(l_info.get("energy", 300.0))
        color = l_info.get("color", [1.0, 1.0, 1.0])
        light_data.color = tuple(color[:3])
        if l_type == 'AREA' and "size" in l_info:
            light_data.size = float(l_info["size"])

        light_obj = bpy.data.objects.new(name=name, object_data=light_data)
        col.objects.link(light_obj)

        pos = l_info.get("position", [2.0, -2.0, 2.0])
        light_obj.location = Vector(pos)

        # Aim light at scene center (0, 0, 0.5)
        target = Vector((0.0, 0.0, 0.5))
        direction = target - light_obj.location
        rot_quat = direction.to_track_quat('-Z', 'Y')
        light_obj.rotation_euler = rot_quat.to_euler()


def setup_camera(camera_data: Dict[str, Any] = None):
    """Sets up primary camera and points at the modeled scene."""
    cam_data = bpy.data.cameras.new("Render_Camera")
    cam_data.lens = float(camera_data.get("lens", 50.0)) if camera_data else 50.0

    cam_obj = bpy.data.objects.new("Render_Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    pos = camera_data.get("position", [2.8, -3.2, 2.2]) if camera_data else [2.8, -3.2, 2.2]
    cam_obj.location = Vector(pos)

    target_pos = camera_data.get("target", [0.0, 0.0, 0.6]) if camera_data else [0.0, 0.0, 0.6]
    target = Vector(target_pos)

    # Point camera at target
    direction = target - cam_obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()
