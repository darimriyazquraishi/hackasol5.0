@echo off
title Stop LUMI Server
echo Stopping LUMI application server and background processes...

:: Terminate process holding port 3000 (Vite)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: Terminate any lingering background cmd or npm supervisor processes started by run.bat
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq '' } | Stop-Process -Force -ErrorAction SilentlyContinue"

echo [OK] LUMI server has been stopped.
timeout /t 2 /nobreak >nul
