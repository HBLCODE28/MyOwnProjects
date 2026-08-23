$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $ProjectRoot "backend"
$Frontend = Join-Path $ProjectRoot "frontend"
$VenvPython = Join-Path $Backend ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    throw "Backend virtual environment is missing. Run scripts\bootstrap.ps1 first."
}

Write-Host "Running backend tests..." -ForegroundColor Cyan
Push-Location $Backend
try {
    & $VenvPython -m pytest
    if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }
}
finally {
    Pop-Location
}

Write-Host "Running frontend typecheck..." -ForegroundColor Cyan
Push-Location $Frontend
try {
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "Frontend typecheck failed." }
}
finally {
    Pop-Location
}

Write-Host "Running frontend production build..." -ForegroundColor Cyan
Push-Location $Frontend
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
}
finally {
    Pop-Location
}

Write-Host "Stage 1 verification passed." -ForegroundColor Green
