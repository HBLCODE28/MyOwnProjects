$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Target = Join-Path $env:LOCALAPPDATA "EasySubtitleSync"
$TargetApp = Join-Path $Target "app"
$TargetRuntime = Join-Path $Target "runtime\ffmpeg"
$PackageFfmpeg = Join-Path $Root "runtime\ffmpeg\ffmpeg.exe"
$StageFfmpeg = Join-Path $env:TEMP ("EasySubtitleSync_ffmpeg_" + $PID + ".exe")

Write-Host ""
Write-Host "Easy Subtitle Sync v1.0 - minimal local installer" -ForegroundColor Cyan
Write-Host "Visible desktop app. No Whisper. No full-screen window."
Write-Host ""

if (-not [Environment]::Is64BitOperatingSystem) { throw "64-bit Windows is required." }
if (-not (Test-Path (Join-Path $Root "app\easy_sub_sync_lite.exe"))) { throw "Package is incomplete: helper missing." }
if (-not (Test-Path (Join-Path $Root "app\EasySubtitleSync.ps1"))) { throw "Package is incomplete: application script missing." }

$candidates = New-Object System.Collections.Generic.List[string]
if (Test-Path -LiteralPath $PackageFfmpeg) { $candidates.Add($PackageFfmpeg) }
$currentInstalled = Join-Path $Target "runtime\ffmpeg\ffmpeg.exe"
if (Test-Path -LiteralPath $currentInstalled) { $candidates.Add($currentInstalled) }
$old = Join-Path $env:APPDATA "vlc\easy-sub-sync\runtime\ffmpeg\ffmpeg.exe"
if (Test-Path -LiteralPath $old) { $candidates.Add($old) }
$cmd = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) { $candidates.Add($cmd.Source) }

$SourceFfmpeg = $candidates | Select-Object -First 1
if (-not $SourceFfmpeg) {
    throw "FFmpeg was not found. On a working computer run BUILD_OFFLINE_PACKAGE.bat, then transfer the generated Offline ZIP."
}

Write-Host "[1/5] Staging and testing FFmpeg..."
Copy-Item -Force -LiteralPath $SourceFfmpeg -Destination $StageFfmpeg
& $StageFfmpeg -version *> $null
if ($LASTEXITCODE -ne 0) { throw "FFmpeg exists but does not start correctly." }

Write-Host "[2/5] Installing the application..."
if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
New-Item -ItemType Directory -Force -Path $TargetApp, $TargetRuntime | Out-Null
Copy-Item -Force (Join-Path $Root "app\*") $TargetApp -Recurse
Copy-Item -Force -LiteralPath $StageFfmpeg -Destination (Join-Path $TargetRuntime "ffmpeg.exe")
Remove-Item -Force -ErrorAction SilentlyContinue $StageFfmpeg

Write-Host "[3/5] Testing the synchronization helper..."
& (Join-Path $TargetApp "easy_sub_sync_lite.exe") --self-test
if ($LASTEXITCODE -ne 0) { throw "The synchronization helper self-test failed." }

Write-Host "[4/5] Checking VLC..."
$vlcCandidates = New-Object System.Collections.Generic.List[string]
if ($env:ProgramFiles) {
    $p = Join-Path $env:ProgramFiles "VideoLAN\VLC\vlc.exe"
    if (Test-Path -LiteralPath $p) { $vlcCandidates.Add($p) }
}
if (${env:ProgramFiles(x86)}) {
    $p = Join-Path ${env:ProgramFiles(x86)} "VideoLAN\VLC\vlc.exe"
    if (Test-Path -LiteralPath $p) { $vlcCandidates.Add($p) }
}
if ($vlcCandidates.Count -eq 0) {
    Write-Host "WARNING: VLC was not found in the standard Program Files folders." -ForegroundColor Yellow
    Write-Host "The app will still install, but VLC must be installed before opening synchronized results."
}

Write-Host "[5/5] Creating visible shortcuts..."
$ws = New-Object -ComObject WScript.Shell
$launcher = Join-Path $TargetApp "launch_app.vbs"
$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
foreach ($folder in @($desktop,$startMenu)) {
    if (-not (Test-Path $folder)) { continue }
    $lnkPath = Join-Path $folder "Easy Subtitle Sync for VLC.lnk"
    $lnk = $ws.CreateShortcut($lnkPath)
    $lnk.TargetPath = "$env:WINDIR\System32\wscript.exe"
    $lnk.Arguments = '"' + $launcher + '"'
    $lnk.WorkingDirectory = $TargetApp
    $vlcIcon = Join-Path $env:ProgramFiles "VideoLAN\VLC\vlc.exe"
    if (Test-Path $vlcIcon) { $lnk.IconLocation = $vlcIcon + ",0" }
    $lnk.Save()
}

# Remove the old Lua extension so the primary app is visible on Desktop / Start Menu instead of VLC View.
$oldExt = Join-Path $env:APPDATA "vlc\lua\extensions\easy_sub_sync_auto.lua"
if (Test-Path $oldExt) { Remove-Item -Force $oldExt }

Write-Host ""
Write-Host "INSTALLATION COMPLETE" -ForegroundColor Green
Write-Host "Open 'Easy Subtitle Sync for VLC' from the Desktop or Start Menu."
Write-Host "The window is resizable, scrollable, and can stay above VLC."
