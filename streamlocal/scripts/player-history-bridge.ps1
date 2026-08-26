param(
    [switch]$Once,
    [ValidateRange(5, 3600)]
    [int]$IntervalSeconds = 5,
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:WinRtMediaControlAvailable = $false
$script:AsTaskGeneric = $null
$script:MediaSessionManager = $null

function Initialize-SystemMediaControl {
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
        $script:AsTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq "AsTask" -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation`1"
        })[0]
        [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
        [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
        $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
        $script:MediaSessionManager = Await-WinRt ($managerType::RequestAsync()) $managerType
        $script:WinRtMediaControlAvailable = $null -ne $script:AsTaskGeneric -and $null -ne $script:MediaSessionManager
    }
    catch {
        $script:WinRtMediaControlAvailable = $false
    }
}

function Await-WinRt {
    param(
        [Parameter(Mandatory = $true)]$Operation,
        [Parameter(Mandatory = $true)][Type]$ResultType
    )
    if (-not $script:AsTaskGeneric) { throw "Windows Runtime async support is unavailable." }
    $asTask = $script:AsTaskGeneric.MakeGenericMethod($ResultType)
    $task = $asTask.Invoke($null, @($Operation))
    $task.Wait(-1) | Out-Null
    return $task.Result
}

function Get-StreamLocalPlayerKind {
    param([string]$SourceAppUserModelId)
    if ([string]::IsNullOrWhiteSpace($SourceAppUserModelId)) { return $null }
    if ($SourceAppUserModelId -match '(?i)(vlc|videolan)') { return 'vlc' }
    if ($SourceAppUserModelId -match '(?i)(zunemusic|media[._ -]?player)') { return 'windows_media_player' }
    return $null
}

function Get-LivePlayerSessions {
    if (-not $script:WinRtMediaControlAvailable) { return @() }

    $propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
    $manager = $script:MediaSessionManager
    if (-not $manager) { return @() }

    $now = (Get-Date).ToUniversalTime().ToString('o')
    $rows = @()
    foreach ($session in @($manager.GetSessions())) {
        try {
            $sourceApp = [string]$session.SourceAppUserModelId
            $source = Get-StreamLocalPlayerKind $sourceApp
            if (-not $source) { continue }

            $properties = Await-WinRt ($session.TryGetMediaPropertiesAsync()) $propertiesType
            if (-not $properties) { continue }
            $title = [string]$properties.Title
            if ([string]::IsNullOrWhiteSpace($title)) { continue }

            $timeline = $session.GetTimelineProperties()
            $playback = $session.GetPlaybackInfo()
            $startSeconds = [double]$timeline.StartTime.TotalSeconds
            $endSeconds = [double]$timeline.EndTime.TotalSeconds
            $positionSeconds = [Math]::Max(0.0, [double]$timeline.Position.TotalSeconds - $startSeconds)
            $durationSeconds = if ($endSeconds -gt $startSeconds) {
                $endSeconds - $startSeconds
            } elseif ([double]$timeline.MaxSeekTime.TotalSeconds -gt $startSeconds) {
                [double]$timeline.MaxSeekTime.TotalSeconds - $startSeconds
            } else {
                0.0
            }

            $rows += [pscustomobject]@{
                source = $source
                sourceAppUserModelId = $sourceApp
                title = $title
                albumTitle = [string]$properties.AlbumTitle
                artist = [string]$properties.Artist
                positionSeconds = [Math]::Round($positionSeconds, 3)
                durationSeconds = [Math]::Round([Math]::Max(0.0, $durationSeconds), 3)
                playbackStatus = [string]$playback.PlaybackStatus
                observedAt = $now
            }
        }
        catch {
            # A single player session can disappear while being queried. Ignore it.
        }
    }
    return $rows
}

function Merge-LivePlayerHistory {
    param(
        [Parameter(Mandatory = $true)][array]$CurrentSessions,
        [Parameter(Mandatory = $true)][string]$HistoryPath
    )

    $existing = @()
    if (Test-Path -LiteralPath $HistoryPath) {
        try {
            $parsed = Get-Content -Raw -LiteralPath $HistoryPath | ConvertFrom-Json
            if ($parsed.records) { $existing = @($parsed.records) }
        }
        catch { $existing = @() }
    }

    $byKey = @{}
    foreach ($row in $existing) {
        $key = ("{0}|{1}|{2}" -f $row.source, $row.sourceAppUserModelId, $row.title).ToLowerInvariant()
        $byKey[$key] = $row
    }

    $now = [DateTimeOffset]::UtcNow
    foreach ($row in $CurrentSessions) {
        $key = ("{0}|{1}|{2}" -f $row.source, $row.sourceAppUserModelId, $row.title).ToLowerInvariant()
        $previous = $byKey[$key]
        $position = [double]$row.positionSeconds
        $duration = [double]$row.durationSeconds
        $firstSeenAt = if ($previous -and $previous.firstSeenAt) { [string]$previous.firstSeenAt } else { [string]$row.observedAt }
        if ($previous) {
            $position = [Math]::Max($position, [double]$previous.positionSeconds)
            $duration = [Math]::Max($duration, [double]$previous.durationSeconds)
        }
        $completed = $false
        if ($previous -and $previous.completed) { $completed = $true }
        if ($duration -gt 0 -and ($position / $duration -ge 0.99 -or $duration - $position -le 2)) { $completed = $true }

        $byKey[$key] = [pscustomobject]@{
            source = [string]$row.source
            sourceAppUserModelId = [string]$row.sourceAppUserModelId
            title = [string]$row.title
            albumTitle = [string]$row.albumTitle
            artist = [string]$row.artist
            positionSeconds = [Math]::Round($position, 3)
            durationSeconds = [Math]::Round($duration, 3)
            playbackStatus = [string]$row.playbackStatus
            firstSeenAt = $firstSeenAt
            lastSeenAt = [string]$row.observedAt
            completed = $completed
        }
    }

    $cutoff = $now.AddDays(-30)
    $records = @($byKey.Values | Where-Object {
        try { [DateTimeOffset]::Parse([string]$_.lastSeenAt) -ge $cutoff } catch { $true }
    } | Sort-Object { [DateTimeOffset]::Parse([string]$_.lastSeenAt) } -Descending | Select-Object -First 100)

    $payload = [ordered]@{
        version = 1
        updatedAt = $now.ToString('o')
        records = $records
    }
    $temp = "$HistoryPath.tmp"
    $payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $temp -Encoding UTF8
    Move-Item -Force -LiteralPath $temp -Destination $HistoryPath
    return $records.Count
}

Initialize-SystemMediaControl

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $Documents = [Environment]::GetFolderPath("MyDocuments")
    $OutputDirectory = Join-Path $Documents "StreamLocal\ExternalPlayerHistory"
}

function Copy-SharedFile {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $temp = "$Destination.tmp"
    $sourceStream = $null
    $destinationStream = $null
    try {
        $share = [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
        $sourceStream = [System.IO.FileStream]::new(
            $Source,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            $share
        )
        $destinationStream = [System.IO.FileStream]::new(
            $temp,
            [System.IO.FileMode]::Create,
            [System.IO.FileAccess]::Write,
            [System.IO.FileShare]::Read
        )
        $sourceStream.CopyTo($destinationStream)
        $destinationStream.Flush($true)
        $destinationStream.Dispose()
        $destinationStream = $null
        $sourceStream.Dispose()
        $sourceStream = $null
        Move-Item -Force -LiteralPath $temp -Destination $Destination
    }
    finally {
        if ($destinationStream) { $destinationStream.Dispose() }
        if ($sourceStream) { $sourceStream.Dispose() }
        if (Test-Path -LiteralPath $temp) { Remove-Item -Force -LiteralPath $temp -ErrorAction SilentlyContinue }
    }
}

function Remove-MirrorIfSourceMissing {
    param([string]$Source, [string]$Destination)
    if (-not (Test-Path -LiteralPath $Source) -and (Test-Path -LiteralPath $Destination)) {
        Remove-Item -Force -LiteralPath $Destination -ErrorAction SilentlyContinue
    }
}

function Find-WindowsMediaPlayerLocalState {
    $exact = Join-Path $env:LOCALAPPDATA "Packages\Microsoft.ZuneMusic_8wekyb3d8bbwe\LocalState"
    if (Test-Path -LiteralPath $exact) { return $exact }

    $packages = Join-Path $env:LOCALAPPDATA "Packages"
    if (-not (Test-Path -LiteralPath $packages)) { return $null }
    $match = Get-ChildItem -LiteralPath $packages -Directory -Filter "Microsoft.ZuneMusic_*" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $match) { return $null }
    $localState = Join-Path $match.FullName "LocalState"
    if (Test-Path -LiteralPath $localState) { return $localState }
    return $null
}

function Sync-PlayerHistory {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

    $status = [ordered]@{
        version = 1
        updatedAt = (Get-Date).ToUniversalTime().ToString("o")
        outputDirectory = $OutputDirectory
        vlc = [ordered]@{ found = $false; copied = $false; error = $null }
        windowsMediaPlayer = [ordered]@{ found = $false; copied = @(); error = $null }
        systemMediaSessions = [ordered]@{ supported = $script:WinRtMediaControlAvailable; detected = 0; error = $null }
    }

    $vlcSource = Join-Path $env:APPDATA "vlc\vlc-qt-interface.ini"
    $vlcDestination = Join-Path $OutputDirectory "vlc-qt-interface.ini"
    if (Test-Path -LiteralPath $vlcSource) {
        $status.vlc.found = $true
        try {
            Copy-SharedFile -Source $vlcSource -Destination $vlcDestination
            $status.vlc.copied = $true
        }
        catch {
            $status.vlc.error = $_.Exception.Message
        }
    }
    else {
        Remove-MirrorIfSourceMissing -Source $vlcSource -Destination $vlcDestination
    }

    $wmpRoot = Find-WindowsMediaPlayerLocalState
    if ($wmpRoot) {
        $status.windowsMediaPlayer.found = $true
        foreach ($name in @("MediaPlayer.db", "MediaPlayer.db-wal", "AppState.json")) {
            $source = Join-Path $wmpRoot $name
            $destination = Join-Path $OutputDirectory $name
            if (Test-Path -LiteralPath $source) {
                try {
                    Copy-SharedFile -Source $source -Destination $destination
                    $status.windowsMediaPlayer.copied += $name
                }
                catch {
                    $status.windowsMediaPlayer.error = $_.Exception.Message
                }
            }
            else {
                Remove-MirrorIfSourceMissing -Source $source -Destination $destination
            }
        }
    }

    $liveHistoryPath = Join-Path $OutputDirectory "live-playback-history.json"
    if ($script:WinRtMediaControlAvailable) {
        try {
            $sessions = @(Get-LivePlayerSessions)
            $status.systemMediaSessions.detected = $sessions.Count
            [void](Merge-LivePlayerHistory -CurrentSessions $sessions -HistoryPath $liveHistoryPath)
        }
        catch {
            $status.systemMediaSessions.error = $_.Exception.Message
        }
    }

    $statusPath = Join-Path $OutputDirectory "bridge-status.json"
    $status | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statusPath -Encoding UTF8
    return $status
}

Write-Host "StreamLocal external player history bridge"
Write-Host "Read-only sources: VLC and Windows Media Player"
Write-Host "Live playback timeline: Windows System Media Transport Controls when supported"
Write-Host "Mirror folder: $OutputDirectory"
Write-Host "Original player files and video files are never modified."
if (-not $Once) {
    Write-Host "Refreshing every $IntervalSeconds seconds. Press Ctrl+C to stop."
}
Write-Host ""

do {
    try {
        $result = Sync-PlayerHistory
        $vlcState = if ($result.vlc.copied) { "VLC copied" } elseif ($result.vlc.found) { "VLC read failed" } else { "VLC not found" }
        $wmpCount = @($result.windowsMediaPlayer.copied).Count
        $wmpState = if ($wmpCount -gt 0) { "Windows Media Player copied ($wmpCount files)" } elseif ($result.windowsMediaPlayer.found) { "Windows Media Player found, no readable history files" } else { "Windows Media Player optional/not found" }
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $vlcState; $wmpState"
    }
    catch {
        Write-Warning $_.Exception.Message
    }

    if ($Once) { break }
    Start-Sleep -Seconds $IntervalSeconds
} while ($true)
