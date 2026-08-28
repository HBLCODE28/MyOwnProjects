@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\make-website-portable.ps1"
if errorlevel 1 (
  echo.
  echo Failed to create StreamLocal Website Portable.
  pause
)
endlocal
