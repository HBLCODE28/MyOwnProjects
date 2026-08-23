param([switch]$NoCommit)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Get-RelativePathCompat {
    param([string]$BasePath, [string]$TargetPath)

    $baseResolved = (Resolve-Path -LiteralPath $BasePath).Path
    $targetResolved = (Resolve-Path -LiteralPath $TargetPath).Path

    if (-not $baseResolved.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $baseResolved += [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = New-Object System.Uri($baseResolved)
    $targetUri = New-Object System.Uri($targetResolved)
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)

    return ([System.Uri]::UnescapeDataString($relativeUri.ToString()) -replace '/', '\')
}

Write-Host "StreamLocal - Stage 9 Immersive Player + Viewing State" -ForegroundColor Green

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\Git\cmd\git.exe") {
        $env:Path += ";C:\Program Files\Git\cmd"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "Git was not found."
}

$projectRoot = (Resolve-Path ".").Path
$repoRootRaw = (& git rev-parse --show-toplevel 2>$null)

if ($LASTEXITCODE -ne 0) {
    Fail "Run this script from the StreamLocal project directory."
}

$repoRoot = (Resolve-Path $repoRootRaw.Trim()).Path
$projectRel = (Get-RelativePathCompat $repoRoot $projectRoot) -replace '\\','/'

if ([string]::IsNullOrWhiteSpace($projectRel)) {
    $projectRel = "."
}

if (-not (Test-Path "STAGES.md")) {
    Fail "STAGES.md is missing."
}

$stages = Get-Content "STAGES.md" -Raw
$s8 = $stages.IndexOf("# Stage 8")
$s9 = $stages.IndexOf("# Stage 9")

if ($s8 -lt 0 -or $s9 -lt 0) {
    Fail "Could not locate Stages 8-9 in STAGES.md."
}

$stage8Block = $stages.Substring($s8, $s9 - $s8)

if ($stage8Block -notmatch '\*\*Status:\*\*\s*COMPLETE') {
    Fail "Stage 8 is not marked COMPLETE."
}

$required = @(
    "frontend\src\services\playbackProgress.ts",
    "frontend\src\services\wikipediaMovieProvider.ts",
    "frontend\src\components\player\PlayerOverlay.tsx",
    "frontend\src\components\browse\SeriesHubOverlay.tsx",
    "frontend\src\components\layout\AppShell.tsx",
    "frontend\src\styles\player.css",
    "frontend\src\styles\appShell.css",
    "STAGE9_BLOCK.md"
)

foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        Fail "Stage 9 file is missing: $path. Extract the Stage 9 ZIP first."
    }
}

Step "Running Stage 9 tests, typecheck and static build"
& powershell -ExecutionPolicy Bypass -File ".\scripts\test.ps1"

if ($LASTEXITCODE -ne 0) {
    Fail "Stage 9 verification failed."
}

if (-not (Test-Path "frontend\dist\index.html")) {
    Fail "Static production build was not created."
}

Step "Verifying browser-only runtime"
$sourceFiles = Get-ChildItem "frontend\src" -Recurse -File -Include *.ts,*.tsx
$forbidden = @()

foreach ($sourceFile in $sourceFiles) {
    $matches = Select-String `
        -Path $sourceFile.FullName `
        -Pattern '127\.0\.0\.1:4310|localhost:4310|/api/v1/' `
        -ErrorAction SilentlyContinue

    if ($matches) {
        $forbidden += $matches
    }
}

if ($forbidden.Count -gt 0) {
    $forbidden | ForEach-Object {
        Write-Host "  $($_.Path):$($_.LineNumber) $($_.Line.Trim())"
    }

    Fail "Frontend contains an application-backend API reference."
}

Step "Updating STAGES.md Stage 9"
$stages = Get-Content "STAGES.md" -Raw
$s9 = $stages.IndexOf("# Stage 9")
$s10 = $stages.IndexOf("# Stage 10")

if ($s9 -lt 0) {
    Fail "Could not locate Stage 9."
}

$end = if ($s10 -gt $s9) { $s10 } else { $stages.Length }
$stage9 = Get-Content "STAGE9_BLOCK.md" -Raw

(
    $stages.Substring(0, $s9) +
    $stage9 +
    $stages.Substring($end)
) | Set-Content "STAGES.md" -Encoding UTF8

Remove-Item "STAGE9_BLOCK.md" -Force

Step "Preparing Git commit"
& git -C $repoRoot add -A -- $projectRel

if ($LASTEXITCODE -ne 0) {
    Fail "git add failed."
}

$staged = @(
    & git -C $repoRoot diff --cached --name-only -- $projectRel
)

$bad = @(
    $staged | Where-Object {
        $_ -match '(^|/)(node_modules|dist|cache|logs)/' -or
        $_ -match '\.(db|sqlite|sqlite3|mp4|mkv)$' -or
        $_ -match '(^|/)\.env$'
    }
)

if ($bad.Count -gt 0) {
    Write-Host "Runtime/private files staged unexpectedly:" -ForegroundColor Yellow
    $bad | ForEach-Object { Write-Host "  $_" }
    Fail "Remove runtime/private files from Git staging."
}

if ($NoCommit) {
    Write-Host ""
    Write-Host "Stage 9 verification passed and changes are staged. Commit skipped by -NoCommit." -ForegroundColor Yellow
    exit 0
}

Step "Committing Stage 9"
& git -C $repoRoot commit -m "Stage 9: immersive player and viewing state"

if ($LASTEXITCODE -ne 0) {
    Fail "Stage 9 commit failed."
}

$remaining = @(
    & git -C $repoRoot status --porcelain -- $projectRel
)

if ($remaining.Count -gt 0) {
    $remaining | ForEach-Object { Write-Host "  $_" }
    Fail "Stage 9 commit exists, but StreamLocal is not clean."
}

$hash = (& git -C $repoRoot rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host "Stage 9 COMPLETE - Immersive Player + Viewing State" -ForegroundColor Green
Write-Host "Commit: $hash"
Write-Host "Player navbar: hidden during playback"
Write-Host "Episode state: Started + Watched"
Write-Host "Wikipedia poster reporting: fixed"
Write-Host "Next allowed Stage: Stage 10"
