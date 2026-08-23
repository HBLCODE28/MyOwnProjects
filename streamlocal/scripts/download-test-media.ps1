param(
    [string]$OutputDirectory = ".\test-media"
)

$ErrorActionPreference = "Stop"

$sourceUrl = "https://uploads.video-commander.com/sample/BigBuckBunny.mp4"
$sourceFile = Join-Path $OutputDirectory "_BigBuckBunny-source.mp4"
$movieOutput = Join-Path $OutputDirectory "StreamLocal.Test.Movie.2026.mp4"
$episodeOutput = Join-Path $OutputDirectory "StreamLocal.Test.Show.S01E01.mp4"

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Get-Ffmpeg {
    $command = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $known = @(
        "C:\ffmpeg\bin\ffmpeg.exe",
        "C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
    )

    foreach ($path in $known) {
        if (Test-Path $path -PathType Leaf) {
            return $path
        }

        if (Test-Path $path -PathType Container) {
            $found = Get-ChildItem $path -Recurse -Filter ffmpeg.exe -File -ErrorAction SilentlyContinue |
                Select-Object -First 1

            if ($found) {
                return $found.FullName
            }
        }
    }

    return $null
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$ffmpeg = Get-Ffmpeg
if (-not $ffmpeg) {
    Fail @"
ffmpeg was not found.

Install FFmpeg on Windows, then run this script again.
For example with winget:
  winget install --id Gyan.FFmpeg -e

The StreamLocal app itself does not require FFmpeg at runtime.
This script uses it only to build exact 20-minute local test files.
"@
}

Write-Host ""
Write-Host "StreamLocal 20-minute test media" -ForegroundColor Green
Write-Host "Source: Big Buck Bunny - open Blender Foundation film"
Write-Host "Downloading source (~10 minutes, H.264 MP4)..."

if (-not (Test-Path $sourceFile)) {
    Invoke-WebRequest `
        -Uri $sourceUrl `
        -OutFile $sourceFile `
        -UseBasicParsing
}

if (-not (Test-Path $sourceFile)) {
    Fail "The test source was not downloaded."
}

function Build-TestFile {
    param(
        [string]$Output,
        [string]$Title
    )

    Write-Host ""
    Write-Host "Creating exactly 20:00 -> $Output" -ForegroundColor Cyan

    & $ffmpeg `
        -hide_banner `
        -loglevel warning `
        -y `
        -stream_loop 2 `
        -i $sourceFile `
        -t 00:20:00 `
        -map 0:v:0 `
        -map 0:a:0? `
        -map_metadata -1 `
        -metadata "title=$Title" `
        -c copy `
        -movflags +faststart `
        $Output

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Output)) {
        Fail "ffmpeg could not create $Output"
    }
}

Build-TestFile `
    -Output $movieOutput `
    -Title "StreamLocal 20 Minute Movie Test"

Build-TestFile `
    -Output $episodeOutput `
    -Title "StreamLocal 20 Minute Episode Test"

Remove-Item $sourceFile -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Test media ready." -ForegroundColor Green
Write-Host ""
Write-Host "Files:"
Write-Host "  $movieOutput"
Write-Host "  $episodeOutput"
Write-Host ""
Write-Host "Both files are exactly 20 minutes."
Write-Host "Add this folder to StreamLocal Library and scan it."
Write-Host ""
Write-Host "The source film is Big Buck Bunny by the Blender Foundation,"
Write-Host "distributed as open content under Creative Commons Attribution 3.0."
