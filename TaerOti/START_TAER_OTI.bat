@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Taer Oti - Dev Server

 echo.
 echo ==============================================
 echo   Taer Oti - starting server
 echo ==============================================
 echo.

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Run this BAT from the extracted project folder.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or is not in PATH.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not available in PATH.
  pause
  exit /b 1
)

rem Detect the local network IP so the phone URL and Next.js dev origin work automatically.
set "LAN_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$c=Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address -ne $null } ^| Select-Object -First 1; if($c){$c.IPv4Address.IPAddress}"`) do set "LAN_IP=%%I"

if defined LAN_IP (
  set "TAER_OTI_DEV_ORIGINS=!LAN_IP!"
  set "TAER_OTI_PUBLIC_ORIGIN=http://!LAN_IP!:3000"
)

rem Install dependencies only on the first run or when a required package is missing.
set "NEED_INSTALL="
if not exist "node_modules\" set "NEED_INSTALL=1"
if not exist "node_modules\qrcode\" set "NEED_INSTALL=1"
if defined NEED_INSTALL (
  echo Installing required dependencies...
  call npm install --audit=false
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 2
  )
)

 echo.
 echo Starting server...
 echo PC: http://localhost:3000
if defined LAN_IP echo Phone: http://!LAN_IP!:3000
 echo.
 echo Keep this window open while playing.
 echo Stop the server with Ctrl+C.
 echo ==============================================
 echo.

call npm run dev

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] The server stopped with exit code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
