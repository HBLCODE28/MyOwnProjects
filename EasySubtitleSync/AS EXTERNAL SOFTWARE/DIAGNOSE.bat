@echo off
setlocal
set "BASE=%LOCALAPPDATA%\EasySubtitleSync"
echo Easy Subtitle Sync v1.0 diagnostics
echo ====================================
echo.
if exist "%BASE%\app\EasySubtitleSync.ps1" (
  echo [OK] Desktop app script exists
) else (
  echo [MISSING] Desktop app script
)
echo.
if exist "%BASE%\app\easy_sub_sync_lite.exe" (
  echo [OK] Helper exists
  "%BASE%\app\easy_sub_sync_lite.exe" --self-test
) else (
  echo [MISSING] Helper
)
echo.
if exist "%BASE%\runtime\ffmpeg\ffmpeg.exe" (
  echo [OK] FFmpeg exists
  "%BASE%\runtime\ffmpeg\ffmpeg.exe" -version 2^>nul | findstr /B /C:"ffmpeg version"
) else (
  echo [MISSING] FFmpeg
)
echo.
if exist "%BASE%\State\last_result.txt" (
  echo Last synchronization result:
  echo ------------------------------------
  type "%BASE%\State\last_result.txt"
  echo ------------------------------------
) else (
  echo No synchronization result exists yet.
)
echo.
if exist "%BASE%\State\last_result.txt.json" (
  echo Diagnostic JSON exists at:
  echo "%BASE%\State\last_result.txt.json"
)
echo.
echo Desktop shortcut:
if exist "%USERPROFILE%\Desktop\Easy Subtitle Sync for VLC.lnk" (
  echo [OK] Desktop shortcut exists
) else (
  echo [INFO] Desktop shortcut not found at the default Desktop path.
)
echo.
pause
