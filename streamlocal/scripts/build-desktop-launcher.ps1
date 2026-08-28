$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LauncherDir = Join-Path $ProjectRoot 'desktop\launcher'
$OutputDir = Join-Path $ProjectRoot 'tools\windows-packager'
$Output = Join-Path $OutputDir 'StreamLocal.exe'

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Host 'Go is not installed on this development PC.' -ForegroundColor Yellow
    Write-Host 'That is OK for normal packaging: a prebuilt StreamLocal.exe is already included.'
    Write-Host 'Go is only needed if you modify desktop\launcher\main.go and want to rebuild the native launcher.'
    exit 1
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Push-Location $LauncherDir
try {
    $env:GOOS = 'windows'
    $env:GOARCH = 'amd64'
    $env:CGO_ENABLED = '0'
    & go build -trimpath -ldflags '-s -w -H windowsgui' -o $Output .
    if ($LASTEXITCODE -ne 0) { throw "go build failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}
Write-Host "Built: $Output" -ForegroundColor Green
