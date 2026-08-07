$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$publishScript = Join-Path $PSScriptRoot "Publish-Portable.ps1"
$installerScript = Join-Path $projectRoot "Installer\QuickSub.iss"

& $publishScript

$possibleCompilers = @(
    "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
)

$iscc = $possibleCompilers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) {
    throw "Inno Setup 6 was not found. Install it and run this script again."
}

Write-Host "Building the QuickSub installer..."
& $iscc $installerScript
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup returned exit code $LASTEXITCODE"
}

Write-Host "Installer created in: $projectRoot\Installer\Output"
