@echo off
cd /d "%~dp0"
echo ========================================================
echo     Building LUMI Portable One-Folder Executable
echo ========================================================
echo.

node scripts\buildPackage.cjs
if %errorlevel% neq 0 (
    echo.
    echo Build failed with error code %errorlevel%.
    pause
    exit /b %errorlevel%
)

echo.
echo Package built successfully in release\LUMI\
echo.
pause
