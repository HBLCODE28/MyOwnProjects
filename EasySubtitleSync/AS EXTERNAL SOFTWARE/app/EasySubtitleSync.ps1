$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Helper = Join-Path $AppDir "easy_sub_sync_lite.exe"
$RuntimeFfmpegDir = Join-Path (Split-Path -Parent $AppDir) "runtime\ffmpeg"
$GeneratedDir = Join-Path $env:LOCALAPPDATA "EasySubtitleSync\Synced"
$StateDir = Join-Path $env:LOCALAPPDATA "EasySubtitleSync\State"
New-Item -ItemType Directory -Force -Path $GeneratedDir, $StateDir | Out-Null

$script:ActiveProcess = $null
$script:ActiveContext = $null
$script:StartedAt = $null
$script:TimeoutMinutes = 15

function New-Font([float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
    return New-Object System.Drawing.Font("Segoe UI", $size, $style)
}

function Set-Status([string]$title, [string]$message, [string]$kind = "normal") {
    $statusTitle.Text = $title
    $statusMessage.Text = $message
    switch ($kind) {
        "success" {
            $statusPanel.BackColor = [System.Drawing.Color]::FromArgb(232,247,238)
            $statusTitle.ForeColor = [System.Drawing.Color]::FromArgb(25,108,58)
        }
        "error" {
            $statusPanel.BackColor = [System.Drawing.Color]::FromArgb(255,238,238)
            $statusTitle.ForeColor = [System.Drawing.Color]::FromArgb(155,28,28)
        }
        "working" {
            $statusPanel.BackColor = [System.Drawing.Color]::FromArgb(235,244,255)
            $statusTitle.ForeColor = [System.Drawing.Color]::FromArgb(22,78,138)
        }
        default {
            $statusPanel.BackColor = [System.Drawing.Color]::FromArgb(242,245,248)
            $statusTitle.ForeColor = [System.Drawing.Color]::FromArgb(36,48,65)
        }
    }
}

function Find-VLC {
    $candidates = New-Object System.Collections.Generic.List[string]
    try {
        $p = (Get-ItemProperty "HKLM:\SOFTWARE\VideoLAN\VLC" -ErrorAction SilentlyContinue).InstallDir
        if ($p) { $candidates.Add((Join-Path $p "vlc.exe")) }
    } catch {}
    try {
        $p = (Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\VideoLAN\VLC" -ErrorAction SilentlyContinue).InstallDir
        if ($p) { $candidates.Add((Join-Path $p "vlc.exe")) }
    } catch {}
    if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles "VideoLAN\VLC\vlc.exe")) }
    if (${env:ProgramFiles(x86)}) { $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "VideoLAN\VLC\vlc.exe")) }
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    return $null
}

function Quote-Arg([string]$s) {
    if ($null -eq $s) { return '""' }
    return '"' + ($s -replace '(\\*)"','$1$1\"' -replace '(\\+)$','$1$1') + '"'
}

function Read-Result([string]$path) {
    $r = @{}
    if (-not (Test-Path -LiteralPath $path)) { return $r }
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
        $i = $line.IndexOf('=')
        if ($i -gt 0) {
            $r[$line.Substring(0,$i)] = $line.Substring($i+1)
        }
    }
    return $r
}

function Auto-Subtitle([string]$media) {
    if (-not $media) { return "" }
    $dir = Split-Path -Parent $media
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($media)
    $best = Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension.ToLowerInvariant() -in @('.srt','.vtt','.ass') } |
        ForEach-Object {
            $b = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
            $score = 10
            if ($b -ieq $stem) { $score = 100 }
            elseif ($b.StartsWith($stem + '.', [System.StringComparison]::OrdinalIgnoreCase) -or
                    $b.StartsWith($stem + '-', [System.StringComparison]::OrdinalIgnoreCase) -or
                    $b.StartsWith($stem + '_', [System.StringComparison]::OrdinalIgnoreCase)) { $score = 90 }
            elseif ($b.IndexOf($stem, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $score = 70 }
            if ($_.Extension -ieq '.srt') { $score += 5 }
            [pscustomobject]@{ Path=$_.FullName; Score=$score }
        } |
        Sort-Object Score -Descending |
        Select-Object -First 1
    if ($best) { return $best.Path }
    return ""
}

function Select-Video {
    $d = New-Object System.Windows.Forms.OpenFileDialog
    $d.Title = "Choose a video file"
    $d.Filter = "Video files|*.mp4;*.mkv;*.avi;*.mov;*.m4v;*.webm;*.ts;*.m2ts|All files|*.*"
    if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $videoBox.Text = $d.FileName
        $auto = Auto-Subtitle $d.FileName
        if ($auto) { $subtitleBox.Text = $auto }
        Set-Status "READY" "Video selected. Choose a subtitle file or use the automatically detected one."
    }
}

function Select-Subtitle {
    $d = New-Object System.Windows.Forms.OpenFileDialog
    $d.Title = "Choose subtitles"
    $d.Filter = "Subtitle files|*.srt;*.vtt;*.ass|All files|*.*"
    if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $subtitleBox.Text = $d.FileName
    }
}

function Launch-VLC([string]$media, [string]$sub) {
    $vlc = Find-VLC
    if (-not $vlc) { throw "VLC was not found. VLC is required to open the synchronized result." }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $vlc
    $psi.UseShellExecute = $true
    $psi.Arguments = (Quote-Arg ("--sub-file=" + $sub)) + " " + (Quote-Arg $media)
    [void][System.Diagnostics.Process]::Start($psi)
}

function Finish-Sync([int]$exitCode) {
    $syncTimer.Stop()
    $progress.Visible = $false
    $syncButton.Enabled = $true
    $cancelButton.Visible = $false

    $ctx = $script:ActiveContext
    $script:ActiveContext = $null
    if ($script:ActiveProcess) {
        try { $script:ActiveProcess.Dispose() } catch {}
        $script:ActiveProcess = $null
    }

    if (-not $ctx) {
        Set-Status "SYNC FAILED" "The synchronization process ended without a valid context." "error"
        return
    }

    $r = Read-Result $ctx.ResultPath
    $detailsParts = New-Object System.Collections.Generic.List[string]
    $detailsParts.Add("Helper exit code: $exitCode")
    $detailsParts.Add("Video: $($ctx.Media)")
    $detailsParts.Add("Subtitles: $($ctx.Subtitle)")

    if (Test-Path -LiteralPath $ctx.ResultPath) {
        $detailsParts.Add("")
        $detailsParts.Add("Result:")
        $detailsParts.Add([System.IO.File]::ReadAllText($ctx.ResultPath))
    }
    if (Test-Path -LiteralPath ($ctx.ResultPath + ".json")) {
        $detailsParts.Add("")
        $detailsParts.Add("Diagnostic JSON:")
        $detailsParts.Add([System.IO.File]::ReadAllText($ctx.ResultPath + ".json"))
    }
    $detailsBox.Text = ($detailsParts -join "`r`n").Trim()

    if ($r['status'] -eq 'ok' -and (Test-Path -LiteralPath $ctx.Synced)) {
        [double]$off = 0
        [void][double]::TryParse(
            $r['offset'],
            [System.Globalization.NumberStyles]::Float,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$off
        )
        $resultValue.Text = $off.ToString("+0.00;-0.00;0.00", [System.Globalization.CultureInfo]::InvariantCulture) + " s"
        $resultDetail.Text = "Matches: " + $r['matches'] + "    Confidence: " + $r['confidence'] + "    Corrected subtitles created."
        $resultPanel.Visible = $true
        Set-Status "SYNC COMPLETE" $r['message'] "success"
        try {
            Launch-VLC $ctx.Media $ctx.Synced
        } catch {
            Set-Status "SYNC COMPLETE - VLC NOT OPENED" ($r['message'] + " " + $_.Exception.Message) "success"
        }
    } else {
        $msg = $r['message']
        if (-not $msg) {
            if ($exitCode -ne 0) {
                $msg = "The helper stopped with exit code $exitCode. Scroll to Details for the diagnostic result."
            } else {
                $msg = "The helper did not return a usable synchronization result. Scroll to Details for diagnostics."
            }
        }
        Set-Status "AUTOMATIC SYNC COULD NOT FINISH" $msg "error"
        $resultPanel.Visible = $false
    }
}

function Start-SyncProcess([string]$media, [string]$sub, [string]$resultPath, [string]$synced) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Helper
    $psi.WorkingDirectory = $AppDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    if (Test-Path -LiteralPath $RuntimeFfmpegDir) {
        $psi.EnvironmentVariables["PATH"] = $RuntimeFfmpegDir + ";" + $env:PATH
    }
    $psi.Arguments = "--media " + (Quote-Arg $media) +
                     " --subtitle " + (Quote-Arg $sub) +
                     " --seconds 300 --out " + (Quote-Arg $resultPath) +
                     " --synced " + (Quote-Arg $synced)

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    if (-not $p.Start()) {
        $p.Dispose()
        throw "The synchronization helper could not be started."
    }

    $script:ActiveProcess = $p
    $script:ActiveContext = [pscustomobject]@{
        Media = $media
        Subtitle = $sub
        ResultPath = $resultPath
        Synced = $synced
    }
    $script:StartedAt = [DateTime]::UtcNow
    $syncTimer.Start()
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Easy Subtitle Sync for VLC"
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(760,700)
$form.MinimumSize = New-Object System.Drawing.Size(640,500)
$form.BackColor = [System.Drawing.Color]::FromArgb(246,248,251)
$form.AllowDrop = $true
$form.TopMost = $true

$scroll = New-Object System.Windows.Forms.Panel
$scroll.Dock = "Fill"
$scroll.AutoScroll = $true
$scroll.AutoScrollMinSize = New-Object System.Drawing.Size(700,940)
$form.Controls.Add($scroll)

$content = New-Object System.Windows.Forms.Panel
$content.Location = New-Object System.Drawing.Point(0,0)
$content.Size = New-Object System.Drawing.Size(700,930)
$content.BackColor = $form.BackColor
$scroll.Controls.Add($content)

$header = New-Object System.Windows.Forms.Panel
$header.Location = New-Object System.Drawing.Point(20,18)
$header.Size = New-Object System.Drawing.Size(660,120)
$header.BackColor = [System.Drawing.Color]::FromArgb(22,28,40)
$content.Controls.Add($header)

$badge = New-Object System.Windows.Forms.Label
$badge.Text = "S"
$badge.TextAlign = "MiddleCenter"
$badge.Font = New-Font 24 ([System.Drawing.FontStyle]::Bold)
$badge.ForeColor = [System.Drawing.Color]::White
$badge.BackColor = [System.Drawing.Color]::FromArgb(60,112,245)
$badge.Location = New-Object System.Drawing.Point(20,24)
$badge.Size = New-Object System.Drawing.Size(62,62)
$header.Controls.Add($badge)

$title = New-Object System.Windows.Forms.Label
$title.Text = "Easy Subtitle Sync"
$title.Font = New-Font 22 ([System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::White
$title.Location = New-Object System.Drawing.Point(102,18)
$title.Size = New-Object System.Drawing.Size(390,38)
$header.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "Automatic subtitle timing for VLC"
$subtitle.Font = New-Font 10
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(195,205,222)
$subtitle.Location = New-Object System.Drawing.Point(104,59)
$subtitle.Size = New-Object System.Drawing.Size(360,24)
$header.Controls.Add($subtitle)

$keepOnTop = New-Object System.Windows.Forms.CheckBox
$keepOnTop.Text = "Keep above VLC"
$keepOnTop.Checked = $true
$keepOnTop.ForeColor = [System.Drawing.Color]::White
$keepOnTop.BackColor = $header.BackColor
$keepOnTop.Font = New-Font 9
$keepOnTop.Location = New-Object System.Drawing.Point(500,28)
$keepOnTop.Size = New-Object System.Drawing.Size(145,28)
$keepOnTop.Add_CheckedChanged({ $form.TopMost = $keepOnTop.Checked })
$header.Controls.Add($keepOnTop)

$headerInfo = New-Object System.Windows.Forms.Label
$headerInfo.Text = "Visible desktop companion - not hidden inside VLC's View menu."
$headerInfo.Font = New-Font 9
$headerInfo.ForeColor = [System.Drawing.Color]::FromArgb(165,178,198)
$headerInfo.Location = New-Object System.Drawing.Point(104,86)
$headerInfo.Size = New-Object System.Drawing.Size(500,22)
$header.Controls.Add($headerInfo)

$videoLabel = New-Object System.Windows.Forms.Label
$videoLabel.Text = "1. VIDEO"
$videoLabel.Font = New-Font 10 ([System.Drawing.FontStyle]::Bold)
$videoLabel.ForeColor = [System.Drawing.Color]::FromArgb(65,75,90)
$videoLabel.Location = New-Object System.Drawing.Point(26,162)
$videoLabel.Size = New-Object System.Drawing.Size(150,22)
$content.Controls.Add($videoLabel)

$videoBox = New-Object System.Windows.Forms.TextBox
$videoBox.Location = New-Object System.Drawing.Point(26,188)
$videoBox.Size = New-Object System.Drawing.Size(510,32)
$videoBox.Font = New-Font 10
$content.Controls.Add($videoBox)

$videoBrowse = New-Object System.Windows.Forms.Button
$videoBrowse.Text = "Browse"
$videoBrowse.Location = New-Object System.Drawing.Point(546,186)
$videoBrowse.Size = New-Object System.Drawing.Size(124,36)
$videoBrowse.FlatStyle = "Flat"
$videoBrowse.BackColor = [System.Drawing.Color]::White
$videoBrowse.Add_Click({ Select-Video })
$content.Controls.Add($videoBrowse)

$subLabel = New-Object System.Windows.Forms.Label
$subLabel.Text = "2. SUBTITLES"
$subLabel.Font = New-Font 10 ([System.Drawing.FontStyle]::Bold)
$subLabel.ForeColor = [System.Drawing.Color]::FromArgb(65,75,90)
$subLabel.Location = New-Object System.Drawing.Point(26,242)
$subLabel.Size = New-Object System.Drawing.Size(150,22)
$content.Controls.Add($subLabel)

$subtitleBox = New-Object System.Windows.Forms.TextBox
$subtitleBox.Location = New-Object System.Drawing.Point(26,268)
$subtitleBox.Size = New-Object System.Drawing.Size(510,32)
$subtitleBox.Font = New-Font 10
$content.Controls.Add($subtitleBox)

$subBrowse = New-Object System.Windows.Forms.Button
$subBrowse.Text = "Browse"
$subBrowse.Location = New-Object System.Drawing.Point(546,266)
$subBrowse.Size = New-Object System.Drawing.Size(124,36)
$subBrowse.FlatStyle = "Flat"
$subBrowse.BackColor = [System.Drawing.Color]::White
$subBrowse.Add_Click({ Select-Subtitle })
$content.Controls.Add($subBrowse)

$hint = New-Object System.Windows.Forms.Label
$hint.Text = "You can leave the subtitle field empty. The app will look for .srt, .vtt, or .ass next to the video. You can also drag files into this window."
$hint.Font = New-Font 9
$hint.ForeColor = [System.Drawing.Color]::FromArgb(100,110,125)
$hint.Location = New-Object System.Drawing.Point(28,309)
$hint.Size = New-Object System.Drawing.Size(640,46)
$content.Controls.Add($hint)

$syncButton = New-Object System.Windows.Forms.Button
$syncButton.Text = "AUTO SYNC AND OPEN IN VLC"
$syncButton.Font = New-Font 13 ([System.Drawing.FontStyle]::Bold)
$syncButton.ForeColor = [System.Drawing.Color]::White
$syncButton.BackColor = [System.Drawing.Color]::FromArgb(60,112,245)
$syncButton.FlatStyle = "Flat"
$syncButton.FlatAppearance.BorderSize = 0
$syncButton.Location = New-Object System.Drawing.Point(26,370)
$syncButton.Size = New-Object System.Drawing.Size(510,58)
$content.Controls.Add($syncButton)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = "Cancel"
$cancelButton.Font = New-Font 10 ([System.Drawing.FontStyle]::Bold)
$cancelButton.ForeColor = [System.Drawing.Color]::FromArgb(70,78,92)
$cancelButton.BackColor = [System.Drawing.Color]::White
$cancelButton.FlatStyle = "Flat"
$cancelButton.Location = New-Object System.Drawing.Point(546,370)
$cancelButton.Size = New-Object System.Drawing.Size(124,58)
$cancelButton.Visible = $false
$content.Controls.Add($cancelButton)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(26,438)
$progress.Size = New-Object System.Drawing.Size(644,7)
$progress.Style = "Marquee"
$progress.MarqueeAnimationSpeed = 25
$progress.Visible = $false
$content.Controls.Add($progress)

$statusPanel = New-Object System.Windows.Forms.Panel
$statusPanel.Location = New-Object System.Drawing.Point(26,466)
$statusPanel.Size = New-Object System.Drawing.Size(644,116)
$statusPanel.BackColor = [System.Drawing.Color]::FromArgb(242,245,248)
$content.Controls.Add($statusPanel)

$statusTitle = New-Object System.Windows.Forms.Label
$statusTitle.Text = "READY"
$statusTitle.Font = New-Font 11 ([System.Drawing.FontStyle]::Bold)
$statusTitle.ForeColor = [System.Drawing.Color]::FromArgb(36,48,65)
$statusTitle.Location = New-Object System.Drawing.Point(18,16)
$statusTitle.Size = New-Object System.Drawing.Size(600,24)
$statusPanel.Controls.Add($statusTitle)

$statusMessage = New-Object System.Windows.Forms.Label
$statusMessage.Text = "Choose a video and subtitles, then press Auto Sync. The helper runs invisibly without a CMD window."
$statusMessage.Font = New-Font 10
$statusMessage.ForeColor = [System.Drawing.Color]::FromArgb(65,75,90)
$statusMessage.Location = New-Object System.Drawing.Point(18,46)
$statusMessage.Size = New-Object System.Drawing.Size(600,58)
$statusPanel.Controls.Add($statusMessage)

$resultPanel = New-Object System.Windows.Forms.Panel
$resultPanel.Location = New-Object System.Drawing.Point(26,602)
$resultPanel.Size = New-Object System.Drawing.Size(644,92)
$resultPanel.BackColor = [System.Drawing.Color]::FromArgb(22,28,40)
$resultPanel.Visible = $false
$content.Controls.Add($resultPanel)

$resultTitle = New-Object System.Windows.Forms.Label
$resultTitle.Text = "CURRENT RESULT"
$resultTitle.Font = New-Font 9 ([System.Drawing.FontStyle]::Bold)
$resultTitle.ForeColor = [System.Drawing.Color]::FromArgb(185,195,212)
$resultTitle.Location = New-Object System.Drawing.Point(18,13)
$resultTitle.Size = New-Object System.Drawing.Size(220,22)
$resultPanel.Controls.Add($resultTitle)

$resultValue = New-Object System.Windows.Forms.Label
$resultValue.Text = "+0.00 s"
$resultValue.TextAlign = "MiddleRight"
$resultValue.Font = New-Font 22 ([System.Drawing.FontStyle]::Bold)
$resultValue.ForeColor = [System.Drawing.Color]::White
$resultValue.Location = New-Object System.Drawing.Point(400,10)
$resultValue.Size = New-Object System.Drawing.Size(220,40)
$resultPanel.Controls.Add($resultValue)

$resultDetail = New-Object System.Windows.Forms.Label
$resultDetail.Text = ""
$resultDetail.Font = New-Font 9
$resultDetail.ForeColor = [System.Drawing.Color]::FromArgb(195,205,222)
$resultDetail.Location = New-Object System.Drawing.Point(18,51)
$resultDetail.Size = New-Object System.Drawing.Size(600,28)
$resultPanel.Controls.Add($resultDetail)

$detailsLabel = New-Object System.Windows.Forms.Label
$detailsLabel.Text = "DETAILS"
$detailsLabel.Font = New-Font 9 ([System.Drawing.FontStyle]::Bold)
$detailsLabel.ForeColor = [System.Drawing.Color]::FromArgb(90,100,115)
$detailsLabel.Location = New-Object System.Drawing.Point(26,720)
$detailsLabel.Size = New-Object System.Drawing.Size(120,22)
$content.Controls.Add($detailsLabel)

$detailsBox = New-Object System.Windows.Forms.TextBox
$detailsBox.Location = New-Object System.Drawing.Point(26,745)
$detailsBox.Size = New-Object System.Drawing.Size(644,150)
$detailsBox.Multiline = $true
$detailsBox.ScrollBars = "Vertical"
$detailsBox.ReadOnly = $true
$detailsBox.Font = New-Font 9
$detailsBox.BackColor = [System.Drawing.Color]::White
$content.Controls.Add($detailsBox)

$syncTimer = New-Object System.Windows.Forms.Timer
$syncTimer.Interval = 250
$syncTimer.Add_Tick({
    if (-not $script:ActiveProcess) {
        $syncTimer.Stop()
        return
    }

    try {
        if ($script:ActiveProcess.HasExited) {
            $exitCode = $script:ActiveProcess.ExitCode
            Finish-Sync $exitCode
            return
        }

        if ($script:StartedAt -and (([DateTime]::UtcNow - $script:StartedAt).TotalMinutes -gt $script:TimeoutMinutes)) {
            try { $script:ActiveProcess.Kill() } catch {}
            Set-Status "SYNC TIMED OUT" "Automatic synchronization exceeded 15 minutes and was stopped." "error"
            $detailsBox.Text = "The helper exceeded the 15 minute safety timeout. Try a shorter or simpler video file."
            $progress.Visible = $false
            $syncButton.Enabled = $true
            $cancelButton.Visible = $false
            $syncTimer.Stop()
            try { $script:ActiveProcess.Dispose() } catch {}
            $script:ActiveProcess = $null
            $script:ActiveContext = $null
        }
    } catch {
        $syncTimer.Stop()
        $progress.Visible = $false
        $syncButton.Enabled = $true
        $cancelButton.Visible = $false
        Set-Status "SYNC FAILED" $_.Exception.Message "error"
        $detailsBox.Text = $_.Exception.ToString()
        try { if ($script:ActiveProcess) { $script:ActiveProcess.Dispose() } } catch {}
        $script:ActiveProcess = $null
        $script:ActiveContext = $null
    }
})

$syncButton.Add_Click({
    if ($script:ActiveProcess -and -not $script:ActiveProcess.HasExited) { return }

    $media = $videoBox.Text.Trim()
    if (-not $media -or -not (Test-Path -LiteralPath $media)) {
        Set-Status "VIDEO REQUIRED" "Choose a local video file first." "error"
        return
    }

    $sub = $subtitleBox.Text.Trim()
    if (-not $sub) {
        $sub = Auto-Subtitle $media
        if ($sub) { $subtitleBox.Text = $sub }
    }
    if (-not $sub -or -not (Test-Path -LiteralPath $sub)) {
        Set-Status "SUBTITLES REQUIRED" "No subtitle file was found. Choose an .srt, .vtt, or .ass file." "error"
        return
    }
    if (-not (Test-Path -LiteralPath $Helper)) {
        Set-Status "INSTALLATION ERROR" "The local synchronization helper is missing. Re-run INSTALL.bat." "error"
        return
    }

    $ext = [System.IO.Path]::GetExtension($sub)
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($media)
    $safe = ($stem -replace '[\\/:*?"<>|]','_')
    $synced = Join-Path $GeneratedDir ($safe + ".easy-synced" + $ext)
    $resultPath = Join-Path $StateDir "last_result.txt"
    Remove-Item -Force -ErrorAction SilentlyContinue $resultPath, ($resultPath + ".json")

    $resultPanel.Visible = $false
    $detailsBox.Clear()
    $progress.Visible = $true
    $syncButton.Enabled = $false
    $cancelButton.Visible = $true
    Set-Status "ANALYZING" "Checking the first five minutes for stable speech/sound starts and comparing them with subtitle start times." "working"

    try {
        Start-SyncProcess $media $sub $resultPath $synced
    } catch {
        $progress.Visible = $false
        $syncButton.Enabled = $true
        $cancelButton.Visible = $false
        Set-Status "SYNC FAILED" $_.Exception.Message "error"
        $detailsBox.Text = $_.Exception.ToString()
    }
})

$cancelButton.Add_Click({
    if ($script:ActiveProcess -and -not $script:ActiveProcess.HasExited) {
        try { $script:ActiveProcess.Kill() } catch {}
    }
    $syncTimer.Stop()
    $progress.Visible = $false
    $syncButton.Enabled = $true
    $cancelButton.Visible = $false
    Set-Status "CANCELLED" "Automatic synchronization was cancelled." "normal"
    try { if ($script:ActiveProcess) { $script:ActiveProcess.Dispose() } } catch {}
    $script:ActiveProcess = $null
    $script:ActiveContext = $null
})

$form.Add_DragEnter({
    param($sender,$e)
    if ($e.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
        $e.Effect = [System.Windows.Forms.DragDropEffects]::Copy
    }
})

$form.Add_DragDrop({
    param($sender,$e)
    $files = $e.Data.GetData([System.Windows.Forms.DataFormats]::FileDrop)
    foreach ($f in $files) {
        $ext = [System.IO.Path]::GetExtension($f).ToLowerInvariant()
        if ($ext -in @('.srt','.vtt','.ass')) {
            $subtitleBox.Text = $f
        } elseif (-not $videoBox.Text) {
            $videoBox.Text = $f
            $auto = Auto-Subtitle $f
            if ($auto) { $subtitleBox.Text = $auto }
        }
    }
    Set-Status "READY" "Files added by drag and drop."
})

$form.Add_FormClosing({
    if ($script:ActiveProcess -and -not $script:ActiveProcess.HasExited) {
        try { $script:ActiveProcess.Kill() } catch {}
    }
})

[void]$form.ShowDialog()
