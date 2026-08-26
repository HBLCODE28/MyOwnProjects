@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0player-history-bridge.ps1"
if errorlevel 1 pause
endlocal
