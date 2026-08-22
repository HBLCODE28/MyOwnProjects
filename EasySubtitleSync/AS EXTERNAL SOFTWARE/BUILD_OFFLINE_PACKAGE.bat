@echo off
setlocal
cd /d "%~dp0"
title Easy Subtitle Sync v1.0 - Build Offline Transfer Package
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_offline.ps1"
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
