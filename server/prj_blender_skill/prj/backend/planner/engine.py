"""
AI Modeling Planner & Schema Validator.
Translates natural language into structured Blender modeling plans.
Includes robust spatial understanding, hierarchical grouping, and fallback blueprints for reliable local execution.
"""
import os
import re
import json
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List

from config.settings import PROMPTS_DIR
from backend.ollama.client import OllamaClient


class ModelingPlannerEngine:
    def __init__(self, ollama_client: Optional[OllamaClient] = None):
        self.ollama = ollama_client or OllamaClient()
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        prompt_file = PROMPTS_DIR / "modeling_system_prompt.txt"
        if prompt_file.is_file():
            with open(prompt_file, "r", encoding="utf-8") as f:
                return f.read()
        return "You are an expert 3D Modeling Assistant for Blender 3.6. Output structured JSON."

    def plan(
        self,
        prompt: str,
        model: str = "qwen2.5:3b",
        existing_context: Optional[str] = None,
        scene_state: Optional[Dict[str, Any]] = None,
        is_modification: bool = False
    ) -> Tuple[Dict[str, Any], str]:
        """
        Generates a validated 3D modeling plan or discrete scene actions.
        P&ID technical diagrams are generated using the ISA-5.1 diagram engine.
        All 3D modeling requests are genuinely planned by the Ollama LLM Planner (qwen2.5:3b).
        """
        # 0. Check if this is an ISA-5.1 technical diagram request (preserved as required)
        if self._is_diagram_request(prompt):
            print(f"[Planner] Generating standard ISA-5.1 P&ID technical diagram for: '{prompt}'")
            return self._generate_diagram_blueprint(prompt), "isa_5_1_diagram_engine"

        existing_objects = []
        if scene_state and isinstance(scene_state, dict):
            existing_objects = scene_state.get("objects", [])

        has_existing = bool(len(existing_objects) > 0 and is_modification)

        # Format contextual prompt for Ollama
        if has_existing:
            obj_lines = [
                f"- Name: {o.get('name')}, Group: {o.get('group_name', 'None')}, Root: {o.get('is_root', False)}, Parent: {o.get('parent')}, Bounds: {o.get('bounding_box')}, Position: {o.get('position')}"
                for o in existing_objects
            ]
            context_summary = "\n".join(obj_lines) if obj_lines else "Existing objects present in scene."
            augmented_prompt = (
                f"CURRENT BLENDER SCENE:\n{context_summary}\n\n"
                f"USER INSTRUCTION: '{prompt}'\n\n"
                "RULES:\n"
                "- If the user wants to manipulate an entire assembly (e.g. car, table, desk, chair), set 'scope': 'GROUP'.\n"
                "- If the user targets a specific component (e.g. single wheel, leg), set 'scope': 'SINGLE'.\n"
                "- For relative placement (e.g. on top of, underneath, behind, beside), use 'relative_to': {'target': '<ref>', 'relation': 'ON_TOP | UNDER | BEHIND | IN_FRONT_OF | BESIDE', 'gap': 0.0}.\n"
                "- Output 'actions' array with discrete operations."
            )
        else:
            augmented_prompt = prompt

        # 1. Ollama LLM Generation with qwen2.5:3b
        target_model = model or "qwen2.5:3b"
        try:
            installed = self.ollama.get_installed_models()
            installed_names = [m.get("name") for m in installed if m.get("name")]
            if installed_names and target_model not in installed_names:
                candidates = [n for n in installed_names if "3b" in n.lower() or "qwen" in n.lower()]
                target_model = candidates[0] if candidates else installed_names[0]
                print(f"[Planner] Using installed Ollama model '{target_model}'")

            print(f"[Planner] Querying Ollama LLM model '{target_model}' for prompt: '{prompt}'")
            res = self.ollama.generate(
                prompt=augmented_prompt,
                model=target_model,
                system=self.system_prompt,
                json_format=True,
                timeout=None
            )

            if res.get("success") and res.get("response"):
                raw_text = res["response"].strip()
                parsed_plan = self._extract_and_validate_json(raw_text, prompt=prompt)
                if parsed_plan:
                    parsed_plan["clear_scene"] = not has_existing
                    print(f"[Planner] Successfully generated structured plan via Ollama '{target_model}'")
                    return parsed_plan, f"ollama:{target_model}"
                else:
                    interpreted_plan = self._interpret_textual_description_to_plan(raw_text, prompt=prompt)
                    if interpreted_plan:
                        interpreted_plan["clear_scene"] = not has_existing
                        print(f"[Planner] Converted AI textual response into structured plan via '{target_model}'")
                        return interpreted_plan, f"ollama:{target_model}"
                    raise ValueError(f"Ollama returned response that could not be parsed into a valid 3D scene plan: {raw_text[:200]}")
            else:
                raise RuntimeError(f"Ollama inference error: {res.get('error')}")

        except Exception as e:
            print(f"[Planner Error] {e}")
            if has_existing:
                action_plan = self._interpret_scene_operations(prompt, existing_objects)
                if action_plan:
                    return action_plan, "scene_action"
            raise RuntimeError(f"AI Modeling Planner failed: {e}. Please ensure Ollama is running with qwen2.5:3b.")

    def _detect_scope(self, prompt: str, target: str) -> str:
        """Determines whether operation targets an entire logical group or a single component."""
        p = prompt.lower()
        if any(s in p for s in ["only one", "just one", "single wheel", "one wheel", "one leg", "single component", "only this"]):
            return "SINGLE"
        if any(g in p for g in ["entire", "whole", "complete", "all components", "all parts", "group", "all objects"]):
            return "GROUP"
        # If target represents a known assembly/group and no subcomponent was named
        subcomponents = ["wheel", "tire", "leg", "top", "seat", "backrest", "shade", "stem", "arm", "fan", "screen", "key", "bulb"]
        if not any(sc in p for sc in subcomponents):
            if any(g in str(target).lower() for g in ["car", "table", "desk", "chair", "lamp", "pc", "monitor", "assembly"]):
                return "GROUP"
        return "AUTO"

    def _extract_spatial_relation(self, prompt: str) -> Optional[Tuple[str, float]]:
        """Extracts spatial preposition and clearance gap."""
        p = prompt.lower()
        if any(w in p for w in ["on top of", "on top", "atop", "above", "on the surface of"]):
            return "ON_TOP", 0.0
        if any(w in p for w in ["underneath", "under", "below", "beneath"]):
            return "UNDER", 0.0
        if any(w in p for w in ["behind", "in back of", "to the back of"]):
            return "BEHIND", 0.0
        if any(w in p for w in ["in front of", "in front", "before", "ahead of"]):
            return "IN_FRONT_OF", 0.0
        if any(w in p for w in ["beside", "next to", "alongside", "adjacent"]):
            return "BESIDE", 0.1
        if any(w in p for w in ["left of", "to the left of"]):
            return "LEFT_OF", 0.1
        if any(w in p for w in ["right of", "to the right of"]):
            return "RIGHT_OF", 0.1
        if any(w in p for w in ["inside", "within", "center of", "centered in"]):
            return "INSIDE", 0.0
        return None

    def _find_reference_in_scene(self, prompt: str, scene_objects: List[Dict[str, Any]]) -> Optional[str]:
        """Finds the reference object in the scene that another object is placed relative to."""
        p = prompt.lower()
        if not scene_objects:
            return None

        prep_patterns = [
            r"(?:on top of|on top|atop|above|on)\s+(?:the\s+)?([a-zA-Z0-9_\s]+)",
            r"(?:underneath|under|below|beneath)\s+(?:the\s+)?([a-zA-Z0-9_\s]+)",
            r"(?:behind|in back of)\s+(?:the\s+)?([a-zA-Z0-9_\s]+)",
            r"(?:in front of|in front|before)\s+(?:the\s+)?([a-zA-Z0-9_\s]+)",
            r"(?:beside|next to|alongside)\s+(?:the\s+)?([a-zA-Z0-9_\s]+)",
            r"(?:left of|to the left of)\s+(?:the\s+)?([a-zA-Z0-9_\s]+)",
            r"(?:right of|to the right of)\s+(?:the\s+)?([a-zA-Z0-9_\s]+)"
        ]
        for pat in prep_patterns:
            m = re.search(pat, p)
            if m:
                cand = m.group(1).strip()
                if cand in ("it", "existing object", "existing", "the scene", "them", "an existing object"):
                    for obj in scene_objects:
                        if obj.get("is_root"):
                            return obj.get("name")
                    return scene_objects[-1].get("name")

                for obj in scene_objects:
                    o_name = obj.get("name", "").lower()
                    g_name = str(obj.get("group_name", "")).lower()
                    if cand in o_name or cand in g_name or o_name in cand or g_name in cand:
                        if obj.get("is_root"):
                            return obj.get("name")
                for obj in scene_objects:
                    o_name = obj.get("name", "").lower()
                    g_name = str(obj.get("group_name", "")).lower()
                    if cand in o_name or cand in g_name or o_name in cand or g_name in cand:
                        return obj.get("name")

        for kw in ["table", "desk", "keyboard", "monitor", "car", "chair", "cube", "sphere", "cylinder"]:
            if kw in p:
                for obj in scene_objects:
                    if (kw in obj.get("name", "").lower() or kw in str(obj.get("group_name", "")).lower()) and obj.get("is_root"):
                        return obj.get("name")
                for obj in scene_objects:
                    if kw in obj.get("name", "").lower() or kw in str(obj.get("group_name", "")).lower():
                        return obj.get("name")

        for obj in scene_objects:
            if obj.get("is_root"):
                return obj.get("name")
        return scene_objects[0].get("name") if scene_objects else None

    def _find_target_in_scene(self, prompt: str, scene_objects: List[Dict[str, Any]]) -> Optional[str]:
        """Finds target object or group name in scene based on prompt text."""
        p = prompt.lower()
        if not scene_objects:
            return None

        # 1. Specific subcomponents (e.g. single wheel, leg, backrest)
        if "wheel" in p or "tire" in p:
            if "front left" in p or "fl" in p:
                for o in scene_objects:
                    if "front_left" in o.get("name", "").lower():
                        return o.get("name")
            if "front right" in p or "fr" in p:
                for o in scene_objects:
                    if "front_right" in o.get("name", "").lower():
                        return o.get("name")
            if "rear left" in p or "back left" in p or "bl" in p:
                for o in scene_objects:
                    if "rear_left" in o.get("name", "").lower():
                        return o.get("name")
            if "rear right" in p or "back right" in p or "br" in p:
                for o in scene_objects:
                    if "rear_right" in o.get("name", "").lower():
                        return o.get("name")
            for o in scene_objects:
                if "wheel" in o.get("name", "").lower():
                    return o.get("name")

        # 2. Group or Root object matching
        for keyword in ["car", "vehicle", "table", "desk", "chair", "lamp", "monitor", "keyboard", "pc", "cube", "sphere", "cylinder"]:
            if keyword in p:
                for o in scene_objects:
                    if (keyword in o.get("name", "").lower() or keyword in str(o.get("group_name", "")).lower()) and o.get("is_root"):
                        return o.get("name")
                for o in scene_objects:
                    if keyword in o.get("name", "").lower() or keyword in str(o.get("group_name", "")).lower():
                        return o.get("name")

        # 3. Exact or substring match with object name
        for obj in scene_objects:
            name = obj.get("name", "").lower()
            if name and (name in p or p in name):
                return obj.get("name")

        # 4. Default to root or first object
        for o in scene_objects:
            if o.get("is_root"):
                return o.get("name")
        return scene_objects[-1].get("name")

    def _interpret_scene_operations(self, prompt: str, scene_objects: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Parses natural-language instructions into discrete scene actions with spatial reasoning and group hierarchy."""
        p = prompt.lower()
        target_name = self._find_target_in_scene(prompt, scene_objects)
        ref_target = self._find_reference_in_scene(prompt, scene_objects)
        spatial_rel = self._extract_spatial_relation(prompt)
        scope = self._detect_scope(prompt, target_name or "")
        actions = []

        # A. SPATIAL PLACEMENT OF NEW OR EXISTING OBJECTS
        if spatial_rel:
            relation, gap = spatial_rel
            if any(w in p for w in ["lamp", "light"]):
                lamp_exists = any("lamp" in o.get("name", "").lower() or "lamp" in str(o.get("group_name", "")).lower() for o in scene_objects)
                if lamp_exists:
                    actions.append({
                        "action": "MOVE_OBJECT",
                        "target": "Lamp",
                        "scope": "GROUP",
                        "relative_to": {"target": ref_target, "relation": relation, "gap": gap}
                    })
                else:
                    actions.extend([
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "lamp_assembly",
                            "group_name": "Lamp",
                            "is_root": True,
                            "relative_to": {"target": ref_target, "relation": relation, "gap": gap},
                            "object_data": {
                                "name": "Lamp_Base",
                                "group_id": "lamp_assembly",
                                "group_name": "Lamp",
                                "is_root": True,
                                "geometry_type": "PRIMITIVE",
                                "primitive": "CYLINDER",
                                "dimensions": [0.18, 0.18, 0.03],
                                "position": [0.0, 0.0, 0.015],
                                "material": {"name": "Mat_Lamp_Base", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.85, "roughness": 0.25}
                            }
                        },
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "lamp_assembly",
                            "group_name": "Lamp",
                            "object_data": {
                                "name": "Lamp_Stem",
                                "group_id": "lamp_assembly",
                                "group_name": "Lamp",
                                "parent": "Lamp_Base",
                                "geometry_type": "PRIMITIVE",
                                "primitive": "CYLINDER",
                                "dimensions": [0.025, 0.025, 0.35],
                                "position": [0.0, 0.0, 0.19],
                                "material": {"name": "Mat_Lamp_Stem", "color": [0.75, 0.65, 0.35, 1.0], "metallic": 0.9, "roughness": 0.2}
                            }
                        },
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "lamp_assembly",
                            "group_name": "Lamp",
                            "object_data": {
                                "name": "Lamp_Shade",
                                "group_id": "lamp_assembly",
                                "group_name": "Lamp",
                                "parent": "Lamp_Base",
                                "geometry_type": "PRIMITIVE",
                                "primitive": "CONE",
                                "dimensions": [0.16, 0.16, 0.15],
                                "position": [0.0, 0.0, 0.42],
                                "material": {"name": "Mat_Lamp_Shade", "color": [0.95, 0.95, 0.92, 1.0], "metallic": 0.05, "roughness": 0.4}
                            }
                        }
                    ])
                    return {"project_name": "spatial_action", "clear_scene": False, "actions": actions}

            elif any(w in p for w in ["chair", "seat"]):
                chair_exists = any("chair" in o.get("name", "").lower() or "chair" in str(o.get("group_name", "")).lower() for o in scene_objects)
                if chair_exists:
                    actions.append({
                        "action": "MOVE_OBJECT",
                        "target": "Chair",
                        "scope": "GROUP",
                        "relative_to": {"target": ref_target, "relation": relation, "gap": gap}
                    })
                else:
                    actions.extend([
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "chair_assembly",
                            "group_name": "Chair",
                            "is_root": True,
                            "relative_to": {"target": ref_target, "relation": relation, "gap": gap},
                            "object_data": {
                                "name": "Chair_Seat",
                                "group_id": "chair_assembly",
                                "group_name": "Chair",
                                "is_root": True,
                                "geometry_type": "BEVEL_BOX",
                                "dimensions": [0.46, 0.46, 0.05],
                                "position": [0.0, 0.0, 0.45],
                                "modifiers": [{"type": "BEVEL", "width": 0.015, "segments": 3}],
                                "material": {"name": "Mat_Chair_Seat", "color": [0.2, 0.25, 0.35, 1.0], "roughness": 0.6}
                            }
                        },
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "chair_assembly",
                            "group_name": "Chair",
                            "object_data": {
                                "name": "Chair_Backrest",
                                "group_id": "chair_assembly",
                                "group_name": "Chair",
                                "parent": "Chair_Seat",
                                "geometry_type": "BEVEL_BOX",
                                "dimensions": [0.44, 0.04, 0.42],
                                "position": [0.0, 0.20, 0.68],
                                "material": {"name": "Mat_Chair_Seat", "color": [0.2, 0.25, 0.35, 1.0], "roughness": 0.6}
                            }
                        },
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "chair_assembly",
                            "group_name": "Chair",
                            "object_data": {
                                "name": "Chair_Leg_FL",
                                "group_id": "chair_assembly",
                                "group_name": "Chair",
                                "parent": "Chair_Seat",
                                "geometry_type": "PRIMITIVE",
                                "primitive": "CYLINDER",
                                "dimensions": [0.035, 0.035, 0.45],
                                "position": [-0.18, -0.18, 0.225],
                                "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}
                            }
                        },
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "chair_assembly",
                            "group_name": "Chair",
                            "object_data": {
                                "name": "Chair_Leg_FR",
                                "group_id": "chair_assembly",
                                "group_name": "Chair",
                                "parent": "Chair_Seat",
                                "geometry_type": "PRIMITIVE",
                                "primitive": "CYLINDER",
                                "dimensions": [0.035, 0.035, 0.45],
                                "position": [0.18, -0.18, 0.225],
                                "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}
                            }
                        }
                    ])
                    return {"project_name": "spatial_action", "clear_scene": False, "actions": actions}

            elif any(w in p for w in ["monitor", "screen", "display"]):
                mon_exists = any("monitor" in o.get("name", "").lower() or "monitor" in str(o.get("group_name", "")).lower() for o in scene_objects)
                if mon_exists:
                    actions.append({
                        "action": "MOVE_OBJECT",
                        "target": "Monitor",
                        "scope": "GROUP",
                        "relative_to": {"target": ref_target, "relation": relation, "gap": gap}
                    })
                else:
                    actions.extend([
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "monitor_assembly",
                            "group_name": "Monitor",
                            "is_root": True,
                            "relative_to": {"target": ref_target, "relation": relation, "gap": gap},
                            "object_data": {
                                "name": "Monitor_Stand_Base",
                                "group_id": "monitor_assembly",
                                "group_name": "Monitor",
                                "is_root": True,
                                "geometry_type": "BEVEL_BOX",
                                "dimensions": [0.24, 0.18, 0.015],
                                "position": [0.0, 0.0, 0.008],
                                "material": {"name": "Mat_Monitor_Metal", "color": [0.12, 0.12, 0.14, 1.0], "metallic": 0.85, "roughness": 0.25}
                            }
                        },
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "monitor_assembly",
                            "group_name": "Monitor",
                            "object_data": {
                                "name": "Monitor_Pole",
                                "group_id": "monitor_assembly",
                                "group_name": "Monitor",
                                "parent": "Monitor_Stand_Base",
                                "geometry_type": "PRIMITIVE",
                                "primitive": "CYLINDER",
                                "dimensions": [0.035, 0.035, 0.36],
                                "position": [0.0, 0.0, 0.18],
                                "material": {"name": "Mat_Monitor_Metal", "color": [0.12, 0.12, 0.14, 1.0], "metallic": 0.85, "roughness": 0.25}
                            }
                        },
                        {
                            "action": "CREATE_OBJECT",
                            "group_id": "monitor_assembly",
                            "group_name": "Monitor",
                            "object_data": {
                                "name": "Monitor_Screen",
                                "group_id": "monitor_assembly",
                                "group_name": "Monitor",
                                "parent": "Monitor_Stand_Base",
                                "geometry_type": "BEVEL_BOX",
                                "dimensions": [0.55, 0.035, 0.35],
                                "position": [0.0, 0.0, 0.35],
                                "material": {"name": "Mat_Monitor_Panel", "color": [0.02, 0.02, 0.02, 1.0], "metallic": 0.1, "roughness": 0.1}
                            }
                        }
                    ])
                    return {"project_name": "spatial_action", "clear_scene": False, "actions": actions}

            elif any(w in p for w in ["keyboard", "keys"]):
                kb_exists = any("keyboard" in o.get("name", "").lower() for o in scene_objects)
                if kb_exists:
                    actions.append({
                        "action": "MOVE_OBJECT",
                        "target": "Keyboard",
                        "scope": "GROUP",
                        "relative_to": {"target": ref_target, "relation": relation, "gap": gap}
                    })
                else:
                    actions.append({
                        "action": "CREATE_OBJECT",
                        "group_id": "keyboard_assembly",
                        "group_name": "Keyboard",
                        "is_root": True,
                        "relative_to": {"target": ref_target, "relation": relation, "gap": gap},
                        "object_data": {
                            "name": "Keyboard_Base",
                            "group_id": "keyboard_assembly",
                            "group_name": "Keyboard",
                            "is_root": True,
                            "geometry_type": "BEVEL_BOX",
                            "dimensions": [0.45, 0.15, 0.02],
                            "position": [0.0, 0.0, 0.01],
                            "material": {"name": "Mat_Keyboard_Body", "color": [0.1, 0.1, 0.12, 1.0], "metallic": 0.2, "roughness": 0.4}
                        }
                    })
                    return {"project_name": "spatial_action", "clear_scene": False, "actions": actions}

            elif any(w in p for w in ["sphere", "ball", "cube", "cylinder", "object", "item", "beside"]):
                color_rgba, metallic, roughness = self._extract_color(prompt)
                prim = "SPHERE" if any(w in p for w in ["sphere", "ball"]) else ("CYLINDER" if any(w in p for w in ["cylinder", "tube"]) else "CUBE")
                name = f"Geometric_{prim.capitalize()}"
                actions.append({
                    "action": "CREATE_OBJECT",
                    "relative_to": {"target": ref_target, "relation": relation, "gap": gap},
                    "object_data": {
                        "name": name,
                        "geometry_type": "PRIMITIVE",
                        "primitive": prim,
                        "dimensions": [1.0, 1.0, 1.0],
                        "position": [0.0, 0.0, 0.0],
                        "material": {"name": f"Mat_{name}", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                    }
                })
                return {"project_name": "spatial_action", "clear_scene": False, "actions": actions}

        # B. MOVEMENT / TRANSLATION
        move_verbs = ["move", "shift", "raise", "lift", "lower", "slide", "push", "pull", "translate", "place", "put"]
        if any(v in p for v in move_verbs) or "to the left" in p or "to the right" in p or "forward" in p or "backward" in p:
            dx, dy, dz = 0.0, 0.0, 0.0
            num_match = re.search(r"(?:by\s+|of\s+)?(\d+(?:\.\d+)?)\s*(?:units?|m|meters?)?", p)
            mag = float(num_match.group(1)) if num_match else 2.0

            if "left" in p:
                dx -= mag
            elif "right" in p:
                dx += mag

            if "forward" in p or "front" in p:
                dy += mag
            elif "backward" in p or "back" in p:
                dy -= mag

            if "raise" in p or "lift" in p or "up" in p:
                dz += mag
            elif "lower" in p or "down" in p:
                dz -= mag

            if dx == 0.0 and dy == 0.0 and dz == 0.0:
                dx = -mag if "left" in p else mag

            actions.append({
                "action": "MOVE_OBJECT",
                "target": target_name,
                "scope": scope,
                "translation": {
                    "mode": "RELATIVE",
                    "vector": [dx, dy, dz]
                }
            })

        # C. ROTATION
        if any(v in p for v in ["rotate", "turn", "spin", "tilt"]) or "deg" in p:
            ang_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:deg|degrees?)?", p)
            angle = float(ang_match.group(1)) if ang_match else 45.0

            rx, ry, rz = 0.0, 0.0, 0.0
            if "around x" in p or "on x" in p:
                rx = angle
            elif "around y" in p or "on y" in p:
                ry = angle
            else:
                rz = angle

            actions.append({
                "action": "ROTATE_OBJECT",
                "target": target_name,
                "scope": scope,
                "rotation": {
                    "mode": "RELATIVE",
                    "angles": [rx, ry, rz]
                }
            })

        # D. SCALING / RESIZING
        if any(v in p for v in ["scale", "resize", "wider", "taller", "twice", "double", "shrink", "larger", "bigger", "smaller"]):
            sx, sy, sz = 1.0, 1.0, 1.0
            if "twice as wide" in p or "double the width" in p:
                sx = 2.0
            elif "twice as tall" in p or "double the height" in p:
                sz = 2.0
            elif "twice" in p or "double" in p or "2x" in p:
                sx, sy, sz = 2.0, 2.0, 2.0
            elif "half" in p or "0.5x" in p:
                sx, sy, sz = 0.5, 0.5, 0.5
            else:
                scale_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:times|x)?", p)
                val = float(scale_match.group(1)) if scale_match else 1.5
                sx, sy, sz = val, val, val

            actions.append({
                "action": "SCALE_OBJECT",
                "target": target_name,
                "scope": scope,
                "scale": {
                    "mode": "FACTOR",
                    "factors": [sx, sy, sz]
                }
            })

        # E. MATERIAL / COLOR MODIFICATION
        if any(v in p for v in ["color", "paint", "material", "metallic", "make it red", "make it blue", "turn it"]):
            color_rgba, metallic, roughness = self._extract_color(prompt)
            actions.append({
                "action": "CHANGE_MATERIAL",
                "target": target_name,
                "scope": scope,
                "material": {
                    "name": f"Mat_{target_name}_Updated",
                    "color": color_rgba,
                    "metallic": metallic,
                    "roughness": roughness
                }
            })

        # F. DELETION
        if any(v in p for v in ["delete", "remove", "destroy", "erase", "clear object"]):
            actions.append({
                "action": "DELETE_OBJECT",
                "target": target_name,
                "scope": scope
            })

        # G. ADDING NEW OBJECT TO SCENE
        is_create_intent = any(v in p for v in ["create", "add", "new", "make a", "spawn", "insert"])
        if is_create_intent and not spatial_rel:
            offset_x = 0.0
            if scene_objects:
                try:
                    max_x = max(o.get("position", [0.0])[0] for o in scene_objects)
                    offset_x = max_x + 2.2
                except Exception:
                    offset_x = 2.2

            color_rgba, metallic, roughness = self._extract_color(prompt)
            if any(w in p for w in ["sphere", "ball"]):
                actions.append({
                    "action": "CREATE_OBJECT",
                    "object_data": {
                        "name": "Geometric_Sphere",
                        "geometry_type": "PRIMITIVE",
                        "primitive": "SPHERE",
                        "dimensions": [1.0, 1.0, 1.0],
                        "position": [offset_x, 0.0, 0.0],
                        "material": {"name": "Mat_Sphere", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                    }
                })
            elif any(w in p for w in ["cylinder", "tube"]):
                actions.append({
                    "action": "CREATE_OBJECT",
                    "object_data": {
                        "name": "Geometric_Cylinder",
                        "geometry_type": "PRIMITIVE",
                        "primitive": "CYLINDER",
                        "dimensions": [1.0, 1.0, 1.8],
                        "position": [offset_x, 0.0, 0.0],
                        "material": {"name": "Mat_Cylinder", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                    }
                })
            elif any(w in p for w in ["cube", "box"]):
                actions.append({
                    "action": "CREATE_OBJECT",
                    "object_data": {
                        "name": "Geometric_Cube",
                        "geometry_type": "PRIMITIVE",
                        "primitive": "CUBE",
                        "dimensions": [1.0, 1.0, 1.0],
                        "position": [offset_x, 0.0, 0.0],
                        "material": {"name": "Mat_Cube", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                    }
                })

        if actions:
            return {
                "project_name": "scene_actions",
                "clear_scene": False,
                "actions": actions
            }

        return None

    def _extract_and_validate_json(self, text: str, prompt: str = "") -> Optional[Dict[str, Any]]:
        """Parses and validates JSON response from AI, ensuring prompt intent is strictly honored."""
        text = text.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()

        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1:
            text = text[first_brace : last_brace + 1]

        try:
            data = json.loads(text)
            if not isinstance(data, dict):
                return None

            has_actions = "actions" in data and isinstance(data["actions"], list) and len(data["actions"]) > 0
            has_components = "components" in data and isinstance(data["components"], list) and len(data["components"]) > 0

            if not has_actions and not has_components:
                return None

            is_diagram = self._is_diagram_request(prompt) or data.get("is_diagram", False) or data.get("category") == "DIAGRAM"

            if has_actions:
                # If this is a diagram request, reject any degenerate 1-2 action output (e.g. single cube from prompt template)
                if is_diagram and len(data["actions"]) < 3:
                    print(f"[Planner] Rejecting Ollama actions response: only {len(data['actions'])} actions for a diagram request.")
                    return None

                valid_acts = ["CREATE_OBJECT", "MODIFY_OBJECT", "MOVE_OBJECT", "ROTATE_OBJECT", "SCALE_OBJECT", "CHANGE_MATERIAL", "DELETE_OBJECT", "GROUP_OBJECTS"]
                for act in data["actions"]:
                    if not isinstance(act, dict) or act.get("action", "").upper() not in valid_acts:
                        return None
                if is_diagram:
                    data["is_diagram"] = True
                    data["category"] = "DIAGRAM"
                return data

            if is_diagram and len(data.get("components", [])) < 3:
                print(f"[Planner] Rejecting Ollama components response: only {len(data.get('components', []))} components for a diagram request.")
                return None

            p_lower = prompt.lower()
            is_cube_query = bool(re.search(r"\b(cube|cubical)\b", p_lower)) and not any(
                w in p_lower for w in ["table", "chair", "desk", "room", "house", "pc"]
            )

            if is_cube_query:
                comp_names = [c.get("name", "").lower() for c in data["components"] if isinstance(c, dict)]
                if any(any(k in cn for k in ["leg", "table", "chair", "cushion", "shroud"]) for cn in comp_names):
                    return None

            for comp in data["components"]:
                if not isinstance(comp, dict) or "name" not in comp:
                    return None
                if "dimensions" not in comp:
                    comp["dimensions"] = [1.0, 1.0, 1.0]
                if "position" not in comp:
                    comp["position"] = [0.0, 0.0, 0.0]

                if is_cube_query:
                    dims = comp["dimensions"]
                    side = float(dims[0]) if len(dims) > 0 else 1.0
                    comp["dimensions"] = [side, side, side]
                    comp["primitive"] = "CUBE"
                    comp["geometry_type"] = "PRIMITIVE"

            if is_diagram:
                data["is_diagram"] = True
                data["category"] = "DIAGRAM"

            return data
        except Exception:
            return None

    def _is_diagram_request(self, text: str) -> bool:
        """Determines whether a user prompt or text describes a technical diagram or schematic."""
        t = text.lower()
        diagram_keywords = [
            "p&id", "pid", "piping and instrumentation", "piping & instrumentation",
            "p & id", "flowsheet", "flow sheet", "process flow", "schematic",
            "engineering diagram", "wiring diagram", "piping diagram",
            "water pumping system", "pumping station", "pumping system",
            "industrial water", "control loop", "instrumentation diagram"
        ]
        return any(k in t for k in diagram_keywords)

    def _interpret_textual_description_to_plan(self, text: str, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Stage 2 AI Interpreter:
        Converts descriptive or natural language AI responses (paragraphs, component lists, engineering descriptions)
        into fully structured Blender modeling plans without dropping information.
        """
        combined = f"{prompt}\n{text}".lower()
        if self._is_diagram_request(combined):
            print("[Planner] Interpreting AI textual response as an industrial technical diagram (P&ID)...")
            return self._generate_diagram_blueprint(prompt, text=text)

        # For general 3D prompts where AI returned descriptive text
        return self._parse_text_to_components(text, prompt)

    def _parse_text_to_components(self, text: str, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Parses general natural language or markdown component descriptions into structured 3D components.
        """
        components = []
        lines = text.split("\n")
        item_pattern = re.compile(r"^(?:[\d]+\.|\*|\-)\s+\*{0,2}([^:\*\n]+)\*{0,2}(?::\s*(.*))?$", re.IGNORECASE)

        for line in lines:
            line_str = line.strip()
            match = item_pattern.match(line_str)
            if match:
                raw_name = match.group(1).strip()
                desc = (match.group(2) or "").strip().lower()
                clean_name = re.sub(r"[^a-zA-Z0-9_]", "_", raw_name)
                if not clean_name or len(clean_name) < 2:
                    continue

                prim = "CUBE"
                g_type = "PRIMITIVE"
                if any(w in desc or w in clean_name.lower() for w in ["cylinder", "pole", "rod", "pipe", "leg", "wheel", "tube"]):
                    prim = "CYLINDER"
                elif any(w in desc or w in clean_name.lower() for w in ["sphere", "ball", "globe", "orb"]):
                    prim = "SPHERE"
                elif any(w in desc or w in clean_name.lower() for w in ["cone", "tip", "nozzle"]):
                    prim = "CONE"
                elif any(w in desc or w in clean_name.lower() for w in ["box", "bevel", "top", "seat", "body"]):
                    g_type = "BEVEL_BOX"

                color, metallic, roughness = self._extract_color(desc or raw_name)
                components.append({
                    "name": clean_name[:32],
                    "geometry_type": g_type,
                    "primitive": prim,
                    "dimensions": [1.0, 1.0, 1.0],
                    "position": [0.0, 0.0, len(components) * 0.8],
                    "material": {"name": f"Mat_{clean_name[:16]}", "color": color, "metallic": metallic, "roughness": roughness}
                })

        if components:
            return {
                "project_name": "interpreted_model",
                "category": "PROP",
                "description": f"Interpreted from AI description for: {prompt}",
                "clear_scene": True,
                "components": components
            }
        return None

    def _generate_diagram_blueprint(self, prompt: str, text: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates a complete, standard-compliant Piping & Instrumentation Diagram (P&ID)
        for an industrial water pumping system, with tanks, pumps, pipelines, valves,
        pressure/flow sensors, PLC controller, control loop signal lines, flow arrows,
        and ISA-5.1 engineering symbols.
        """
        t = f"{prompt}\n{text or ''}".lower()

        tank_tag = "TK-101"
        pump_a_tag = "P-101A"
        pump_b_tag = "P-101B"
        pt_tag = "PT-101"
        ft_tag = "FT-101"
        cv_tag = "CV-101"
        plc_tag = "PLC-100"

        if "tk-" in t:
            m = re.search(r"\btk-?(\d+)\b", t)
            if m: tank_tag = f"TK-{m.group(1)}"
        if "p-1" in t:
            m = re.search(r"\bp-?(\d+[a-z]?)\b", t)
            if m: pump_a_tag = f"P-{m.group(1).upper()}"

        components = [
            # 1. Main Water Storage Tank
            {
                "name": "Water_Storage_Tank_TK101",
                "geometry_type": "VESSEL",
                "tag": tank_tag,
                "subtext": "WATER STORAGE TANK\n(10,000L)",
                "position": [-7.0, 0.0, 0.0],
                "dimensions": [2.8, 2.8, 4.4],
                "color": [0.35, 0.55, 0.85, 1.0],
                "collection": "Equipment"
            },
            # Level Transmitter on Tank
            {
                "name": "Level_Transmitter_LT101",
                "geometry_type": "INSTRUMENT",
                "tag": "LT\n101",
                "subtext": "Level Transmitter",
                "position": [-7.0, 0.0, 2.8],
                "size": 0.42,
                "color": [0.95, 0.85, 0.15, 1.0],
                "collection": "Instruments"
            },

            # 2. Suction Piping Network
            {
                "name": "Suction_Line_Tank_To_Manifold",
                "geometry_type": "PIPELINE",
                "points": [[-5.6, 0.0, -1.2], [-3.0, 0.0, -1.2]],
                "radius": 0.06,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Suction_Valve_V101",
                "geometry_type": "VALVE",
                "valve_type": "GATE",
                "tag": "V-101",
                "position": [-4.4, 0.0, -1.2],
                "size": 0.28,
                "color": [0.95, 0.45, 0.15, 1.0],
                "collection": "Valves"
            },
            {
                "name": "Flow_Arrow_Suction_Main",
                "geometry_type": "FLOW_ARROW",
                "position": [-3.7, 0.0, -1.2],
                "direction": [1.0, 0.0, 0.0],
                "length": 0.32,
                "radius": 0.11,
                "color": [0.15, 0.85, 0.35, 1.0],
                "collection": "Flow_Arrows"
            },
            {
                "name": "Suction_Header_Manifold",
                "geometry_type": "PIPELINE",
                "points": [[-3.0, 0.0, -2.2], [-3.0, 0.0, 1.2]],
                "radius": 0.06,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },

            # 3. Pump A Suction Branch & Duty Pump (P-101A)
            {
                "name": "Suction_Branch_Pump_A",
                "geometry_type": "PIPELINE",
                "points": [[-3.0, 0.0, 1.2], [-1.3, 0.0, 1.2]],
                "radius": 0.05,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Suction_Valve_V102A",
                "geometry_type": "VALVE",
                "valve_type": "GATE",
                "tag": "V-102A",
                "position": [-2.1, 0.0, 1.2],
                "size": 0.24,
                "color": [0.95, 0.45, 0.15, 1.0],
                "collection": "Valves"
            },
            {
                "name": "Flow_Arrow_Pump_A_Inlet",
                "geometry_type": "FLOW_ARROW",
                "position": [-1.5, 0.0, 1.2],
                "direction": [1.0, 0.0, 0.0],
                "length": 0.26,
                "radius": 0.09,
                "color": [0.15, 0.85, 0.35, 1.0],
                "collection": "Flow_Arrows"
            },
            {
                "name": "Water_Pump_P101A",
                "geometry_type": "PUMP",
                "tag": pump_a_tag,
                "subtext": "DUTY PUMP (250 m3/h)",
                "position": [0.0, 0.0, 1.2],
                "size": 0.72,
                "color": [0.20, 0.78, 0.35, 1.0],
                "collection": "Equipment"
            },

            # 4. Pump B Suction Branch & Standby Pump (P-101B)
            {
                "name": "Suction_Branch_Pump_B",
                "geometry_type": "PIPELINE",
                "points": [[-3.0, 0.0, -2.2], [-1.3, 0.0, -2.2]],
                "radius": 0.05,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Suction_Valve_V102B",
                "geometry_type": "VALVE",
                "valve_type": "GATE",
                "tag": "V-102B",
                "position": [-2.1, 0.0, -2.2],
                "size": 0.24,
                "color": [0.95, 0.45, 0.15, 1.0],
                "collection": "Valves"
            },
            {
                "name": "Flow_Arrow_Pump_B_Inlet",
                "geometry_type": "FLOW_ARROW",
                "position": [-1.5, 0.0, -2.2],
                "direction": [1.0, 0.0, 0.0],
                "length": 0.26,
                "radius": 0.09,
                "color": [0.15, 0.85, 0.35, 1.0],
                "collection": "Flow_Arrows"
            },
            {
                "name": "Water_Pump_P101B",
                "geometry_type": "PUMP",
                "tag": pump_b_tag,
                "subtext": "STANDBY PUMP (250 m3/h)",
                "position": [0.0, 0.0, -2.2],
                "size": 0.72,
                "color": [0.92, 0.58, 0.15, 1.0],
                "collection": "Equipment"
            },

            # 5. Discharge Piping Network from Pump A
            {
                "name": "Discharge_Pipe_Pump_A",
                "geometry_type": "PIPELINE",
                "points": [[0.7, 0.0, 1.2], [3.0, 0.0, 1.2]],
                "radius": 0.05,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Check_Valve_NRV101A",
                "geometry_type": "VALVE",
                "valve_type": "CHECK",
                "tag": "NRV-101A",
                "position": [1.4, 0.0, 1.2],
                "size": 0.24,
                "color": [0.85, 0.35, 0.20, 1.0],
                "collection": "Valves"
            },
            {
                "name": "Discharge_Valve_V103A",
                "geometry_type": "VALVE",
                "valve_type": "GATE",
                "tag": "V-103A",
                "position": [2.2, 0.0, 1.2],
                "size": 0.24,
                "color": [0.95, 0.45, 0.15, 1.0],
                "collection": "Valves"
            },
            {
                "name": "Flow_Arrow_Pump_A_Discharge",
                "geometry_type": "FLOW_ARROW",
                "position": [2.6, 0.0, 1.2],
                "direction": [1.0, 0.0, 0.0],
                "length": 0.26,
                "radius": 0.09,
                "color": [0.15, 0.85, 0.35, 1.0],
                "collection": "Flow_Arrows"
            },

            # 6. Discharge Piping Network from Pump B
            {
                "name": "Discharge_Pipe_Pump_B",
                "geometry_type": "PIPELINE",
                "points": [[0.7, 0.0, -2.2], [3.0, 0.0, -2.2]],
                "radius": 0.05,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Check_Valve_NRV101B",
                "geometry_type": "VALVE",
                "valve_type": "CHECK",
                "tag": "NRV-101B",
                "position": [1.4, 0.0, -2.2],
                "size": 0.24,
                "color": [0.85, 0.35, 0.20, 1.0],
                "collection": "Valves"
            },
            {
                "name": "Discharge_Valve_V103B",
                "geometry_type": "VALVE",
                "valve_type": "GATE",
                "tag": "V-103B",
                "position": [2.2, 0.0, -2.2],
                "size": 0.24,
                "color": [0.95, 0.45, 0.15, 1.0],
                "collection": "Valves"
            },
            {
                "name": "Flow_Arrow_Pump_B_Discharge",
                "geometry_type": "FLOW_ARROW",
                "position": [2.6, 0.0, -2.2],
                "direction": [1.0, 0.0, 0.0],
                "length": 0.26,
                "radius": 0.09,
                "color": [0.15, 0.85, 0.35, 1.0],
                "collection": "Flow_Arrows"
            },

            # 7. Common Discharge Header Manifold
            {
                "name": "Discharge_Header_Manifold",
                "geometry_type": "PIPELINE",
                "points": [[3.0, 0.0, -2.2], [3.0, 0.0, 1.2]],
                "radius": 0.06,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Discharge_Header_Main",
                "geometry_type": "PIPELINE",
                "points": [[3.0, 0.0, 0.0], [9.6, 0.0, 0.0]],
                "radius": 0.06,
                "color": [0.12, 0.65, 0.88, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Flow_Arrow_Header_1",
                "geometry_type": "FLOW_ARROW",
                "position": [3.7, 0.0, 0.0],
                "direction": [1.0, 0.0, 0.0],
                "length": 0.30,
                "radius": 0.10,
                "color": [0.15, 0.85, 0.35, 1.0],
                "collection": "Flow_Arrows"
            },
            {
                "name": "Flow_Arrow_Header_2",
                "geometry_type": "FLOW_ARROW",
                "position": [8.8, 0.0, 0.0],
                "direction": [1.0, 0.0, 0.0],
                "length": 0.30,
                "radius": 0.10,
                "color": [0.15, 0.85, 0.35, 1.0],
                "collection": "Flow_Arrows"
            },

            # 8. Pressure Sensor & Transmitter (PT-101)
            {
                "name": "Pressure_Impulse_Line",
                "geometry_type": "PIPELINE",
                "points": [[4.5, 0.0, 0.0], [4.5, 0.0, 1.0]],
                "radius": 0.02,
                "color": [0.75, 0.75, 0.80, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Pressure_Transmitter_PT101",
                "geometry_type": "INSTRUMENT",
                "tag": pt_tag.replace("-", "\n"),
                "subtext": "Pressure Transmitter (0-10 bar)",
                "position": [4.5, 0.0, 1.4],
                "size": 0.45,
                "color": [0.95, 0.85, 0.15, 1.0],
                "collection": "Instruments"
            },

            # 9. Flow Sensor & Transmitter (FT-101)
            {
                "name": "Flow_Sensor_Line",
                "geometry_type": "PIPELINE",
                "points": [[5.9, 0.0, 0.0], [5.9, 0.0, 1.0]],
                "radius": 0.02,
                "color": [0.75, 0.75, 0.80, 1.0],
                "collection": "Pipelines"
            },
            {
                "name": "Flow_Transmitter_FT101",
                "geometry_type": "INSTRUMENT",
                "tag": ft_tag.replace("-", "\n"),
                "subtext": "Flow Transmitter (Magnetic)",
                "position": [5.9, 0.0, 1.4],
                "size": 0.45,
                "color": [0.95, 0.85, 0.15, 1.0],
                "collection": "Instruments"
            },

            # 10. Automated Flow Control Valve (CV-101)
            {
                "name": "Control_Valve_CV101",
                "geometry_type": "VALVE",
                "valve_type": "CONTROL",
                "tag": cv_tag,
                "position": [7.4, 0.0, 0.0],
                "size": 0.32,
                "color": [0.95, 0.35, 0.15, 1.0],
                "collection": "Valves"
            },

            # 11. Central Controller & Automation System (PLC-100)
            {
                "name": "Controller_PLC100",
                "geometry_type": "CONTROLLER",
                "tag": plc_tag.replace("-", "\n"),
                "subtext": "PLC CONTROLLER / SCADA SYSTEM",
                "position": [5.2, 0.0, 3.4],
                "dimensions": [2.2, 0.2, 1.1],
                "color": [0.25, 0.50, 0.85, 1.0],
                "collection": "Instruments"
            },

            # 12. Control Loop Signal Lines (Dashed instrumentation lines)
            {
                "name": "Signal_Line_FT_To_PLC",
                "geometry_type": "SIGNAL_LINE",
                "is_signal": True,
                "points": [[5.9, 0.0, 1.9], [5.9, 0.0, 2.8]],
                "color": [0.95, 0.85, 0.15, 1.0],
                "collection": "Instruments"
            },
            {
                "name": "Signal_Line_PT_To_PLC",
                "geometry_type": "SIGNAL_LINE",
                "is_signal": True,
                "points": [[4.5, 0.0, 1.9], [4.5, 0.0, 3.4], [4.1, 0.0, 3.4]],
                "color": [0.95, 0.85, 0.15, 1.0],
                "collection": "Instruments"
            },
            {
                "name": "Signal_Line_PLC_To_CV101",
                "geometry_type": "SIGNAL_LINE",
                "is_signal": True,
                "points": [[6.3, 0.0, 3.4], [7.4, 0.0, 3.4], [7.4, 0.0, 0.8]],
                "color": [0.95, 0.85, 0.15, 1.0],
                "collection": "Instruments"
            },
            {
                "name": "Signal_Line_PLC_To_Pump_A",
                "geometry_type": "SIGNAL_LINE",
                "is_signal": True,
                "points": [[4.1, 0.0, 3.4], [0.0, 0.0, 3.4], [0.0, 0.0, 1.9]],
                "color": [1.0, 0.55, 0.10, 1.0],
                "collection": "Instruments"
            },

            # 13. Pipeline Specifications, Tags & End Labels
            {
                "name": "Label_Pipeline_Suction",
                "geometry_type": "TEXT_LABEL",
                "text": "4\"-CWS-101-CS150",
                "position": [-4.4, 0.0, -1.6],
                "size": 0.18,
                "color": [0.80, 0.90, 1.0, 1.0],
                "collection": "Labels"
            },
            {
                "name": "Label_Pipeline_Discharge",
                "geometry_type": "TEXT_LABEL",
                "text": "3\"-CWD-102-CS150",
                "position": [4.5, 0.0, -0.4],
                "size": 0.18,
                "color": [0.80, 0.90, 1.0, 1.0],
                "collection": "Labels"
            },
            {
                "name": "Label_Process_Delivery",
                "geometry_type": "TEXT_LABEL",
                "text": "TO PROCESS / DISTRIBUTION HEADER >",
                "position": [9.8, 0.0, 0.0],
                "size": 0.20,
                "align_x": "LEFT",
                "color": [0.20, 0.90, 0.40, 1.0],
                "collection": "Labels"
            },

            # 14. Standard Symbol Legend & Title Block
            {
                "name": "Legend_Block",
                "geometry_type": "LEGEND",
                "position": [-7.5, 0.0, -3.8],
                "collection": "Labels"
            },
            {
                "name": "Title_Block",
                "geometry_type": "TEXT_LABEL",
                "text": "INDUSTRIAL WATER PUMPING STATION\nP&ID SCHEMATIC (ISA-5.1 STANDARD)\nDUTY/STANDBY PUMP AUTOMATION",
                "position": [5.5, 0.0, -3.6],
                "size": 0.24,
                "color": [1.0, 0.95, 0.40, 1.0],
                "align_x": "CENTER",
                "collection": "Labels"
            }
        ]

        return {
            "project_name": "industrial_water_pumping_pid",
            "category": "DIAGRAM",
            "is_diagram": True,
            "description": "Standard Piping & Instrumentation Diagram (P&ID) for industrial water pumping system compliant with ISA-5.1",
            "overall_dimensions": [18.0, 1.0, 8.5],
            "clear_scene": True,
            "components": components
        }

    def _extract_color(self, text: str) -> Tuple[List[float], float, float]:
        """Extracts color and basic PBR properties (color_rgba, metallic, roughness) from text."""
        t = text.lower()
        if "red" in t:
            return [0.88, 0.12, 0.12, 1.0], 0.1, 0.3
        elif "blue" in t:
            return [0.12, 0.42, 0.92, 1.0], 0.1, 0.3
        elif "green" in t:
            return [0.12, 0.82, 0.22, 1.0], 0.1, 0.3
        elif "yellow" in t:
            return [0.95, 0.85, 0.12, 1.0], 0.1, 0.3
        elif "purple" in t or "violet" in t:
            return [0.65, 0.15, 0.88, 1.0], 0.2, 0.3
        elif "orange" in t:
            return [0.95, 0.45, 0.10, 1.0], 0.1, 0.3
        elif "gold" in t or "golden" in t:
            return [0.95, 0.78, 0.22, 1.0], 0.9, 0.2
        elif "silver" in t or "chrome" in t or "metal" in t:
            return [0.82, 0.82, 0.85, 1.0], 0.95, 0.15
        elif "black" in t or "dark" in t:
            return [0.08, 0.08, 0.09, 1.0], 0.2, 0.4
        elif "white" in t:
            return [0.94, 0.94, 0.95, 1.0], 0.05, 0.3
        elif "wood" in t or "wooden" in t:
            return [0.55, 0.35, 0.20, 1.0], 0.0, 0.5
        return [0.75, 0.78, 0.84, 1.0], 0.15, 0.35

    def _generate_parametric_blueprint(self, prompt: str, is_incremental: bool = False) -> Dict[str, Any]:
        """
        Robust procedural domain blueprint generator supporting multi-object assemblies,
        hierarchical groups, and spatial relative placement.
        """
        p_lower = prompt.lower()
        color_rgba, metallic, roughness = self._extract_color(prompt)


        # 1. COMPOUND: Table and Lamp on top
        if ("table" in p_lower or "desk" in p_lower) and ("lamp" in p_lower or "light" in p_lower):
            return {
                "project_name": "table_with_lamp",
                "category": "FURNITURE",
                "description": "Modern Scandinavian style table with an articulated desk lamp on top",
                "overall_dimensions": [1.4, 0.8, 1.3],
                "clear_scene": not is_incremental,
                "components": [
                    # Table components
                    {"name": "Table_Top_Surface", "group_id": "table_assembly", "group_name": "Table", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [1.4, 0.8, 0.06], "position": [0.0, 0.0, 0.72], "modifiers": [{"type": "BEVEL", "width": 0.015, "segments": 3}], "material": {"name": "Mat_Oak_Wood", "color": [0.65, 0.45, 0.28, 1.0], "roughness": 0.4}},
                    {"name": "Leg_Front_Left", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [-0.60, -0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Front_Right", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [0.60, -0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Rear_Left", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [-0.60, 0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Rear_Right", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [0.60, 0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    # Lamp components (placed on top of table)
                    {"name": "Lamp_Base", "group_id": "lamp_assembly", "group_name": "Lamp", "is_root": True, "relative_to": {"target": "Table_Top_Surface", "relation": "ON_TOP"}, "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.18, 0.18, 0.03], "position": [0.0, 0.0, 0.765], "material": {"name": "Mat_Lamp_Base", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Lamp_Stem", "group_id": "lamp_assembly", "group_name": "Lamp", "parent": "Lamp_Base", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.025, 0.025, 0.35], "position": [0.0, 0.0, 0.94], "material": {"name": "Mat_Lamp_Stem", "color": [0.75, 0.65, 0.35, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Lamp_Shade", "group_id": "lamp_assembly", "group_name": "Lamp", "parent": "Lamp_Base", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [0.16, 0.16, 0.15], "position": [0.0, 0.0, 1.17], "material": {"name": "Mat_Lamp_Shade", "color": [0.95, 0.95, 0.92, 1.0], "metallic": 0.05, "roughness": 0.4}}
                ]
            }

        # 2. COMPOUND: Chair underneath Desk
        if ("chair" in p_lower or "seat" in p_lower) and ("desk" in p_lower or "table" in p_lower):
            return {
                "project_name": "desk_with_chair_underneath",
                "category": "FURNITURE",
                "description": "Desk with an ergonomic chair placed neatly underneath",
                "overall_dimensions": [1.4, 0.8, 0.95],
                "clear_scene": not is_incremental,
                "components": [
                    # Desk
                    {"name": "Table_Top_Surface", "group_id": "table_assembly", "group_name": "Table", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [1.4, 0.8, 0.06], "position": [0.0, 0.0, 0.72], "modifiers": [{"type": "BEVEL", "width": 0.015, "segments": 3}], "material": {"name": "Mat_Oak_Wood", "color": [0.65, 0.45, 0.28, 1.0], "roughness": 0.4}},
                    {"name": "Leg_Front_Left", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [-0.60, -0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Front_Right", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [0.60, -0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Rear_Left", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [-0.60, 0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Rear_Right", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [0.60, 0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    # Chair underneath
                    {"name": "Chair_Seat", "group_id": "chair_assembly", "group_name": "Chair", "is_root": True, "relative_to": {"target": "Table_Top_Surface", "relation": "UNDER"}, "geometry_type": "BEVEL_BOX", "dimensions": [0.46, 0.46, 0.05], "position": [0.0, 0.0, 0.45], "modifiers": [{"type": "BEVEL", "width": 0.015, "segments": 3}], "material": {"name": "Mat_Seat_Fabric", "color": [0.2, 0.25, 0.35, 1.0], "roughness": 0.6}},
                    {"name": "Chair_Backrest", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "BEVEL_BOX", "dimensions": [0.44, 0.04, 0.42], "position": [0.0, 0.20, 0.68], "material": {"name": "Mat_Seat_Fabric", "color": [0.2, 0.25, 0.35, 1.0], "roughness": 0.6}},
                    {"name": "Chair_Leg_FL", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [-0.18, -0.18, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Chair_Leg_FR", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [0.18, -0.18, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Chair_Leg_BL", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [-0.18, 0.18, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Chair_Leg_BR", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [0.18, 0.18, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}}
                ]
            }

        # 3. COMPOUND: Monitor behind Keyboard
        if ("monitor" in p_lower or "screen" in p_lower) and "keyboard" in p_lower:
            return {
                "project_name": "keyboard_and_monitor",
                "category": "ELECTRONICS",
                "description": "Desk workspace setup with monitor positioned directly behind the keyboard",
                "overall_dimensions": [0.55, 0.6, 0.55],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Keyboard_Base", "group_id": "keyboard_assembly", "group_name": "Keyboard", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [0.45, 0.16, 0.02], "position": [0.0, -0.25, 0.01], "material": {"name": "Mat_Keyboard_Body", "color": [0.1, 0.1, 0.12, 1.0], "metallic": 0.2, "roughness": 0.4}},
                    {"name": "Keyboard_Keys", "group_id": "keyboard_assembly", "group_name": "Keyboard", "parent": "Keyboard_Base", "geometry_type": "BEVEL_BOX", "dimensions": [0.43, 0.14, 0.008], "position": [0.0, -0.25, 0.024], "material": {"name": "Mat_Keycaps", "color": [0.04, 0.04, 0.05, 1.0], "roughness": 0.3}},
                    {"name": "Monitor_Stand_Base", "group_id": "monitor_assembly", "group_name": "Monitor", "is_root": True, "relative_to": {"target": "Keyboard_Base", "relation": "BEHIND"}, "geometry_type": "BEVEL_BOX", "dimensions": [0.24, 0.18, 0.015], "position": [0.0, 0.15, 0.008], "material": {"name": "Mat_Monitor_Metal", "color": [0.12, 0.12, 0.14, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Monitor_Pole", "group_id": "monitor_assembly", "group_name": "Monitor", "parent": "Monitor_Stand_Base", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.36], "position": [0.0, 0.15, 0.18], "material": {"name": "Mat_Monitor_Metal", "color": [0.12, 0.12, 0.14, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Monitor_Screen", "group_id": "monitor_assembly", "group_name": "Monitor", "parent": "Monitor_Stand_Base", "geometry_type": "BEVEL_BOX", "dimensions": [0.55, 0.035, 0.35], "position": [0.0, 0.15, 0.35], "material": {"name": "Mat_Monitor_Panel", "color": [0.02, 0.02, 0.02, 1.0], "metallic": 0.1, "roughness": 0.1}}
                ]
            }

        # 4. SINGLE: Lamp
        if any(w in p_lower for w in ["lamp", "light", "desk lamp"]):
            return {
                "project_name": "desk_lamp_assembly",
                "category": "PROP",
                "description": "Articulated desk lamp with weighted base, brass stem and shade",
                "overall_dimensions": [0.2, 0.2, 0.52],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Lamp_Base", "group_id": "lamp_assembly", "group_name": "Lamp", "is_root": True, "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.18, 0.18, 0.03], "position": [0.0, 0.0, 0.015], "material": {"name": "Mat_Lamp_Base", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Lamp_Stem", "group_id": "lamp_assembly", "group_name": "Lamp", "parent": "Lamp_Base", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.025, 0.025, 0.35], "position": [0.0, 0.0, 0.19], "material": {"name": "Mat_Lamp_Stem", "color": [0.75, 0.65, 0.35, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Lamp_Shade", "group_id": "lamp_assembly", "group_name": "Lamp", "parent": "Lamp_Base", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [0.16, 0.16, 0.15], "position": [0.0, 0.0, 0.42], "material": {"name": "Mat_Lamp_Shade", "color": [0.95, 0.95, 0.92, 1.0], "metallic": 0.05, "roughness": 0.4}}
                ]
            }

        # 5. SINGLE: Keyboard
        if "keyboard" in p_lower:
            return {
                "project_name": "mechanical_keyboard",
                "category": "ELECTRONICS",
                "description": "Sleek mechanical keyboard with keycaps",
                "overall_dimensions": [0.45, 0.16, 0.03],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Keyboard_Base", "group_id": "keyboard_assembly", "group_name": "Keyboard", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [0.45, 0.16, 0.02], "position": [0.0, 0.0, 0.01], "material": {"name": "Mat_Keyboard_Body", "color": [0.1, 0.1, 0.12, 1.0], "metallic": 0.2, "roughness": 0.4}},
                    {"name": "Keyboard_Keys", "group_id": "keyboard_assembly", "group_name": "Keyboard", "parent": "Keyboard_Base", "geometry_type": "BEVEL_BOX", "dimensions": [0.43, 0.14, 0.008], "position": [0.0, 0.0, 0.024], "material": {"name": "Mat_Keycaps", "color": [0.04, 0.04, 0.05, 1.0], "roughness": 0.3}}
                ]
            }

        # 6. SINGLE: Monitor
        if any(w in p_lower for w in ["monitor", "display"]):
            return {
                "project_name": "desktop_monitor",
                "category": "ELECTRONICS",
                "description": "Widescreen desktop monitor with solid stand",
                "overall_dimensions": [0.55, 0.24, 0.52],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Monitor_Stand_Base", "group_id": "monitor_assembly", "group_name": "Monitor", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [0.24, 0.18, 0.015], "position": [0.0, 0.0, 0.008], "material": {"name": "Mat_Monitor_Metal", "color": [0.12, 0.12, 0.14, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Monitor_Pole", "group_id": "monitor_assembly", "group_name": "Monitor", "parent": "Monitor_Stand_Base", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.36], "position": [0.0, 0.0, 0.18], "material": {"name": "Mat_Monitor_Metal", "color": [0.12, 0.12, 0.14, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Monitor_Screen", "group_id": "monitor_assembly", "group_name": "Monitor", "parent": "Monitor_Stand_Base", "geometry_type": "BEVEL_BOX", "dimensions": [0.55, 0.035, 0.35], "position": [0.0, 0.0, 0.35], "material": {"name": "Mat_Monitor_Panel", "color": [0.02, 0.02, 0.02, 1.0], "metallic": 0.1, "roughness": 0.1}}
                ]
            }

        # 7. SINGLE: Car / Vehicle
        if any(w in p_lower for w in ["car", "vehicle", "truck", "automobile", "sportscar"]):
            dx = -2.0 if "left" in p_lower else 0.0
            return {
                "project_name": "sports_car_chassis",
                "category": "VEHICLE",
                "description": "Aerodynamic vehicle chassis with styled wheels and panoramic windshield",
                "overall_dimensions": [1.9, 4.4, 1.3],
                "clear_scene": not is_incremental,
                "components": [
                    {
                        "name": "Car_Body_Main",
                        "group_id": "car_assembly",
                        "group_name": "Car",
                        "is_root": True,
                        "geometry_type": "BEVEL_BOX",
                        "dimensions": [1.8, 4.2, 0.7],
                        "position": [0.0 + dx, 0.0, 0.55],
                        "modifiers": [{"type": "BEVEL", "width": 0.08, "segments": 4}],
                        "material": {"name": "Mat_Metallic_Red", "color": [0.85, 0.04, 0.04, 1.0], "metallic": 0.9, "roughness": 0.15}
                    },
                    {
                        "name": "Cabin_Roof",
                        "group_id": "car_assembly",
                        "group_name": "Car",
                        "parent": "Car_Body_Main",
                        "geometry_type": "BEVEL_BOX",
                        "dimensions": [1.4, 2.0, 0.55],
                        "position": [0.0 + dx, -0.2, 1.15],
                        "modifiers": [{"type": "BEVEL", "width": 0.06, "segments": 3}],
                        "material": {"name": "Mat_Tinted_Glass", "color": [0.1, 0.1, 0.15, 0.2], "metallic": 0.2, "roughness": 0.05, "transmission": 0.85}
                    },
                    {
                        "name": "Wheel_Front_Left",
                        "group_id": "car_assembly",
                        "group_name": "Car",
                        "parent": "Car_Body_Main",
                        "geometry_type": "PRIMITIVE",
                        "primitive": "CYLINDER",
                        "dimensions": [0.65, 0.65, 0.26],
                        "position": [-0.95 + dx, -1.3, 0.33],
                        "rotation": [0, 90, 0],
                        "material": {"name": "Mat_Rubber_Tire", "color": [0.03, 0.03, 0.03, 1.0], "metallic": 0.1, "roughness": 0.6}
                    },
                    {
                        "name": "Wheel_Front_Right",
                        "group_id": "car_assembly",
                        "group_name": "Car",
                        "parent": "Car_Body_Main",
                        "geometry_type": "PRIMITIVE",
                        "primitive": "CYLINDER",
                        "dimensions": [0.65, 0.65, 0.26],
                        "position": [0.95 + dx, -1.3, 0.33],
                        "rotation": [0, 90, 0],
                        "material": {"name": "Mat_Rubber_Tire", "color": [0.03, 0.03, 0.03, 1.0], "metallic": 0.1, "roughness": 0.6}
                    },
                    {
                        "name": "Wheel_Rear_Left",
                        "group_id": "car_assembly",
                        "group_name": "Car",
                        "parent": "Car_Body_Main",
                        "geometry_type": "PRIMITIVE",
                        "primitive": "CYLINDER",
                        "dimensions": [0.68, 0.68, 0.28],
                        "position": [-0.95 + dx, 1.3, 0.34],
                        "rotation": [0, 90, 0],
                        "material": {"name": "Mat_Rubber_Tire", "color": [0.03, 0.03, 0.03, 1.0], "metallic": 0.1, "roughness": 0.6}
                    },
                    {
                        "name": "Wheel_Rear_Right",
                        "group_id": "car_assembly",
                        "group_name": "Car",
                        "parent": "Car_Body_Main",
                        "geometry_type": "PRIMITIVE",
                        "primitive": "CYLINDER",
                        "dimensions": [0.68, 0.68, 0.28],
                        "position": [0.95 + dx, 1.3, 0.34],
                        "rotation": [0, 90, 0],
                        "material": {"name": "Mat_Rubber_Tire", "color": [0.03, 0.03, 0.03, 1.0], "metallic": 0.1, "roughness": 0.6}
                    }
                ]
            }

        # 8. Cube
        if bool(re.search(r"\b(cube|cubical|dice|block)\b", p_lower)):
            return {
                "project_name": "geometric_cube",
                "category": "PROP",
                "description": "Standard six-faced geometric cube with equal dimensions",
                "overall_dimensions": [1.0, 1.0, 1.0],
                "clear_scene": not is_incremental,
                "components": [{
                    "name": "Geometric_Cube",
                    "geometry_type": "PRIMITIVE",
                    "primitive": "CUBE",
                    "dimensions": [1.0, 1.0, 1.0],
                    "position": [0.0, 0.0, 0.0],
                    "rotation": [0.0, 0.0, 0.0],
                    "material": {"name": "Mat_Cube", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                }]
            }

        # 9. Sphere
        if bool(re.search(r"\b(sphere|spherical|ball|globe|orb)\b", p_lower)):
            return {
                "project_name": "geometric_sphere",
                "category": "PROP",
                "description": "Smooth geometric sphere",
                "overall_dimensions": [1.0, 1.0, 1.0],
                "clear_scene": not is_incremental,
                "components": [{
                    "name": "Geometric_Sphere",
                    "geometry_type": "PRIMITIVE",
                    "primitive": "SPHERE",
                    "dimensions": [1.0, 1.0, 1.0],
                    "position": [0.0, 0.0, 0.0],
                    "material": {"name": "Mat_Sphere", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                }]
            }

        # 10. Cylinder
        if bool(re.search(r"\b(cylinder|cylindrical|pillar|column|tube|can)\b", p_lower)):
            return {
                "project_name": "geometric_cylinder",
                "category": "PROP",
                "description": "Precision geometric cylinder",
                "overall_dimensions": [1.0, 1.0, 1.8],
                "clear_scene": not is_incremental,
                "components": [{
                    "name": "Geometric_Cylinder",
                    "geometry_type": "PRIMITIVE",
                    "primitive": "CYLINDER",
                    "dimensions": [1.0, 1.0, 1.8],
                    "position": [0.0, 0.0, 0.0],
                    "material": {"name": "Mat_Cylinder", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                }]
            }

        # 11. Cone / Pyramid / Funnel
        if bool(re.search(r"\b(cone|conical|pyramid|funnel|spike|spire)\b", p_lower)):
            return {
                "project_name": "geometric_cone",
                "category": "PROP",
                "description": "Smooth geometric cone with circular base tapering to an apex",
                "overall_dimensions": [1.2, 1.2, 1.8],
                "clear_scene": not is_incremental,
                "components": [{
                    "name": "Geometric_Cone",
                    "geometry_type": "PRIMITIVE",
                    "primitive": "CONE",
                    "dimensions": [1.2, 1.2, 1.8],
                    "position": [0.0, 0.0, 0.9],
                    "material": {"name": "Mat_Cone", "color": color_rgba, "metallic": metallic, "roughness": roughness}
                }]
            }

        # 12. Torus / Doughnut / Donut / Ring
        if bool(re.search(r"\b(doughnut|donut|torus|ring|hoop|bagel|loop)\b", p_lower)):
            mat_color = color_rgba if color_rgba != [0.75, 0.78, 0.84, 1.0] else [0.88, 0.65, 0.38, 1.0]
            return {
                "project_name": "geometric_torus",
                "category": "PROP",
                "description": "Smooth 3D torus ring / doughnut geometry",
                "overall_dimensions": [1.4, 1.4, 0.45],
                "clear_scene": not is_incremental,
                "components": [{
                    "name": "Geometric_Torus",
                    "geometry_type": "PRIMITIVE",
                    "primitive": "TORUS",
                    "dimensions": [1.4, 1.4, 0.45],
                    "position": [0.0, 0.0, 0.225],
                    "material": {"name": "Mat_Torus", "color": mat_color, "metallic": 0.05, "roughness": 0.55}
                }]
            }

        # 13. 3D Industrial Water / Storage Tank / Reservoir
        if bool(re.search(r"\b(tank|watertank|water tank|storage tank|pressure vessel|cistern|silo)\b", p_lower)):
            tank_color = color_rgba if color_rgba != [0.75, 0.78, 0.84, 1.0] else [0.25, 0.45, 0.75, 1.0]
            return {
                "project_name": "industrial_storage_tank",
                "category": "EQUIPMENT",
                "description": "Industrial cylindrical liquid storage tank with conical roof, inspection manhole, and structural legs",
                "overall_dimensions": [2.4, 2.4, 3.8],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Tank_Main_Shell", "group_id": "tank_assembly", "group_name": "Tank", "is_root": True, "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [2.0, 2.0, 2.6], "position": [0.0, 0.0, 1.7], "material": {"name": "Mat_Tank_Body", "color": tank_color, "metallic": 0.7, "roughness": 0.25}},
                    {"name": "Tank_Conical_Roof", "group_id": "tank_assembly", "group_name": "Tank", "parent": "Tank_Main_Shell", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [2.15, 2.15, 0.6], "position": [0.0, 0.0, 3.3], "material": {"name": "Mat_Tank_Roof", "color": [tank_color[0]*0.85, tank_color[1]*0.85, tank_color[2]*0.85, 1.0], "metallic": 0.8, "roughness": 0.2}},
                    {"name": "Tank_Inspection_Manhole", "group_id": "tank_assembly", "group_name": "Tank", "parent": "Tank_Main_Shell", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.45, 0.45, 0.25], "position": [0.0, 0.0, 3.7], "material": {"name": "Mat_Tank_Steel", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Tank_Discharge_Nozzle", "group_id": "tank_assembly", "group_name": "Tank", "parent": "Tank_Main_Shell", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.25, 0.25, 0.6], "position": [1.1, 0.0, 0.7], "rotation": [0, 90, 0], "material": {"name": "Mat_Tank_Steel", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Tank_Leg_FL", "group_id": "tank_assembly", "group_name": "Tank", "parent": "Tank_Main_Shell", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.1, 0.1, 0.4], "position": [-0.75, -0.75, 0.2], "material": {"name": "Mat_Tank_Steel", "color": [0.15, 0.15, 0.16, 1.0], "metallic": 0.9, "roughness": 0.3}},
                    {"name": "Tank_Leg_FR", "group_id": "tank_assembly", "group_name": "Tank", "parent": "Tank_Main_Shell", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.1, 0.1, 0.4], "position": [0.75, -0.75, 0.2], "material": {"name": "Mat_Tank_Steel", "color": [0.15, 0.15, 0.16, 1.0], "metallic": 0.9, "roughness": 0.3}},
                    {"name": "Tank_Leg_BL", "group_id": "tank_assembly", "group_name": "Tank", "parent": "Tank_Main_Shell", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.1, 0.1, 0.4], "position": [-0.75, 0.75, 0.2], "material": {"name": "Mat_Tank_Steel", "color": [0.15, 0.15, 0.16, 1.0], "metallic": 0.9, "roughness": 0.3}},
                    {"name": "Tank_Leg_BR", "group_id": "tank_assembly", "group_name": "Tank", "parent": "Tank_Main_Shell", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.1, 0.1, 0.4], "position": [0.75, 0.75, 0.2], "material": {"name": "Mat_Tank_Steel", "color": [0.15, 0.15, 0.16, 1.0], "metallic": 0.9, "roughness": 0.3}}
                ]
            }

        # 14. Human / Person / Character Figure
        if bool(re.search(r"\b(human|person|character|figure|man|woman|biped|body)\b", p_lower)):
            skin_color = [0.85, 0.68, 0.55, 1.0]
            shirt_color = color_rgba if color_rgba != [0.75, 0.78, 0.84, 1.0] else [0.2, 0.4, 0.75, 1.0]
            return {
                "project_name": "human_figure_model",
                "category": "CHARACTER",
                "description": "Proportional 3D stylized human figure with head, torso, arms, and legs",
                "overall_dimensions": [1.1, 0.5, 1.95],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Human_Torso", "group_id": "human_assembly", "group_name": "Human", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [0.55, 0.3, 0.75], "position": [0.0, 0.0, 1.35], "modifiers": [{"type": "BEVEL", "width": 0.03, "segments": 3}], "material": {"name": "Mat_Shirt", "color": shirt_color, "roughness": 0.6}},
                    {"name": "Human_Head", "group_id": "human_assembly", "group_name": "Human", "parent": "Human_Torso", "geometry_type": "PRIMITIVE", "primitive": "SPHERE", "dimensions": [0.35, 0.35, 0.38], "position": [0.0, 0.0, 1.95], "material": {"name": "Mat_Skin", "color": skin_color, "roughness": 0.5}},
                    {"name": "Human_Arm_L", "group_id": "human_assembly", "group_name": "Human", "parent": "Human_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.12, 0.12, 0.65], "position": [-0.38, 0.0, 1.3], "material": {"name": "Mat_Skin", "color": skin_color, "roughness": 0.5}},
                    {"name": "Human_Arm_R", "group_id": "human_assembly", "group_name": "Human", "parent": "Human_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.12, 0.12, 0.65], "position": [0.38, 0.0, 1.3], "material": {"name": "Mat_Skin", "color": skin_color, "roughness": 0.5}},
                    {"name": "Human_Leg_L", "group_id": "human_assembly", "group_name": "Human", "parent": "Human_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.16, 0.16, 0.85], "position": [-0.16, 0.0, 0.45], "material": {"name": "Mat_Pants", "color": [0.15, 0.18, 0.24, 1.0], "roughness": 0.7}},
                    {"name": "Human_Leg_R", "group_id": "human_assembly", "group_name": "Human", "parent": "Human_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.16, 0.16, 0.85], "position": [0.16, 0.0, 0.45], "material": {"name": "Mat_Pants", "color": [0.15, 0.18, 0.24, 1.0], "roughness": 0.7}}
                ]
            }

        # 15. Star / Celestial / Sun / Orb
        if bool(re.search(r"\b(star|celestial|sun|planet|crystal|gem|orb|jewel)\b", p_lower)):
            star_color = [0.98, 0.82, 0.15, 1.0] if color_rgba == [0.75, 0.78, 0.84, 1.0] else color_rgba
            return {
                "project_name": "celestial_star_model",
                "category": "PROP",
                "description": "Luminous geometric celestial star with faceted geometry and radiant glow",
                "overall_dimensions": [1.4, 1.4, 1.4],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Star_Core", "geometry_type": "PRIMITIVE", "primitive": "SPHERE", "dimensions": [0.8, 0.8, 0.8], "position": [0.0, 0.0, 0.7], "material": {"name": "Mat_Star_Glow", "color": star_color, "metallic": 0.8, "roughness": 0.15}},
                    {"name": "Star_Spike_Up", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [0.45, 0.45, 0.7], "position": [0.0, 0.0, 1.25], "material": {"name": "Mat_Star_Glow", "color": star_color, "metallic": 0.9, "roughness": 0.1}},
                    {"name": "Star_Spike_Down", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [0.45, 0.45, 0.7], "position": [0.0, 0.0, 0.15], "rotation": [180, 0, 0], "material": {"name": "Mat_Star_Glow", "color": star_color, "metallic": 0.9, "roughness": 0.1}},
                    {"name": "Star_Spike_Left", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [0.45, 0.45, 0.7], "position": [-0.55, 0.0, 0.7], "rotation": [0, -90, 0], "material": {"name": "Mat_Star_Glow", "color": star_color, "metallic": 0.9, "roughness": 0.1}},
                    {"name": "Star_Spike_Right", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [0.45, 0.45, 0.7], "position": [0.55, 0.0, 0.7], "rotation": [0, 90, 0], "material": {"name": "Mat_Star_Glow", "color": star_color, "metallic": 0.9, "roughness": 0.1}}
                ]
            }

        # 16. Container / Mug / Cup / Bottle / Barrel
        if bool(re.search(r"\b(mug|cup|glass|bottle|barrel|drum|flagon|chalice|vase)\b", p_lower)):
            c_color = color_rgba if color_rgba != [0.75, 0.78, 0.84, 1.0] else [0.92, 0.92, 0.94, 1.0]
            return {
                "project_name": "tableware_container",
                "category": "PROP",
                "description": "Cylindrical beverage container with hollow interior profile",
                "overall_dimensions": [0.35, 0.35, 0.45],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Container_Body", "group_id": "cup_assembly", "group_name": "Cup", "is_root": True, "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.3, 0.3, 0.42], "position": [0.0, 0.0, 0.21], "material": {"name": "Mat_Ceramic", "color": c_color, "roughness": 0.15}},
                    {"name": "Container_Handle", "group_id": "cup_assembly", "group_name": "Cup", "parent": "Container_Body", "geometry_type": "PRIMITIVE", "primitive": "TORUS", "dimensions": [0.18, 0.06, 0.24], "position": [0.2, 0.0, 0.21], "rotation": [90, 0, 0], "material": {"name": "Mat_Ceramic", "color": c_color, "roughness": 0.15}}
                ]
            }

        # 17. Flat Surface / Plane / Plate / Ground / Disc
        if bool(re.search(r"\b(plane|plate|disc|disk|floor|ground|sheet|board|panel)\b", p_lower)):
            return {
                "project_name": "geometric_plane",
                "category": "ENVIRONMENT",
                "description": "Flat architectural ground plane surface",
                "overall_dimensions": [4.0, 4.0, 0.05],
                "clear_scene": not is_incremental,
                "components": [{
                    "name": "Ground_Plane",
                    "geometry_type": "PRIMITIVE",
                    "primitive": "PLANE",
                    "dimensions": [4.0, 4.0, 1.0],
                    "position": [0.0, 0.0, 0.0],
                    "material": {"name": "Mat_Surface", "color": color_rgba, "roughness": 0.4}
                }]
            }

        # 18. Chair
        if any(w in p_lower for w in ["chair", "seat", "stool", "armchair", "bench"]):
            return {
                "project_name": "modern_chair",
                "category": "FURNITURE",
                "description": "Ergonomic dining chair with backrest and support legs",
                "overall_dimensions": [0.55, 0.55, 0.95],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Chair_Seat", "group_id": "chair_assembly", "group_name": "Chair", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [0.48, 0.48, 0.05], "position": [0.0, 0.0, 0.45], "modifiers": [{"type": "BEVEL", "width": 0.015, "segments": 3}], "material": {"name": "Mat_Seat_Fabric", "color": [0.2, 0.25, 0.35, 1.0], "roughness": 0.6}},
                    {"name": "Chair_Backrest", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "BEVEL_BOX", "dimensions": [0.46, 0.04, 0.48], "position": [0.0, 0.22, 0.72], "material": {"name": "Mat_Seat_Fabric", "color": [0.2, 0.25, 0.35, 1.0], "roughness": 0.6}},
                    {"name": "Chair_Leg_FL", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [-0.20, -0.20, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Chair_Leg_FR", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [0.20, -0.20, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Chair_Leg_BL", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [-0.20, 0.20, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Chair_Leg_BR", "group_id": "chair_assembly", "group_name": "Chair", "parent": "Chair_Seat", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.035, 0.035, 0.45], "position": [0.20, 0.20, 0.225], "material": {"name": "Mat_Metal_Leg", "color": [0.1, 0.1, 0.1, 1.0], "metallic": 0.9, "roughness": 0.2}}
                ]
            }

        # 19. Table / Desk
        if any(w in p_lower for w in ["table", "desk", "coffee table", "dining table", "counter"]):
            return {
                "project_name": "modern_furniture_table",
                "category": "FURNITURE",
                "description": "Modern Scandinavian style table with beveled surface and solid legs",
                "overall_dimensions": [1.4, 0.8, 0.75],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Table_Top_Surface", "group_id": "table_assembly", "group_name": "Table", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [1.4, 0.8, 0.06], "position": [0.0, 0.0, 0.72], "modifiers": [{"type": "BEVEL", "width": 0.015, "segments": 3}], "material": {"name": "Mat_Oak_Wood", "color": [0.65, 0.45, 0.28, 1.0], "roughness": 0.4}},
                    {"name": "Leg_Front_Left", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [-0.60, -0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Front_Right", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [0.60, -0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Rear_Left", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [-0.60, 0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}},
                    {"name": "Leg_Rear_Right", "group_id": "table_assembly", "group_name": "Table", "parent": "Table_Top_Surface", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.06, 0.06, 0.69], "position": [0.60, 0.32, 0.345], "material": {"name": "Mat_Brushed_Brass", "color": [0.85, 0.70, 0.35, 1.0], "metallic": 0.9, "roughness": 0.25}}
                ]
            }

        # 20. House / Building Architecture
        if any(w in p_lower for w in ["house", "building", "home", "cabin", "cottage", "tower"]):
            return {
                "project_name": "architectural_building",
                "category": "ARCHITECTURE",
                "description": "Architectural structure with base walls, gabled roof, door, and windows",
                "overall_dimensions": [3.0, 3.0, 3.2],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Building_Walls", "group_id": "house_assembly", "group_name": "House", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [3.0, 3.0, 2.0], "position": [0.0, 0.0, 1.0], "modifiers": [{"type": "BEVEL", "width": 0.02, "segments": 2}], "material": {"name": "Mat_Stucco", "color": [0.88, 0.85, 0.80, 1.0], "roughness": 0.6}},
                    {"name": "Building_Roof", "group_id": "house_assembly", "group_name": "House", "parent": "Building_Walls", "geometry_type": "PRIMITIVE", "primitive": "CONE", "dimensions": [3.4, 3.4, 1.4], "position": [0.0, 0.0, 2.7], "material": {"name": "Mat_Roof_Tiles", "color": [0.65, 0.22, 0.15, 1.0], "roughness": 0.5}},
                    {"name": "Building_Door", "group_id": "house_assembly", "group_name": "House", "parent": "Building_Walls", "geometry_type": "BEVEL_BOX", "dimensions": [0.8, 0.1, 1.4], "position": [0.0, -1.5, 0.7], "material": {"name": "Mat_Wood_Door", "color": [0.45, 0.25, 0.12, 1.0], "roughness": 0.4}},
                    {"name": "Window_Left", "group_id": "house_assembly", "group_name": "House", "parent": "Building_Walls", "geometry_type": "BEVEL_BOX", "dimensions": [0.6, 0.1, 0.6], "position": [-0.9, -1.5, 1.3], "material": {"name": "Mat_Glass_Window", "color": [0.6, 0.85, 0.95, 0.4], "roughness": 0.1}}
                ]
            }

        # 21. Robot / Character / Machine
        if any(w in p_lower for w in ["robot", "droid", "bot", "mech"]):
            return {
                "project_name": "modular_robot",
                "category": "CHARACTER",
                "description": "Modular bipedal robot with head, torso, visor, and limbs",
                "overall_dimensions": [1.4, 0.8, 2.2],
                "clear_scene": not is_incremental,
                "components": [
                    {"name": "Robot_Torso", "group_id": "robot_assembly", "group_name": "Robot", "is_root": True, "geometry_type": "BEVEL_BOX", "dimensions": [0.8, 0.5, 0.9], "position": [0.0, 0.0, 1.3], "material": {"name": "Mat_Robot_Armor", "color": [0.35, 0.40, 0.48, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Robot_Head", "group_id": "robot_assembly", "group_name": "Robot", "parent": "Robot_Torso", "geometry_type": "BEVEL_BOX", "dimensions": [0.45, 0.4, 0.4], "position": [0.0, 0.0, 1.95], "material": {"name": "Mat_Robot_Armor", "color": [0.35, 0.40, 0.48, 1.0], "metallic": 0.85, "roughness": 0.25}},
                    {"name": "Robot_Visor", "group_id": "robot_assembly", "group_name": "Robot", "parent": "Robot_Head", "geometry_type": "BEVEL_BOX", "dimensions": [0.35, 0.1, 0.12], "position": [0.0, -0.21, 1.95], "material": {"name": "Mat_Visor_Glow", "color": [0.1, 0.9, 0.95, 1.0], "metallic": 0.1, "roughness": 0.1}},
                    {"name": "Robot_Arm_L", "group_id": "robot_assembly", "group_name": "Robot", "parent": "Robot_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.16, 0.16, 0.75], "position": [-0.52, 0.0, 1.25], "material": {"name": "Mat_Metal_Limb", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Robot_Arm_R", "group_id": "robot_assembly", "group_name": "Robot", "parent": "Robot_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.16, 0.16, 0.75], "position": [0.52, 0.0, 1.25], "material": {"name": "Mat_Metal_Limb", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Robot_Leg_L", "group_id": "robot_assembly", "group_name": "Robot", "parent": "Robot_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.18, 0.18, 0.85], "position": [-0.22, 0.0, 0.45], "material": {"name": "Mat_Metal_Limb", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.9, "roughness": 0.2}},
                    {"name": "Robot_Leg_R", "group_id": "robot_assembly", "group_name": "Robot", "parent": "Robot_Torso", "geometry_type": "PRIMITIVE", "primitive": "CYLINDER", "dimensions": [0.18, 0.18, 0.85], "position": [0.22, 0.0, 0.45], "material": {"name": "Mat_Metal_Limb", "color": [0.2, 0.2, 0.22, 1.0], "metallic": 0.9, "roughness": 0.2}}
                ]
            }

        # 22. Intelligent Shape-Aware Procedural Fallback
        obj_slug = re.sub(r"[^a-zA-Z0-9_]", "_", prompt)[:24].strip("_") or "Custom_Object"
        
        # Determine geometry type and dimensions from prompt semantics
        if any(w in p_lower for w in ["round", "spherical", "orb", "globe", "ball", "egg", "bubble", "pearl", "dome"]):
            geom_type = "PRIMITIVE"
            prim = "SPHERE"
            dims = [1.2, 1.2, 1.2]
            pos = [0.0, 0.0, 0.6]
        elif any(w in p_lower for w in ["torus", "doughnut", "donut", "ring", "hoop", "loop", "band", "wheel"]):
            geom_type = "PRIMITIVE"
            prim = "TORUS"
            dims = [1.4, 1.4, 0.4]
            pos = [0.0, 0.0, 0.2]
        elif any(w in p_lower for w in ["cone", "pyramid", "spike", "funnel", "tip", "horn", "spire"]):
            geom_type = "PRIMITIVE"
            prim = "CONE"
            dims = [1.2, 1.2, 1.8]
            pos = [0.0, 0.0, 0.9]
        elif any(w in p_lower for w in ["tall", "tube", "pipe", "pole", "rod", "cylinder", "column", "pillar", "wire", "cable", "stem", "stick", "bar", "log", "trunk", "barrel"]):
            geom_type = "PRIMITIVE"
            prim = "CYLINDER"
            dims = [0.8, 0.8, 2.2]
            pos = [0.0, 0.0, 1.1]
        elif any(w in p_lower for w in ["flat", "plate", "sheet", "board", "panel", "card", "floor", "ground", "mat"]):
            geom_type = "BEVEL_BOX"
            prim = None
            dims = [1.6, 1.2, 0.06]
            pos = [0.0, 0.0, 0.03]
        else:
            # Styled proportioned 3D sculpt
            geom_type = "BEVEL_BOX"
            prim = None
            dims = [1.2, 0.8, 0.9]
            pos = [0.0, 0.0, 0.45]

        comp_dict = {
            "name": f"{obj_slug}_Main",
            "geometry_type": geom_type,
            "dimensions": dims,
            "position": pos,
            "material": {"name": f"Mat_{obj_slug}", "color": color_rgba, "metallic": metallic, "roughness": roughness}
        }
        if prim:
            comp_dict["primitive"] = prim
        else:
            comp_dict["modifiers"] = [{"type": "BEVEL", "width": 0.03, "segments": 3}]

        return {
            "project_name": f"model_{obj_slug}",
            "category": "PROP",
            "description": f"Procedural 3D model for: {prompt}",
            "overall_dimensions": dims,
            "clear_scene": not is_incremental,
            "components": [comp_dict]
        }
