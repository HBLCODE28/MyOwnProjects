$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectFile = Join-Path $projectRoot "QuickSub.csproj"
$publishDir = Join-Path $projectRoot "bin\Release\net8.0-windows\win-x64\publish"
$artifactDir = Join-Path $projectRoot "Artifacts\Portable"
$zipPath = Join-Path $projectRoot "Artifacts\QuickSub-Portable.zip"

Write-Host "Publishing QuickSub as a self-contained Windows x64 single-file EXE..."
dotnet publish $projectFile -c Release -r win-x64 --self-contained true -p:PublishProfile=Portable

if (-not (Test-Path (Join-Path $publishDir "QuickSub.exe"))) {
    throw "QuickSub.exe was not created in $publishDir"
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
Copy-Item (Join-Path $publishDir "QuickSub.exe") (Join-Path $artifactDir "QuickSub.exe") -Force

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $artifactDir "QuickSub.exe") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Portable EXE: $artifactDir\QuickSub.exe"
Write-Host "Portable ZIP: $zipPath"
