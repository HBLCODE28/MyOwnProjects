$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== Building Groove EXE ==="
& .\build_exe.ps1

if (-not (Test-Path "dist\Groove.exe")) {
    throw "dist\Groove.exe was not created."
}

if (-not (Test-Path "vendor\ffmpeg\bin\ffmpeg.exe")) {
    Write-Host ""
    Write-Warning "vendor\ffmpeg\bin\ffmpeg.exe was not found. The installer will be created, but MP3/MP4 downloads may fail on computers that do not already have FFmpeg installed. Put ffmpeg.exe in vendor\ffmpeg\bin before building to make the installer fully self-contained."
}

$iscc = $null
$cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if ($cmd) { $iscc = $cmd.Source }

$possible = @(
    "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LocalAppData\Programs\Inno Setup 6\ISCC.exe"
)
foreach ($path in $possible) {
    if (-not $iscc -and (Test-Path $path)) { $iscc = $path }
}

if (-not $iscc) {
    throw "Inno Setup 6 was not found. Install Inno Setup 6 on this build computer, then run build_installer.ps1 again. The end-user computer does not need Inno Setup."
}

Write-Host ""
Write-Host "=== Building Groove installer ==="
& $iscc "installer\Groove.iss"

if (Test-Path "installer\GrooveSetup.exe") {
    Write-Host ""
    Write-Host "Built successfully: installer\GrooveSetup.exe"
    Write-Host "Send this file to another Windows computer and run it there."
} else {
    throw "Installer build finished, but installer\GrooveSetup.exe was not found."
}
