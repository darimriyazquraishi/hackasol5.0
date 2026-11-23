@echo off
setlocal enabledelayedexpansion
title LUMI - Agentic System

echo ===================================================
echo               STARTING L.U.M.I.
echo ===================================================
echo.

cd /d "%~dp0"

:: 1. Check if Ollama is already running on port 11434
echo [*] Checking Ollama service status...
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Ollama service is already running on port 11434.
) else (
    echo [*] Starting local Ollama service...
    set "OLLAMA_EXE="

    :: Check PATH
    where ollama >nul 2>&1
    if !errorlevel! equ 0 set "OLLAMA_EXE=ollama"

    :: Check WinGet Portable directory
    if not defined OLLAMA_EXE (
        set "WINGET_DIR=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ollama.Ollama.Portable_Microsoft.Winget.Source_8wekyb3d8bbwe"
        if exist "!WINGET_DIR!\ollama.exe" (
            set "OLLAMA_EXE=!WINGET_DIR!\ollama.exe"
            set "PATH=!PATH!;!WINGET_DIR!"
        )
    )

    :: Check standard installation directories
    if not defined OLLAMA_EXE (
        if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    )
    if not defined OLLAMA_EXE (
        if exist "%ProgramFiles%\Ollama\ollama.exe" set "OLLAMA_EXE=%ProgramFiles%\Ollama\ollama.exe"
    )

    if defined OLLAMA_EXE (
        start "LUMI - Ollama Daemon" /min "!OLLAMA_EXE!" serve
        echo [*] Waiting for Ollama daemon to initialize...
        timeout /t 3 /nobreak >nul
        echo [OK] Ollama service launched.
    ) else (
        echo [!] Warning: ollama.exe not found in standard paths. If models are needed, ensure Ollama is installed and running.
    )
)

echo.
:: 2. Launch browser in 3 seconds in background
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: 3. Start Vite dev server
echo [*] Starting LUMI application server on http://localhost:3000...
echo.
call npm run dev

pause
