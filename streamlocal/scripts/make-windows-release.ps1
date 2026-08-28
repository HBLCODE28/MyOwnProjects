param(
    [switch]$ForceBuild,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$FrontendDir = Join-Path $ProjectRoot 'frontend'
$DistDir = Join-Path $FrontendDir 'dist'
$DistIndex = Join-Path $DistDir 'index.html'
$PackagerDir = Join-Path $ProjectRoot 'tools\windows-packager'
$LauncherExe = Join-Path $PackagerDir 'StreamLocal.exe'
$SetupStub = Join-Path $PackagerDir 'StreamLocal-SetupStub.exe'
$IconFile = Join-Path $PackagerDir 'StreamLocal.ico'
$ReleaseDir = Join-Path $ProjectRoot 'release'
$PortableContainer = Join-Path $ReleaseDir 'StreamLocal-Portable'
$PortableRoot = Join-Path $PortableContainer 'StreamLocal'
$PayloadZip = Join-Path $ReleaseDir '.StreamLocal-Payload.zip'
$PortableZip = Join-Path $ReleaseDir 'StreamLocal-Portable.zip'
$SetupExe = Join-Path $ReleaseDir 'StreamLocal-Setup.exe'

function Write-Step([string]$Text) {
    Write-Host "[StreamLocal] $Text" -ForegroundColor Cyan
}

function Test-NpmAvailable {
    return [bool](Get-Command npm -ErrorAction SilentlyContinue)
}

function Test-BuildIsStale {
    if (-not (Test-Path $DistIndex)) { return $true }
    $distTime = (Get-Item $DistIndex).LastWriteTimeUtc
    $newer = Get-ChildItem (Join-Path $FrontendDir 'src') -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -gt $distTime } |
        Select-Object -First 1
    if ($newer) { return $true }
    $publicDir = Join-Path $FrontendDir 'public'
    if (Test-Path $publicDir) {
        $newerPublic = Get-ChildItem $publicDir -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTimeUtc -gt $distTime } |
            Select-Object -First 1
        if ($newerPublic) { return $true }
    }
    return $false
}

if (-not (Test-Path $LauncherExe)) { throw "Missing packager file: $LauncherExe" }
if (-not (Test-Path $SetupStub)) { throw "Missing packager file: $SetupStub" }
if (-not (Test-Path $IconFile)) { throw "Missing packager file: $IconFile" }

$needsBuild = Test-BuildIsStale
if ($ForceBuild) { $needsBuild = $true }

if (-not $SkipBuild -and $needsBuild) {
    if (-not (Test-NpmAvailable)) {
        if (-not (Test-Path $DistIndex)) {
            throw "frontend\dist is missing and npm is not available. Run npm run build on the development PC first."
        }
        Write-Warning "Source files are newer than frontend\dist, but npm is unavailable. Packaging the existing dist."
    } else {
        Write-Step 'Building the latest frontend...'
        Push-Location $FrontendDir
        try {
            & npm run build
            if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
        } finally {
            Pop-Location
        }
    }
} elseif ($SkipBuild) {
    Write-Step 'Using the existing frontend\dist because -SkipBuild was requested.'
} else {
    Write-Step 'frontend\dist is already current. No rebuild needed.'
}

if (-not (Test-Path $DistIndex)) {
    throw "Build output was not found: $DistIndex"
}

Write-Step 'Preparing release files...'
if (Test-Path $ReleaseDir) {
    Get-ChildItem $ReleaseDir -Force | Remove-Item -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $ReleaseDir | Out-Null
}
New-Item -ItemType Directory -Path $PortableContainer | Out-Null
New-Item -ItemType Directory -Path $PortableRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PortableRoot 'app') | Out-Null

Copy-Item $LauncherExe (Join-Path $PortableRoot 'StreamLocal.exe') -Force
Copy-Item $IconFile (Join-Path $PortableRoot 'StreamLocal.ico') -Force
Copy-Item (Join-Path $DistDir '*') (Join-Path $PortableRoot 'app') -Recurse -Force

$ScriptsOut = Join-Path $PortableRoot 'scripts'
$BridgePs1 = Join-Path $ProjectRoot 'scripts\player-history-bridge.ps1'
$BridgeCmd = Join-Path $ProjectRoot 'scripts\start-player-history-bridge.cmd'
if ((Test-Path $BridgePs1) -or (Test-Path $BridgeCmd)) {
    New-Item -ItemType Directory -Path $ScriptsOut | Out-Null
    if (Test-Path $BridgePs1) { Copy-Item $BridgePs1 $ScriptsOut -Force }
    if (Test-Path $BridgeCmd) { Copy-Item $BridgeCmd $ScriptsOut -Force }
}

$Readme = @'
StreamLocal for Windows
=======================

PORTABLE
--------
Double-click StreamLocal.exe.
StreamLocal opens as a dedicated Windows app-style window at the fixed local origin http://127.0.0.1:17836/.
Keep the entire StreamLocal folder together. Do not move only StreamLocal.exe.

The target PC does NOT need Node.js, npm, Vite, Python, Go, or .NET installed by StreamLocal.
The launcher uses Microsoft Edge app mode, which is normally already present on current Windows 10/11 systems.

SETUP
-----
The installer installs StreamLocal for the current Windows user under:
%LOCALAPPDATA%\StreamLocal

It creates Desktop and Start menu shortcuts. Administrator permission is not required.

LOCAL AND NETWORK MEDIA
-----------------------
When launched through StreamLocal.exe, Library folder selection is handled by the Windows bridge.
Mapped drives and network shares are supported, for example:
  Z:\Movies
  \\NAS\Series
  \\SERVER\Media\Movies

You can also use Library -> Add network path and paste a UNC path directly.
Original media is read-only and is never uploaded, renamed, modified, or deleted.

MOVING YOUR LIBRARY TO ANOTHER PC
---------------------------------
On the old PC, use Settings -> Export Library.
On the new PC, use Settings -> Import Library, then reconnect folders if the drive/share path is different.
Video files are not included in StreamLocal backups.
Encrypted API keys should be configured again on the new PC.

LOCAL PLAYER HISTORY
--------------------
If the packaged scripts are present, StreamLocal.exe starts the external-player history bridge in the background.
The bridge only reads supported VLC / Windows Media Player history. It does not modify video files.

TV / DISPLAY SCALING
--------------------
The interface adapts to the actual app-window size and Windows display scaling.
Always launch StreamLocal.exe or the installed shortcut instead of opening app\index.html directly.
'@
Set-Content -Path (Join-Path $PortableRoot 'README.txt') -Value $Readme -Encoding UTF8

$Uninstall = @'
@echo off
setlocal
set "INSTALL=%LOCALAPPDATA%\StreamLocal"
set "DESKTOP=%USERPROFILE%\Desktop\StreamLocal.lnk"
set "START=%APPDATA%\Microsoft\Windows\Start Menu\Programs\StreamLocal.lnk"
echo This removes the installed StreamLocal application files and shortcuts.
echo Browser data such as IndexedDB is not deleted by this script.
choice /M "Uninstall StreamLocal"
if errorlevel 2 exit /b 0
del /q "%DESKTOP%" 2>nul
del /q "%START%" 2>nul
start "" /min cmd /c "timeout /t 2 /nobreak >nul & rmdir /s /q \"%INSTALL%\""
exit /b 0
'@
Set-Content -Path (Join-Path $PortableRoot 'Uninstall StreamLocal.cmd') -Value $Uninstall -Encoding ASCII

Write-Step 'Creating StreamLocal-Portable.zip...'
Compress-Archive -Path $PortableRoot -DestinationPath $PortableZip -CompressionLevel Optimal -Force

Write-Step 'Creating installer payload...'
Compress-Archive -Path (Join-Path $PortableRoot '*') -DestinationPath $PayloadZip -CompressionLevel Optimal -Force

Write-Step 'Creating single-file StreamLocal-Setup.exe...'
Copy-Item $SetupStub $SetupExe -Force
$setupStream = [System.IO.File]::Open($SetupExe, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
try {
    $payloadStream = [System.IO.File]::OpenRead($PayloadZip)
    try {
        $payloadStream.CopyTo($setupStream)
    } finally {
        $payloadStream.Dispose()
    }
} finally {
    $setupStream.Dispose()
}
Remove-Item $PayloadZip -Force

Write-Step 'Verifying release outputs...'
if (-not (Test-Path $PortableZip)) { throw 'Portable ZIP was not created.' }
if (-not (Test-Path $SetupExe)) { throw 'Setup EXE was not created.' }
if ((Get-Item $SetupExe).Length -le (Get-Item $SetupStub).Length) { throw 'Setup payload was not appended correctly.' }

Write-Host ''
Write-Host 'Release complete:' -ForegroundColor Green
Write-Host "  $PortableZip"
Write-Host "  $SetupExe"
Write-Host ''
Write-Host 'Copy either file to another Windows PC. Setup.exe is the easiest option.' -ForegroundColor Green
