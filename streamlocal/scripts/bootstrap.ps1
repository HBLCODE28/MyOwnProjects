$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $ProjectRoot "frontend"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 20 or newer."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found."
}

$nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 20) {
    throw "Node.js 20+ is required."
}

Write-Host "Installing StreamLocal browser-only dependencies..." -ForegroundColor Cyan
Push-Location $Frontend
try {
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
}
finally {
    Pop-Location
}

Write-Host "Browser-only bootstrap complete." -ForegroundColor Green
