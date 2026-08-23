param(
    [switch]$NoInstall,
    [switch]$NoCommit
)

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
    param(
        [Parameter(Mandatory=$true)][string]$BasePath,
        [Parameter(Mandatory=$true)][string]$TargetPath
    )

    $baseResolved = (Resolve-Path -LiteralPath $BasePath).Path
    $targetResolved = (Resolve-Path -LiteralPath $TargetPath).Path

    if (-not $baseResolved.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $baseResolved += [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = New-Object System.Uri($baseResolved)
    $targetUri = New-Object System.Uri($targetResolved)
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    $relative = [System.Uri]::UnescapeDataString($relativeUri.ToString())
    return ($relative -replace '/', '\')
}

Write-Host "StreamLocal - Stage 1 apply and verification" -ForegroundColor Green

# Add common Git path for this PowerShell process if necessary.
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $defaultGit = "C:\Program Files\Git\cmd"
    if (Test-Path (Join-Path $defaultGit "git.exe")) {
        $env:Path += ";$defaultGit"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "Git was not found."
}

$projectRoot = (Resolve-Path ".").Path
$repoRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0) {
    Fail "Run this script from the StreamLocal project directory inside the Git repository."
}
$repoRoot = (Resolve-Path $repoRoot.Trim()).Path
$projectRel = (Get-RelativePathCompat -BasePath $repoRoot -TargetPath $projectRoot) -replace '\\','/'
if ([string]::IsNullOrWhiteSpace($projectRel)) { $projectRel = "." }

Write-Host "Git root: $repoRoot"
Write-Host "StreamLocal: $projectRoot"
Write-Host "Project path in Git: $projectRel"

if (-not (Test-Path "SPEC.md")) { Fail "SPEC.md is missing." }
if (-not (Test-Path "STAGES.md")) { Fail "STAGES.md is missing." }

$stagesBefore = Get-Content "STAGES.md" -Raw
$stage0Start = $stagesBefore.IndexOf("# Stage 0 - Repository and Development Rules")
$stage1Start = $stagesBefore.IndexOf("# Stage 1 - Foundation")
$stage2Start = $stagesBefore.IndexOf("# Stage 2 - Persistent Media Library")
if ($stage0Start -lt 0 -or $stage1Start -lt 0 -or $stage2Start -lt 0) {
    Fail "Could not locate Stages 0-2 in STAGES.md."
}
$stage0Block = $stagesBefore.Substring($stage0Start, $stage1Start - $stage0Start)
if ($stage0Block -notmatch '\*\*Status:\*\*\s*COMPLETE') {
    Fail "Stage 0 is not marked COMPLETE. Stage 1 cannot start."
}

# Refuse unrelated staged files outside project.
$staged = @(& git -C $repoRoot diff --cached --name-only)
if ($projectRel -ne ".") {
    $prefix = $projectRel.TrimEnd("/") + "/"
    $outside = @($staged | Where-Object { -not $_.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) })
    if ($outside.Count -gt 0) {
        Write-Host "Staged files outside StreamLocal:" -ForegroundColor Yellow
        $outside | ForEach-Object { Write-Host "  $_" }
        Fail "Unstage unrelated files before Stage 1."
    }
}

# Ensure package files are located in project.
$required = @(
    "backend\pyproject.toml",
    "backend\app\main.py",
    "backend\alembic.ini",
    "backend\migrations\versions\0001_stage1_foundation.py",
    "frontend\package.json",
    "frontend\src\App.tsx",
    "scripts\bootstrap.ps1",
    "scripts\test.ps1",
    "scripts\dev.ps1"
)
foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        Fail "Stage 1 file is missing: $path. Extract/copy the Stage 1 package into StreamLocal first."
    }
}

# Replace README with the Stage 1 version.
if (Test-Path "README.stage1.md") {
    Copy-Item "README.stage1.md" "README.md" -Force
    Remove-Item "README.stage1.md" -Force
}

if (-not $NoInstall) {
    Step "Bootstrapping Stage 1 dependencies"
    & powershell -ExecutionPolicy Bypass -File ".\scripts\bootstrap.ps1"
    if ($LASTEXITCODE -ne 0) { Fail "Bootstrap failed." }

    Step "Running Stage 1 verification"
    & powershell -ExecutionPolicy Bypass -File ".\scripts\test.ps1"
    if ($LASTEXITCODE -ne 0) { Fail "Stage 1 tests/build failed." }

    # Directly verify migration state and health endpoint without requiring a long-running server.
    Step "Verifying Alembic and application data path"
    $venvPython = Join-Path $projectRoot "backend\.venv\Scripts\python.exe"
    Push-Location "backend"
    try {
        $current = & $venvPython -m alembic current
        if ($LASTEXITCODE -ne 0) { Fail "Alembic current failed." }
        if (($current -join "`n") -notmatch "0001_stage1") {
            Fail "Alembic is not at the Stage 1 migration."
        }

        $dbPath = & $venvPython -c "from app.config import get_settings; print(get_settings().database_path)"
        if (-not (Test-Path $dbPath.Trim())) {
            Fail "SQLite database was not created at the application-data path."
        }
        Write-Host "SQLite: $($dbPath.Trim())"
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "Skipping dependency installation/tests because -NoInstall was specified." -ForegroundColor Yellow
    Write-Host "Stage 1 will NOT be marked COMPLETE automatically." -ForegroundColor Yellow
    exit 0
}

Step "Updating STAGES.md"

$stagesText = Get-Content "STAGES.md" -Raw
$stage1Start = $stagesText.IndexOf("# Stage 1 - Foundation")
$stage2Start = $stagesText.IndexOf("# Stage 2 - Persistent Media Library")
if ($stage1Start -lt 0 -or $stage2Start -le $stage1Start) {
    Fail "Could not locate Stage 1 boundaries."
}

$before = $stagesText.Substring(0, $stage1Start)
$stage1 = $stagesText.Substring($stage1Start, $stage2Start - $stage1Start)
$after = $stagesText.Substring($stage2Start)

$stage1 = $stage1 -replace '\*\*Status:\*\*\s*(NOT STARTED|IN PROGRESS|BLOCKED)', '**Status:** COMPLETE'
$stage1 = $stage1 -replace '(?m)^- \[ \] ', '- [x] '
$today = Get-Date -Format "yyyy-MM-dd"
$stage1 = $stage1 -replace '(?m)^- Completion date:\s*$', "- Completion date: $today"
$stage1 = $stage1 -replace '(?m)^- Git commit/tag:\s*$', "- Git commit/tag: Stage 1 foundation commit"

($before + $stage1 + $after) | Set-Content "STAGES.md" -Encoding UTF8

Step "Preparing Git commit"

# The apply script itself is useful to retain under scripts for reproducibility.
if (Test-Path ".\stage1-apply.ps1") {
    Copy-Item ".\stage1-apply.ps1" ".\scripts\stage1-apply.ps1" -Force
}

# Remove Stage 0 one-off root setup script if it still exists and is untracked.
# Do not delete if already tracked.
if (Test-Path ".\streamlocal-stage0.ps1") {
    & git -C $repoRoot ls-files --error-unmatch -- "$projectRel/streamlocal-stage0.ps1" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Remove-Item ".\streamlocal-stage0.ps1" -Force
    }
}

& git -C $repoRoot add -- $projectRel
if ($LASTEXITCODE -ne 0) { Fail "git add failed." }

# Safety: refuse tracked runtime/build artifacts despite .gitignore.
$stagedProject = @(& git -C $repoRoot diff --cached --name-only -- $projectRel)
$bad = @($stagedProject | Where-Object {
    $_ -match '(^|/)(node_modules|\.venv|dist|cache|logs)/' -or
    $_ -match '\.(db|sqlite|sqlite3)$' -or
    $_ -match '(^|/)\.env$'
})
if ($bad.Count -gt 0) {
    Write-Host "Runtime/generated files were staged unexpectedly:" -ForegroundColor Yellow
    $bad | ForEach-Object { Write-Host "  $_" }
    Fail "Unstage these files before committing Stage 1."
}

if ($NoCommit) {
    Write-Host "Stage 1 verification passed and files are staged. Commit was skipped by -NoCommit." -ForegroundColor Yellow
    exit 0
}

Step "Committing Stage 1"
& git -C $repoRoot commit -m "Stage 1: foundation"
if ($LASTEXITCODE -ne 0) { Fail "Stage 1 commit failed." }

$remaining = @(& git -C $repoRoot status --porcelain -- $projectRel)
if ($remaining.Count -gt 0) {
    Write-Host "Remaining StreamLocal changes:" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host "  $_" }
    Fail "Stage 1 commit exists, but the StreamLocal working tree is not clean."
}

$hash = (& git -C $repoRoot rev-parse --short HEAD).Trim()
Write-Host ""
Write-Host "Stage 1 COMPLETE" -ForegroundColor Green
Write-Host "Commit: $hash"
Write-Host "Next allowed Stage: Stage 2 - Persistent Media Library"
