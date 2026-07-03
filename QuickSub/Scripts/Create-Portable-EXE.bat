@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-Portable.ps1"
if errorlevel 1 (
  echo.
  echo Publish failed.
  pause
  exit /b 1
)
echo.
echo QuickSub.exe and QuickSub-Portable.zip were created in the Artifacts folder.
pause
