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

Write-Host "StreamLocal - Stage 3 Browser-Only Migration" -ForegroundColor Green

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
if (-not (Test-Path "SPEC.md")) { Fail "SPEC.md is missing." }

$stages = Get-Content "STAGES.md" -Raw
$s2 = $stages.IndexOf("# Stage 2 - Persistent Media Library")
$s3 = $stages.IndexOf("# Stage 3 - Media Recognition and Metadata")
if ($s3 -lt 0) {
    $s3 = $stages.IndexOf("# Stage 3 - Browser-Only Media Recognition")
}
$s4 = $stages.IndexOf("# Stage 4 - Streaming-Style Browse UI")

if ($s2 -lt 0 -or $s3 -lt 0 -or $s4 -lt 0) {
    Fail "Could not locate Stages 2-4 in STAGES.md."
}

$stage2Block = $stages.Substring($s2, $s3 - $s2)
if ($stage2Block -notmatch '\*\*Status:\*\*\s*COMPLETE') {
    Fail "Stage 2 is not marked COMPLETE."
}

$required = @(
    "frontend\src\db\streamlocalDb.ts",
    "frontend\src\services\libraryScanner.ts",
    "frontend\src\services\filenameParser.ts",
    "frontend\src\services\recognition.ts",
    "frontend\src\services\backup.ts",
    "frontend\src\pages\LibraryPage.tsx",
    "frontend\src\pages\RecognitionPage.tsx",
    "frontend\src\pages\SettingsPage.tsx",
    "frontend\public\manifest.webmanifest",
    "STAGE3_BLOCK.md"
)
foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        Fail "Stage 3 file is missing: $path. Extract the Stage 3 ZIP into StreamLocal first."
    }
}

if (Test-Path "README.stage3-browser.md") {
    Copy-Item "README.stage3-browser.md" "README.md" -Force
    Remove-Item "README.stage3-browser.md" -Force
}

Step "Removing old frontend backend-API modules"
if (Test-Path "frontend\src\api") {
    Remove-Item "frontend\src\api" -Recurse -Force
}
if (Test-Path "frontend\src\components\system") {
    Remove-Item "frontend\src\components\system" -Recurse -Force
}

Step "Installing browser-only dependencies"
& powershell -ExecutionPolicy Bypass -File ".\scripts\bootstrap.ps1"
if ($LASTEXITCODE -ne 0) {
    Fail "Browser-only bootstrap failed."
}

Step "Running Stage 3 tests, typecheck and static build"
& powershell -ExecutionPolicy Bypass -File ".\scripts\test.ps1"
if ($LASTEXITCODE -ne 0) {
    Fail "Stage 3 verification failed."
}

if (-not (Test-Path "frontend\dist\index.html")) {
    Fail "Static production build was not created."
}
if (-not (Test-Path "frontend\dist\manifest.webmanifest")) {
    Fail "PWA manifest is missing from production build."
}
if (-not (Test-Path "frontend\dist\sw.js")) {
    Fail "Service worker is missing from production build."
}

Step "Verifying frontend has no backend API dependency"
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
    Fail "Frontend still contains a backend or external metadata API reference."
}

Step "Removing obsolete backend runtime from project"
if (Test-Path "backend") {
    Remove-Item "backend" -Recurse -Force
}

# The old environment template represented backend/API configuration.
if (Test-Path ".env.example") {
    Remove-Item ".env.example" -Force
}

# Do not delete a user's real .env if it exists. It is simply unused after Stage 3.

Step "Replacing Stage 3 tracker with browser-only Stage 3"
$stages = Get-Content "STAGES.md" -Raw
$s3 = $stages.IndexOf("# Stage 3 - Media Recognition and Metadata")
if ($s3 -lt 0) {
    $s3 = $stages.IndexOf("# Stage 3 - Browser-Only Media Recognition")
}
$s4 = $stages.IndexOf("# Stage 4 - Streaming-Style Browse UI")
if ($s3 -lt 0 -or $s4 -le $s3) {
    Fail "Could not replace the Stage 3 tracker block."
}

$canonicalStage3 = Get-Content "STAGE3_BLOCK.md" -Raw
$updatedStages = $stages.Substring(0, $s3) + $canonicalStage3 + $stages.Substring($s4)
$updatedStages | Set-Content "STAGES.md" -Encoding UTF8
Remove-Item "STAGE3_BLOCK.md" -Force

Step "Writing browser-only architecture note into SPEC.md"
$spec = Get-Content "SPEC.md" -Raw
$marker = "<!-- STREAMLOCAL_BROWSER_ONLY_ARCHITECTURE -->"
if ($spec -notmatch [regex]::Escape($marker)) {
    $note = @"

$marker
## Architecture Update - Stage 3 Browser-Only

As of Stage 3, StreamLocal's product runtime is a static browser application/PWA.

The prior FastAPI/SQLAlchemy/SQLite runtime architecture is superseded for the active implementation. The browser stores application data in IndexedDB and reads user-approved media folders using the File System Access API. No external metadata API is used.

Node.js/Vite remain development/build tools only. Production output is static `frontend/dist` content and does not require Python or a database server.

File System Access requires a supported browser and secure context. Production deployment should use a stable HTTPS origin/PWA. Direct `file://` deployment is not the supported path.
"@
    ($spec + $note) | Set-Content "SPEC.md" -Encoding UTF8
}

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

$backendTracked = @(& git -C $repoRoot diff --cached --name-only --diff-filter=ACMR -- "$projectRel/backend")
if ($backendTracked.Count -gt 0) {
    Fail "Backend files remain staged as active files."
}

if ($NoCommit) {
    Write-Host ""
    Write-Host "Stage 3 verification passed and changes are staged. Commit skipped by -NoCommit." -ForegroundColor Yellow
    exit 0
}

Step "Committing Stage 3"
& git -C $repoRoot commit -m "Stage 3: browser-only media recognition"
if ($LASTEXITCODE -ne 0) {
    Fail "Stage 3 commit failed."
}

$remaining = @(& git -C $repoRoot status --porcelain -- $projectRel)
if ($remaining.Count -gt 0) {
    Write-Host "Remaining StreamLocal changes:" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host "  $_" }
    Fail "Stage 3 commit exists, but the StreamLocal working tree is not clean."
}

$hash = (& git -C $repoRoot rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host "Stage 3 COMPLETE - Browser-Only" -ForegroundColor Green
Write-Host "Commit: $hash"
Write-Host "Runtime backend: removed"
Write-Host "Database: IndexedDB"
Write-Host "External metadata APIs: none"
Write-Host "Static build: frontend\dist"
Write-Host "Next allowed Stage: Stage 4 - Streaming-Style Browse UI"
