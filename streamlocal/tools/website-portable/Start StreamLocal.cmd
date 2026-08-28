@echo off
setlocal
cd /d "%~dp0"
if not exist "app\index.html" (
  echo StreamLocal website files are missing.
  echo Expected: %CD%\app\index.html
  echo.
  pause
  exit /b 1
)
start "" "%CD%\StreamLocal-Website-Server.exe"
endlocal
