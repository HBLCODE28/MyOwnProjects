$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    py -3 -m venv .venv
}
& .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

$addData = @()
if (Test-Path "vendor") {
    $addData += @("--add-data", "vendor;vendor")
}
if (Test-Path "assets") {
    $addData += @("--add-data", "assets;assets")
}

$iconArg = @()
if (Test-Path "assets\app_icon.ico") {
    $iconArg = @("--icon", "assets\app_icon.ico")
}

python -m PyInstaller --noconfirm --clean --onefile --windowed --name Groove @iconArg @addData main.py

if (Test-Path "dist\Groove.exe") {
    Write-Host "Built successfully: dist\Groove.exe"
} else {
    throw "Build failed. Check the console output above."
}
