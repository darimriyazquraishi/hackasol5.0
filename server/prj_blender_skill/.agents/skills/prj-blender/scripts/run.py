#!/usr/bin/env python3
"""
Portable CLI wrapper for the `prj-blender` Agent Skill.
Locates `prj/blender_skill.py` from any working directory and delegates execution.
"""
import os
import sys
from pathlib import Path


def _locate_prj_dir() -> Path:
    script_path = Path(__file__).resolve()
    # Walk up from .agents/skills/prj-blender/scripts/run.py to find <root>/prj/blender_skill.py
    for parent in [script_path.parent, *script_path.parents]:
        candidate = parent / "prj" / "blender_skill.py"
        if candidate.is_file():
            return candidate.parent
        candidate_here = parent / "blender_skill.py"
        if candidate_here.is_file() and (parent / "blender_engine" / "runner.py").is_file():
            return parent
    env_prj = os.environ.get("PRJ_BLENDER_DIR")
    if env_prj and (Path(env_prj) / "blender_skill.py").is_file():
        return Path(env_prj)
    raise FileNotFoundError(
        "Could not locate `prj/blender_skill.py`. Set PRJ_BLENDER_DIR or run from the workspace."
    )


def main() -> int:
    prj_dir = _locate_prj_dir()
    if str(prj_dir) not in sys.path:
        sys.path.insert(0, str(prj_dir))
    from blender_skill import main as skill_main
    return skill_main()


if __name__ == "__main__":
    sys.exit(main())
