@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo === Building Groove EXE ===
call build_exe.bat
if errorlevel 1 exit /b 1

if not exist "dist\Groove.exe" (
    echo dist\Groove.exe was not created.
    exit /b 1
)

if not exist "vendor\ffmpeg\bin\ffmpeg.exe" (
    echo.
    echo WARNING: vendor\ffmpeg\bin\ffmpeg.exe was not found.
    echo The installer will still be created, but MP3/MP4 downloads may fail on computers that do not already have FFmpeg installed.
    echo To make the installer fully self-contained, put ffmpeg.exe in vendor\ffmpeg\bin before building.
    echo.
)

set ISCC_EXE=
where ISCC.exe >nul 2>nul
if not errorlevel 1 set ISCC_EXE=ISCC.exe

if not defined ISCC_EXE if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set ISCC_EXE=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe
if not defined ISCC_EXE if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set ISCC_EXE=%ProgramFiles%\Inno Setup 6\ISCC.exe
if not defined ISCC_EXE if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set ISCC_EXE=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe

if not defined ISCC_EXE (
    echo.
    echo Inno Setup 6 was not found.
    echo Install Inno Setup 6 on this build computer, then run build_installer.bat again.
    echo The end-user computer does NOT need Inno Setup.
    exit /b 1
)

echo.
echo === Building Groove installer ===
"%ISCC_EXE%" "installer\Groove.iss"
if errorlevel 1 exit /b 1

if exist "installer\GrooveSetup.exe" (
    echo.
    echo Built successfully: installer\GrooveSetup.exe
    echo Send this file to another Windows computer and run it there.
) else (
    echo.
    echo Installer build finished, but installer\GrooveSetup.exe was not found.
    exit /b 1
)
