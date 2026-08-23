$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $ProjectRoot "backend"
$Frontend = Join-Path $ProjectRoot "frontend"
$Venv = Join-Path $Backend ".venv"

Write-Host "StreamLocal bootstrap" -ForegroundColor Cyan

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python was not found in PATH. Install Python 3.11 or newer."
}

$pyVersion = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
$pyParts = $pyVersion.Split(".")
if ([int]$pyParts[0] -lt 3 -or ([int]$pyParts[0] -eq 3 -and [int]$pyParts[1] -lt 11)) {
    throw "Python 3.11+ is required. Found $pyVersion."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found in PATH. Install Node.js 20 or newer."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found in PATH."
}

if (-not (Test-Path $Venv)) {
    Write-Host "Creating Python virtual environment..."
    & python -m venv $Venv
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"

Write-Host "Installing backend dependencies..."
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -e "$Backend[dev]"

Write-Host "Running database migrations..."
Push-Location $Backend
try {
    & $VenvPython -m alembic upgrade head
}
finally {
    Pop-Location
}

Write-Host "Installing frontend dependencies..."
Push-Location $Frontend
try {
    & npm install
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Bootstrap complete." -ForegroundColor Green
