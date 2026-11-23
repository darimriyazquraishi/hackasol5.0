@echo off
setlocal enabledelayedexpansion

:: If --background or --foreground specified, proceed to execution
if "%~1"=="--background" goto :runtime_payload
if "%~1"=="--foreground" goto :runtime_payload

:: Self-launch completely hidden in the background (zero terminal windows)
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\" --background' -WindowStyle Hidden"
exit /b

:runtime_payload
cd /d "%~dp0"

:: Set zero-timeout environment flags for Ollama and Node
set "OLLAMA_KEEP_ALIVE=-1"
set "OLLAMA_ORIGINS=*"
set "OLLAMA_TIMEOUT_MS=0"
set "OLLAMA_NUM_PARALLEL=4"
set "OLLAMA_MAX_LOADED_MODELS=3"
set "OLLAMA_FLASH_ATTENTION=1"
set "NODE_ENV=development"

:: 1. Locate Ollama executable
set "OLLAMA_EXE="
where ollama >nul 2>&1
if !errorlevel! equ 0 set "OLLAMA_EXE=ollama"

if not defined OLLAMA_EXE (
    set "WINGET_DIR=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ollama.Ollama.Portable_Microsoft.Winget.Source_8wekyb3d8bbwe"
    if exist "!WINGET_DIR!\ollama.exe" (
        set "OLLAMA_EXE=!WINGET_DIR!\ollama.exe"
        set "PATH=!PATH!;!WINGET_DIR!"
    )
)
if not defined OLLAMA_EXE (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
)
if not defined OLLAMA_EXE (
    if exist "%ProgramFiles%\Ollama\ollama.exe" set "OLLAMA_EXE=%ProgramFiles%\Ollama\ollama.exe"
)

:: 2. Ensure Ollama service is up with permanent memory retention (keep_alive: -1) completely hidden
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    if defined OLLAMA_EXE (
        powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process '!OLLAMA_EXE!' -ArgumentList 'serve' -WindowStyle Hidden"
        timeout /t 3 /nobreak >nul
    )
)

:: 3. Launch browser in background after 3 seconds
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: 4. Auto-restarting Application Supervisor Loop (Runs silently in background)
:server_loop
call npm run dev >nul 2>&1
timeout /t 2 /nobreak >nul

:: Re-verify Ollama is still running before restarting Vite
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    if defined OLLAMA_EXE (
        powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process '!OLLAMA_EXE!' -ArgumentList 'serve' -WindowStyle Hidden"
        timeout /t 2 /nobreak >nul
    )
)

goto server_loop
