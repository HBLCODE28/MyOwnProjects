$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $ProjectRoot "backend"
$Frontend = Join-Path $ProjectRoot "frontend"
$VenvPython = Join-Path $Backend ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    throw "Dependencies are not installed. Run scripts\bootstrap.ps1 first."
}

$backendCommand = "Set-Location '$Backend'; & '$VenvPython' -m uvicorn app.main:app --host 127.0.0.1 --port 4310 --reload"
$frontendCommand = "Set-Location '$Frontend'; npm run dev"

Write-Host "Starting StreamLocal backend on http://127.0.0.1:4310" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand

Write-Host "Starting StreamLocal frontend on http://127.0.0.1:5173" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5173"
