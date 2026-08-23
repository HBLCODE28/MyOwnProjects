$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $ProjectRoot "frontend"

Push-Location $Frontend
try {
    Write-Host "Running browser-only unit tests..." -ForegroundColor Cyan
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed." }

    Write-Host "Running TypeScript typecheck..." -ForegroundColor Cyan
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "TypeScript typecheck failed." }

    Write-Host "Building static StreamLocal PWA..." -ForegroundColor Cyan
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
}
finally {
    Pop-Location
}

Write-Host "Stage 3 browser-only verification passed." -ForegroundColor Green
