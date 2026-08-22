param(
    [string]$UbuntuDistro = 'Ubuntu',
    [string]$LinuxUser = 'cyber_user'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$x86Dest = Join-Path $root 'payload\x86\libautobrightness_plugin.dll'
$x64Dest = Join-Path $root 'payload\x64\libautobrightness_plugin.dll'

$x86Source = "\\wsl.localhost\$UbuntuDistro\home\$LinuxUser\vlc-build32\win32\modules\.libs\libautobrightness_plugin.dll"
$x64Source = "\\wsl.localhost\$UbuntuDistro\home\$LinuxUser\vlc-build\win64\modules\.libs\libautobrightness_plugin.dll"

function Get-PeMachine([string]$Path) {
    $fs = [System.IO.File]::OpenRead($Path)
    try {
        $br = New-Object System.IO.BinaryReader($fs)
        $fs.Position = 0x3c
        $peOffset = $br.ReadInt32()
        $fs.Position = $peOffset
        $sig = $br.ReadUInt32()
        if ($sig -ne 0x00004550) { throw "Not a PE file: $Path" }
        return $br.ReadUInt16()
    } finally {
        $fs.Dispose()
    }
}

Write-Host 'Copying built VLC plugins from WSL...'
if (-not (Test-Path -LiteralPath $x86Source)) { throw "32-bit DLL not found: $x86Source" }
if (-not (Test-Path -LiteralPath $x64Source)) { throw "64-bit DLL not found: $x64Source" }

New-Item -ItemType Directory -Force -Path (Split-Path $x86Dest), (Split-Path $x64Dest), (Join-Path $root 'dist') | Out-Null
Copy-Item -LiteralPath $x86Source -Destination $x86Dest -Force
Copy-Item -LiteralPath $x64Source -Destination $x64Dest -Force

$x86Machine = Get-PeMachine $x86Dest
$x64Machine = Get-PeMachine $x64Dest
if ($x86Machine -ne 0x014c) { throw ('Expected x86 DLL (0x014c), got 0x{0:X4}' -f $x86Machine) }
if ($x64Machine -ne 0x8664) { throw ('Expected x64 DLL (0x8664), got 0x{0:X4}' -f $x64Machine) }

$makensisCandidates = @(
    "$env:ProgramFiles\NSIS\makensis.exe",
    "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if ($makensisCandidates.Count -eq 0) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw 'NSIS is not installed and winget was not found. Install NSIS, then run this script again.'
    }

    Write-Host 'NSIS is not installed. Installing it with winget...'
    & winget.exe install -e --id NSIS.NSIS --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "winget failed with exit code $LASTEXITCODE" }

    $makensisCandidates = @(
        "$env:ProgramFiles\NSIS\makensis.exe",
        "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
}

if ($makensisCandidates.Count -eq 0) { throw 'makensis.exe was not found after installing NSIS.' }
$makensis = $makensisCandidates[0]

Push-Location $root
try {
    Write-Host 'Building AutoBrightnessSetup.exe...'
    & $makensis '/V3' 'AutoBrightnessSetup.nsi'
    if ($LASTEXITCODE -ne 0) { throw "makensis failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

$out = Join-Path $root 'dist\AutoBrightnessSetup.exe'
if (-not (Test-Path -LiteralPath $out)) { throw 'Build completed but AutoBrightnessSetup.exe was not created.' }
Write-Host "Done: $out"
