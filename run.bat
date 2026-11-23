@echo off
setlocal enabledelayedexpansion
title LUMI - Always-On System Supervisor

echo ===================================================
echo           L.U.M.I. ALWAYS-ON RUNTIME
echo ===================================================
echo.

cd /d "%~dp0"

:: Set zero-timeout environment flags for Ollama and Node
set "OLLAMA_KEEP_ALIVE=-1"
set "OLLAMA_ORIGINS=*"
set "OLLAMA_TIMEOUT_MS=300000"
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

:: 2. Ensure Ollama service is up with permanent memory retention (keep_alive: -1)
echo [*] Checking Ollama service status (port 11434)...
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Ollama is already active with models loaded.
) else (
    if defined OLLAMA_EXE (
        echo [*] Starting local Ollama service with infinite keep-alive...
        start "LUMI - Ollama Daemon" /min "!OLLAMA_EXE!" serve
        timeout /t 3 /nobreak >nul
        echo [OK] Ollama service active.
    ) else (
        echo [!] Warning: ollama.exe not found.
    )
)

echo.
:: 3. Launch browser in background after 3 seconds
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: 4. Auto-restarting Application Supervisor Loop
echo [*] Starting LUMI application server on http://localhost:3000...
echo [*] Auto-recovery enabled: if the server stops, it will immediately restart.
echo.

:server_loop
call npm run dev
echo.
echo [!] Server process ended at %TIME%. Auto-restarting in 2 seconds...
timeout /t 2 /nobreak >nul

:: Re-verify Ollama is still running before restarting Vite
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    if defined OLLAMA_EXE (
        echo [*] Reviving Ollama service...
        start "LUMI - Ollama Daemon" /min "!OLLAMA_EXE!" serve
        timeout /t 2 /nobreak >nul
    )
)

goto server_loop
