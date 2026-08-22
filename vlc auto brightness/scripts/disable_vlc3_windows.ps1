$ErrorActionPreference = "Stop"
$configPath = Join-Path (Join-Path $env:APPDATA "vlc") "vlcrc"
if (!(Test-Path $configPath)) {
    throw "VLC config was not found at $configPath"
}

$lines = Get-Content $configPath
$out = foreach ($line in $lines) {
    if ($line -match '^video-filter=(.*)$') {
        $parts = @($Matches[1] -split ':' | Where-Object { $_ -and $_ -ne 'autobrightness' })
        if ($parts.Count -gt 0) {
            'video-filter=' + ($parts -join ':')
        } else {
            '#video-filter='
        }
    } else {
        $line
    }
}
Set-Content -Path $configPath -Value $out -Encoding UTF8
Write-Host "Auto Brightness disabled in $configPath"
