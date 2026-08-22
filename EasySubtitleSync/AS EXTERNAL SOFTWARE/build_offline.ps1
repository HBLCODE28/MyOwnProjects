$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Parent = Split-Path -Parent $Root
$OutFolder = Join-Path $Parent "EasySubtitleSync_v1.0_Offline"
$OutZip = Join-Path $Parent "EasySubtitleSync_v1.0_Offline.zip"

$candidates = @(
    (Join-Path $Root "runtime\ffmpeg\ffmpeg.exe"),
    (Join-Path $env:LOCALAPPDATA "EasySubtitleSync\runtime\ffmpeg\ffmpeg.exe"),
    (Join-Path $env:APPDATA "vlc\easy-sub-sync\runtime\ffmpeg\ffmpeg.exe")
)
$cmd = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
if ($cmd) { $candidates += $cmd.Source }
$ffmpeg = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $ffmpeg) { throw "No working FFmpeg was found on this computer." }

Write-Host "Testing FFmpeg..."
& $ffmpeg -version *> $null
if ($LASTEXITCODE -ne 0) { throw "The detected FFmpeg cannot start." }

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $OutFolder
Remove-Item -Force -ErrorAction SilentlyContinue $OutZip
New-Item -ItemType Directory -Force -Path $OutFolder | Out-Null
Get-ChildItem -LiteralPath $Root -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $OutFolder -Recurse -Force
}
$dest = Join-Path $OutFolder "runtime\ffmpeg\ffmpeg.exe"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
Copy-Item -Force $ffmpeg $dest

Write-Host "Creating Offline ZIP..."
Compress-Archive -Path (Join-Path $OutFolder "*") -DestinationPath $OutZip -CompressionLevel Optimal
Write-Host ""
Write-Host "DONE: $OutZip" -ForegroundColor Green
Write-Host "Transfer that ZIP to the other computer, extract it, and run INSTALL.bat."
