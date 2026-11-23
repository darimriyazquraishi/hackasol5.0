@echo off
title PRJ Blender AI Skill - Environment Check & Setup
cd /d "%~dp0"

echo ==================================================
echo   PRJ Blender AI Skill - Cross-Device Setup
echo ==================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python 3.9+ not found on PATH. Install Python first.
    pause
    exit /b 1
)

echo [1/2] Checking Blender and environment...
python prj\blender_skill.py status
echo.

set /p INSTALL_WEB="Install optional web-server packages (FastAPI/Uvicorn/psutil)? [y/N]: "
if /i "%INSTALL_WEB%"=="y" (
    echo [2/2] Installing optional requirements...
    python -m pip install -r requirements.txt
) else (
    echo [2/2] Skipped web-server packages. Core blender_skill works with stdlib only!
)

echo.
echo Done! Try running: python example_usage.py
pause
