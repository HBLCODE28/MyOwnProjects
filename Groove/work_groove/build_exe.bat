@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist .venv (
    py -3 -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt

set ADD_DATA=
if exist vendor (
    set ADD_DATA=!ADD_DATA! --add-data "vendor;vendor"
)
if exist assets (
    set ADD_DATA=!ADD_DATA! --add-data "assets;assets"
)

set ICON_ARG=
if exist assets\app_icon.ico (
    set ICON_ARG=--icon "assets\app_icon.ico"
)

python -m PyInstaller --noconfirm --clean --onefile --windowed --name Groove %ICON_ARG% %ADD_DATA% main.py

if exist dist\Groove.exe (
    echo.
    echo Built successfully: dist\Groove.exe
) else (
    echo.
    echo Build failed. Check the console output above.
    exit /b 1
)
