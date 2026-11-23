"""
Geometry validation and auto-healing for Blender 3.6.
"""
from typing import Dict, Any, List

try:
    import bpy
    import bmesh
except ImportError:
    pass


def validate_and_heal_object(obj: "bpy.types.Object") -> Dict[str, Any]:
    """Validates object mesh, recalculates normals, and removes doubles if needed."""
    if obj.type != 'MESH':
        return {"valid": True, "object": obj.name}

    stats = {
        "object": obj.name,
        "vertex_count": len(obj.data.vertices),
        "polygon_count": len(obj.data.polygons),
        "healed": False
    }

    try:
        bm = bmesh.new()
        bm.from_mesh(obj.data)

        # Recalculate outside normals
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        
        # Remove degenerate geometry / doubles
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)

        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        stats["healed"] = True
        stats["valid"] = True
    except Exception as e:
        stats["error"] = str(e)
        stats["valid"] = False

    return stats
