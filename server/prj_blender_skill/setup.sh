#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=================================================="
echo "  PRJ Blender AI Skill - Cross-Device Setup"
echo "=================================================="
echo

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    PYTHON_BIN="python"
fi

echo "[1/2] Checking Blender and environment..."
"$PYTHON_BIN" prj/blender_skill.py status
echo

read -r -p "Install optional web-server packages (FastAPI/Uvicorn/psutil)? [y/N]: " INSTALL_WEB || true
if [[ "${INSTALL_WEB:-}" =~ ^[Yy]$ ]]; then
    echo "[2/2] Installing optional requirements..."
    "$PYTHON_BIN" -m pip install -r requirements.txt
else
    echo "[2/2] Skipped web-server packages. Core blender_skill works with stdlib only!"
fi

echo
echo "Done! Try running: $PYTHON_BIN example_usage.py"
