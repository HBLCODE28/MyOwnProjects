param(
    [switch]$ForceBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$dist = Join-Path $frontend 'dist'
$serverTemplate = Join-Path $root 'tools\website-portable\StreamLocal-Website-Server.exe'
$startTemplate = Join-Path $root 'tools\website-portable\Start StreamLocal.cmd'
$readmeTemplate = Join-Path $root 'tools\website-portable\README_HE.txt'
$release = Join-Path $root 'release'
$outDir = Join-Path $release 'StreamLocal-Website-Portable'
$outZip = Join-Path $release 'StreamLocal-Website-Portable.zip'

if (-not (Test-Path $serverTemplate)) { throw "Missing website server: $serverTemplate" }
if (-not (Test-Path $startTemplate)) { throw "Missing start script: $startTemplate" }

$needBuild = $ForceBuild -or -not (Test-Path (Join-Path $dist 'index.html'))
if (-not $needBuild) {
    $distTime = (Get-Item (Join-Path $dist 'index.html')).LastWriteTimeUtc
    $newerSource = Get-ChildItem (Join-Path $frontend 'src') -Recurse -File | Where-Object { $_.LastWriteTimeUtc -gt $distTime } | Select-Object -First 1
    if ($newerSource) { $needBuild = $true }
}

if ($needBuild) {
    Write-Host 'Building current StreamLocal frontend...'
    Push-Location $frontend
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'npm run build failed.' }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw 'frontend\dist\index.html was not found.'
}

New-Item -ItemType Directory -Force -Path $release | Out-Null
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
if (Test-Path $outZip) { Remove-Item $outZip -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $outDir 'app') | Out-Null

Copy-Item (Join-Path $dist '*') (Join-Path $outDir 'app') -Recurse -Force
Copy-Item $serverTemplate (Join-Path $outDir 'StreamLocal-Website-Server.exe') -Force
Copy-Item $startTemplate (Join-Path $outDir 'Start StreamLocal.cmd') -Force
if (Test-Path $readmeTemplate) { Copy-Item $readmeTemplate (Join-Path $outDir 'README_HE.txt') -Force }

$historyScript = Join-Path $root 'scripts\player-history-bridge.ps1'
$historyStart = Join-Path $root 'scripts\start-player-history-bridge.cmd'
if ((Test-Path $historyScript) -or (Test-Path $historyStart)) {
    $scriptOut = Join-Path $outDir 'scripts'
    New-Item -ItemType Directory -Force -Path $scriptOut | Out-Null
    if (Test-Path $historyScript) { Copy-Item $historyScript $scriptOut -Force }
    if (Test-Path $historyStart) { Copy-Item $historyStart $scriptOut -Force }
}

Compress-Archive -Path $outDir -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ''
Write-Host 'Created:'
Write-Host "  $outZip"
Write-Host ''
Write-Host 'Copy this ZIP to the other computer, extract it, and run Start StreamLocal.cmd.'
Start-Process explorer.exe $release
