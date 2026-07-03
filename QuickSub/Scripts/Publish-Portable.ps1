$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectFile = Join-Path $projectRoot "QuickSub.csproj"
$artifactRoot = Join-Path $projectRoot "Artifacts"
$publishDir = Join-Path $artifactRoot "Portable"
$zipPath = Join-Path $artifactRoot "QuickSub-Portable.zip"

if (Test-Path $publishDir) {
    Remove-Item $publishDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $publishDir | Out-Null

Write-Host "Publishing QuickSub as a self-contained Windows x64 single-file EXE..."

dotnet publish $projectFile `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:PublishTrimmed=false `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $publishDir

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

$exePath = Join-Path $publishDir "QuickSub.exe"
if (-not (Test-Path $exePath)) {
    throw "QuickSub.exe was not created in $publishDir"
}

$unexpectedRuntimeFiles = Get-ChildItem $publishDir -File | Where-Object {
    $_.Extension -in @(".dll", ".deps.json", ".runtimeconfig.json")
}

if ($unexpectedRuntimeFiles) {
    $names = ($unexpectedRuntimeFiles | Select-Object -ExpandProperty Name) -join ", "
    throw "The output is not a clean single-file publish. Unexpected runtime files: $names"
}

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path $exePath -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Portable EXE: $exePath"
Write-Host "Portable ZIP: $zipPath"
Write-Host "Share the EXE from Artifacts\\Portable, not the EXE from bin\\Debug or bin\\Release."
