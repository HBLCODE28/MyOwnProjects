param(
    [string]$VlcExe = "C:\Program Files\VideoLAN\VLC\vlc.exe"
)

$ErrorActionPreference = "Stop"
$configDir = Join-Path $env:APPDATA "vlc"
$configPath = Join-Path $configDir "vlcrc"

if (!(Test-Path $configPath)) {
    throw "VLC config was not found at $configPath. Start VLC once, close it, and run this script again."
}

$backup = "$configPath.autobrightness-backup"
Copy-Item $configPath $backup -Force

$lines = Get-Content $configPath
$found = $false
$out = foreach ($line in $lines) {
    if ($line -match '^video-filter=(.*)$') {
        $found = $true
        $current = $Matches[1]
        $parts = @($current -split ':' | Where-Object { $_ -and $_ -ne 'autobrightness' })
        $parts += 'autobrightness'
        'video-filter=' + ($parts -join ':')
    }
    elseif ($line -match '^#video-filter=') {
        if (!$found) {
            $found = $true
            'video-filter=autobrightness'
        } else {
            $line
        }
    }
    else {
        $line
    }
}

if (!$found) {
    $out += 'video-filter=autobrightness'
}

Set-Content -Path $configPath -Value $out -Encoding UTF8

if (Test-Path $VlcExe) {
    & $VlcExe --reset-plugins-cache vlc://quit | Out-Null
}

Write-Host "Auto Brightness enabled in $configPath"
Write-Host "Backup: $backup"
