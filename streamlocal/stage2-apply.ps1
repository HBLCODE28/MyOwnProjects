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

Write-Host "StreamLocal - Stage 2 apply and verification" -ForegroundColor Green

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\Git\cmd\git.exe") {
        $env:Path += ";C:\Program Files\Git\cmd"
    }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "Git was not found." }

$projectRoot = (Resolve-Path ".").Path
$repoRootRaw = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0) { Fail "Run this script from the StreamLocal project folder." }
$repoRoot = (Resolve-Path $repoRootRaw.Trim()).Path
$projectRel = (Get-RelativePathCompat $repoRoot $projectRoot) -replace '\\','/'
if ([string]::IsNullOrWhiteSpace($projectRel)) { $projectRel = "." }

if (-not (Test-Path "SPEC.md")) { Fail "SPEC.md is missing." }
if (-not (Test-Path "STAGES.md")) { Fail "STAGES.md is missing." }

$stages = Get-Content "STAGES.md" -Raw
$s1 = $stages.IndexOf("# Stage 1 - Foundation")
$s2 = $stages.IndexOf("# Stage 2 - Persistent Media Library")
$s3 = $stages.IndexOf("# Stage 3 - Media Recognition and Metadata")
if ($s1 -lt 0 -or $s2 -lt 0 -or $s3 -lt 0) { Fail "Could not locate Stages 1-3 in STAGES.md." }
$stage1Block = $stages.Substring($s1, $s2 - $s1)
if ($stage1Block -notmatch '\*\*Status:\*\*\s*COMPLETE') { Fail "Stage 1 is not marked COMPLETE." }

$required = @(
    "backend\app\models\library_source.py",
    "backend\app\models\media_file.py",
    "backend\app\services\library_scanner.py",
    "backend\app\services\fingerprint_service.py",
    "backend\app\services\ffprobe_service.py",
    "backend\app\services\watcher_service.py",
    "backend\app\api\v1\library.py",
    "backend\migrations\versions\0002_persistent_media_library.py",
    "frontend\src\pages\LibraryPage.tsx"
)
foreach ($path in $required) {
    if (-not (Test-Path $path)) { Fail "Stage 2 file is missing: $path" }
}

if (Test-Path "README.stage2.md") {
    Copy-Item "README.stage2.md" "README.md" -Force
    Remove-Item "README.stage2.md" -Force
}

Step "Installing updated dependencies and applying migration"
& powershell -ExecutionPolicy Bypass -File ".\scripts\bootstrap.ps1"
if ($LASTEXITCODE -ne 0) { Fail "Bootstrap/migration failed." }

Step "Running automated tests and frontend build"
& powershell -ExecutionPolicy Bypass -File ".\scripts\test.ps1"
if ($LASTEXITCODE -ne 0) { Fail "Stage 2 tests/build failed." }

$venvPython = Join-Path $projectRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) { Fail "Backend virtual environment was not found." }

Step "Checking Alembic revision"
Push-Location "backend"
try {
    $current = & $venvPython -m alembic current
    if ($LASTEXITCODE -ne 0) { Fail "Alembic current failed." }
    if (($current -join "`n") -notmatch "0002_library") { Fail "Database is not at migration 0002_library." }
}
finally { Pop-Location }

Step "Running temporary MP4/MKV scanner smoke test"
$tmp = Join-Path $env:TEMP ("streamlocal-stage2-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
$smokeFile = Join-Path $env:TEMP ("streamlocal_stage2_smoke_" + [guid]::NewGuid().ToString("N") + ".py")
try {
    [System.IO.File]::WriteAllBytes((Join-Path $tmp "Stage2.Sample.mp4"), [byte[]](1,2,3,4))
    [System.IO.File]::WriteAllBytes((Join-Path $tmp "Stage2.Sample.mkv"), [byte[]](5,6,7,8))

    $smoke = @"
from app.database import SessionLocal
from app.models import LibrarySource, MediaFile
from app.services.library_scanner import LibraryScanner
from app.services.path_service import normalize_windows_path
from sqlalchemy import select
import sys

path = sys.argv[1]
with SessionLocal() as db:
    existing = db.scalar(select(LibrarySource).where(LibrarySource.normalized_path == normalize_windows_path(path)))
    if existing:
        source = existing
        source.enabled = True
    else:
        source = LibrarySource(path=path, normalized_path=normalize_windows_path(path), source_type="automatic", enabled=True, recursive=True)
        db.add(source)
    db.commit()
    db.refresh(source)
    job = LibraryScanner(db).scan_source(source.id)
    files = db.scalars(select(MediaFile).where(MediaFile.library_source_id == source.id)).all()
    assert len(files) == 2, len(files)
    assert job.files_scanned == 2, job.files_scanned
    source.enabled = False
    for media_file in files:
        media_file.online = False
    db.commit()

print("Stage 2 scanner smoke test passed")
"@
    $smoke | Set-Content $smokeFile -Encoding UTF8

    Push-Location "backend"
    try {
        & $venvPython $smokeFile $tmp
        if ($LASTEXITCODE -ne 0) { Fail "Temporary library scanner smoke test failed." }
    }
    finally { Pop-Location }
}
finally {
    Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Step "Updating STAGES.md"
$stages = Get-Content "STAGES.md" -Raw
$s2 = $stages.IndexOf("# Stage 2 - Persistent Media Library")
$s3 = $stages.IndexOf("# Stage 3 - Media Recognition and Metadata")
$before = $stages.Substring(0, $s2)
$block = $stages.Substring($s2, $s3 - $s2)
$after = $stages.Substring($s3)

$block = $block -replace '\*\*Status:\*\*\s*(NOT STARTED|IN PROGRESS|BLOCKED)', '**Status:** COMPLETE'
$block = $block -replace '(?m)^- \[ \] ', '- [x] '
$today = Get-Date -Format "yyyy-MM-dd"
$block = $block -replace '(?m)^- Completion date:\s*$', "- Completion date: $today"
$block = $block -replace '(?m)^- Git commit/tag:\s*$', "- Git commit/tag: Stage 2 persistent media library commit"

($before + $block + $after) | Set-Content "STAGES.md" -Encoding UTF8

Step "Preparing Stage 2 Git commit"
& git -C $repoRoot add -- $projectRel
if ($LASTEXITCODE -ne 0) { Fail "git add failed." }

$staged = @(& git -C $repoRoot diff --cached --name-only -- $projectRel)
$bad = @($staged | Where-Object {
    $_ -match '(^|/)(node_modules|\.venv|dist|cache|logs)/' -or
    $_ -match '\.(db|sqlite|sqlite3|mp4|mkv)$' -or
    $_ -match '(^|/)\.env$'
})
if ($bad.Count -gt 0) {
    Write-Host "Generated/runtime files staged unexpectedly:" -ForegroundColor Yellow
    $bad | ForEach-Object { Write-Host "  $_" }
    Fail "Remove generated/runtime files from staging."
}

if ($NoCommit) {
    Write-Host "Stage 2 passed and is staged. Commit skipped by -NoCommit." -ForegroundColor Yellow
    exit 0
}

Step "Committing Stage 2"
& git -C $repoRoot commit -m "Stage 2: persistent media library"
if ($LASTEXITCODE -ne 0) { Fail "Stage 2 commit failed." }

$remaining = @(& git -C $repoRoot status --porcelain -- $projectRel)
if ($remaining.Count -gt 0) {
    Write-Host "Remaining StreamLocal changes:" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host "  $_" }
    Fail "Stage 2 commit exists, but StreamLocal is not clean."
}

$hash = (& git -C $repoRoot rev-parse --short HEAD).Trim()
Write-Host ""
Write-Host "Stage 2 COMPLETE" -ForegroundColor Green
Write-Host "Commit: $hash"
Write-Host 'Home headline: "Your local player."'
Write-Host "Next allowed Stage: Stage 3 - Media Recognition and Metadata"
