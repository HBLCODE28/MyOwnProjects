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

Write-Host "StreamLocal - Stage 4 Browser Browse UI" -ForegroundColor Green

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
if ([string]::IsNullOrWhiteSpace($projectRel)) { $projectRel = "." }

if (-not (Test-Path "STAGES.md")) { Fail "STAGES.md is missing." }

$stages = Get-Content "STAGES.md" -Raw
$s3 = $stages.IndexOf("# Stage 3 - Browser-Only Media Recognition")
if ($s3 -lt 0) { $s3 = $stages.IndexOf("# Stage 3 - Media Recognition and Metadata") }
$s4 = $stages.IndexOf("# Stage 4 - Streaming-Style Browse UI")
$s5 = $stages.IndexOf("# Stage 5")
if ($s3 -lt 0 -or $s4 -lt 0 -or $s5 -lt 0) {
    Fail "Could not locate Stages 3-5 in STAGES.md."
}

$stage3Block = $stages.Substring($s3, $s4 - $s3)
if ($stage3Block -notmatch '\*\*Status:\*\*\s*COMPLETE') {
    Fail "Stage 3 is not marked COMPLETE."
}

$required = @(
    "frontend\src\pages\MoviesPage.tsx",
    "frontend\src\pages\SeriesPage.tsx",
    "frontend\src\services\browseData.ts",
    "frontend\src\services\browseSelectors.ts",
    "frontend\src\components\browse\MediaCard.tsx",
    "frontend\src\components\browse\SeriesCard.tsx",
    "frontend\src\styles\browse.css",
    "STAGE4_BLOCK.md"
)
foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        Fail "Stage 4 file is missing: $path. Extract the Stage 4 ZIP first."
    }
}

Step "Running Stage 4 tests, typecheck and static build"
& powershell -ExecutionPolicy Bypass -File ".\scripts\test.ps1"
if ($LASTEXITCODE -ne 0) {
    Fail "Stage 4 verification failed."
}

if (-not (Test-Path "frontend\dist\index.html")) {
    Fail "Static production build was not created."
}

Step "Verifying browser-only source"
$sourceFiles = Get-ChildItem "frontend\src" -Recurse -File -Include *.ts,*.tsx
$forbidden = @()
foreach ($sourceFile in $sourceFiles) {
    $matches = Select-String -Path $sourceFile.FullName -Pattern `
        '127\.0\.0\.1:4310|localhost:4310|/api/v1/|TMDB_|themoviedb\.org' `
        -ErrorAction SilentlyContinue
    if ($matches) {
        $forbidden += $matches
    }
}

if ($forbidden.Count -gt 0) {
    Write-Host "Forbidden backend/API references:" -ForegroundColor Yellow
    $forbidden | ForEach-Object {
        Write-Host "  $($_.Path):$($_.LineNumber) $($_.Line.Trim())"
    }
    Fail "Frontend contains a backend or external metadata API reference."
}

Step "Updating STAGES.md Stage 4"
$stages = Get-Content "STAGES.md" -Raw
$s4 = $stages.IndexOf("# Stage 4 - Streaming-Style Browse UI")
$s5 = $stages.IndexOf("# Stage 5")
if ($s4 -lt 0 -or $s5 -le $s4) {
    Fail "Could not replace Stage 4 block."
}
$stage4 = Get-Content "STAGE4_BLOCK.md" -Raw
($stages.Substring(0, $s4) + $stage4 + $stages.Substring($s5)) | Set-Content "STAGES.md" -Encoding UTF8
Remove-Item "STAGE4_BLOCK.md" -Force

Step "Preparing Git commit"
& git -C $repoRoot add -A -- $projectRel
if ($LASTEXITCODE -ne 0) {
    Fail "git add failed."
}

$staged = @(& git -C $repoRoot diff --cached --name-only -- $projectRel)
$bad = @($staged | Where-Object {
    $_ -match '(^|/)(node_modules|dist|cache|logs)/' -or
    $_ -match '\.(db|sqlite|sqlite3|mp4|mkv)$' -or
    $_ -match '(^|/)\.env$'
})
if ($bad.Count -gt 0) {
    Write-Host "Runtime/private files staged unexpectedly:" -ForegroundColor Yellow
    $bad | ForEach-Object { Write-Host "  $_" }
    Fail "Remove runtime/private files from Git staging."
}

if ($NoCommit) {
    Write-Host ""
    Write-Host "Stage 4 verification passed and changes are staged. Commit skipped by -NoCommit." -ForegroundColor Yellow
    exit 0
}

Step "Committing Stage 4"
& git -C $repoRoot commit -m "Stage 4: streaming browse UI"
if ($LASTEXITCODE -ne 0) {
    Fail "Stage 4 commit failed."
}

$remaining = @(& git -C $repoRoot status --porcelain -- $projectRel)
if ($remaining.Count -gt 0) {
    Write-Host "Remaining StreamLocal changes:" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host "  $_" }
    Fail "Stage 4 commit exists, but the StreamLocal working tree is not clean."
}

$hash = (& git -C $repoRoot rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host "Stage 4 COMPLETE - Streaming Browse UI" -ForegroundColor Green
Write-Host "Commit: $hash"
Write-Host "Next allowed Stage: Stage 5"
