$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $ProjectRoot "frontend"

Push-Location $Frontend
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed." }
}
finally {
    Pop-Location
}

Write-Host "Static build created in frontend\dist" -ForegroundColor Green
