@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Taer Oti - Local Test Players

echo.
echo ==============================================
echo   Taer Oti - local test players
echo ==============================================
echo.
echo Start START_TAER_OTI.bat first and create a room.
echo This tool does not add any QA button to the website.
echo.

if not exist "node_modules\" (
  echo [ERROR] Dependencies are not installed yet.
  echo Run START_TAER_OTI.bat once before using this tool.
  pause
  exit /b 1
)

set "ROOM_CODE="
set /p "ROOM_CODE=Room code (8 characters): "
if not defined ROOM_CODE (
  echo [ERROR] Room code is required.
  pause
  exit /b 1
)

set "BOT_COUNT=3"
set /p "BOT_INPUT=Number of test players [3]: "
if defined BOT_INPUT set "BOT_COUNT=%BOT_INPUT%"

echo.
echo Connecting test players...
echo.
call npm run test:players -- "%ROOM_CODE%" "%BOT_COUNT%" "http://localhost:3000"

if errorlevel 1 (
  echo.
  echo [ERROR] Could not create the test players.
  echo Make sure the server is running and the room code is correct.
  pause
)
