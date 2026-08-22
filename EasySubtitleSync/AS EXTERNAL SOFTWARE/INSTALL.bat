@echo off
setlocal
cd /d "%~dp0"
title Easy Subtitle Sync v1.0 Installer
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo Installation failed with code %RC%.
pause
exit /b %RC%
