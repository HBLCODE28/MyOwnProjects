$ErrorActionPreference = 'Stop'
$configPath = Join-Path (Join-Path $env:APPDATA 'vlc') 'vlcrc'
if (-not (Test-Path $configPath)) { exit 0 }

$lines = @(Get-Content -LiteralPath $configPath)
$out = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
    if ($line -match '^video-filter=(.*)$') {
        $parts = @($Matches[1] -split ':' | Where-Object { $_ -and $_ -ne 'autobrightness' })
        if ($parts.Count -gt 0) {
            $out.Add('video-filter=' + ($parts -join ':'))
        } else {
            $out.Add('#video-filter=')
        }
    } else {
        $out.Add($line)
    }
}

Set-Content -LiteralPath $configPath -Value $out -Encoding UTF8
