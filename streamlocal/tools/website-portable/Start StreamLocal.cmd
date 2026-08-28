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

rem Port 17836 is fixed. Stop a stale Portable server first so this folder is
rem always the version that serves the site.
taskkill /F /IM "StreamLocal-Website-Server.exe" >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%CD%\StreamLocal-Website-Server.exe"
endlocal
