@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\make-windows-release.ps1"
if errorlevel 1 (
  echo.
  echo StreamLocal release creation failed.
  pause
  exit /b 1
)
echo.
echo Done. Open the release folder for StreamLocal-Setup.exe and StreamLocal-Portable.zip.
explorer.exe ".\release"
pause
