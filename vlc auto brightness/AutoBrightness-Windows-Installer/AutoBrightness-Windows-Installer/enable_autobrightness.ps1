$ErrorActionPreference = 'Stop'
$configDir = Join-Path $env:APPDATA 'vlc'
$configPath = Join-Path $configDir 'vlcrc'

New-Item -ItemType Directory -Path $configDir -Force | Out-Null

if (Test-Path $configPath) {
    $backup = "$configPath.autobrightness-backup"
    Copy-Item $configPath $backup -Force
    $lines = @(Get-Content -LiteralPath $configPath)
} else {
    $lines = @()
}

$found = $false
$out = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
    if ($line -match '^video-filter=(.*)$') {
        $found = $true
        $parts = @($Matches[1] -split ':' | Where-Object { $_ -and $_ -ne 'autobrightness' })
        $parts += 'autobrightness'
        $out.Add('video-filter=' + ($parts -join ':'))
    }
    elseif ($line -match '^#video-filter=') {
        if (-not $found) {
            $found = $true
            $out.Add('video-filter=autobrightness')
        } else {
            $out.Add($line)
        }
    }
    else {
        $out.Add($line)
    }
}

if (-not $found) {
    $out.Add('video-filter=autobrightness')
}

Set-Content -LiteralPath $configPath -Value $out -Encoding UTF8
