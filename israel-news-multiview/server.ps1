param(
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::DefaultConnectionLimit = 16
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$N12ResolverUrl = "https://www.n12.co.il/AjaxPage?consumer=web_html5&encryption=no&galleryChannelId=1e2258089b67f510VgnVCM2000002a0c10acRCRD&isGallery=false&jspName=playlist.jsp&vcmid=1e2258089b67f510VgnVCM2000002a0c10acRCRD&videoChannelId=31750a2610f26110VgnVCM1000005201000aRCRD"
$Mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
}

function Write-HttpResponse {
    param(
        $Stream,
        [int]$Status,
        [string]$StatusText,
        [string]$ContentType,
        [byte[]]$Body,
        [hashtable]$ExtraHeaders = @{}
    )

    if ($null -eq $Body) { $Body = [byte[]]@() }
    $headers = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n"
    foreach ($key in $ExtraHeaders.Keys) {
        $headers += "$key`: $($ExtraHeaders[$key])`r`n"
    }
    $headers += "`r`n"

    $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
    $Stream.Flush()
}

function Parse-QueryString {
    param([string]$Query)
    $result = @{}
    if ([string]::IsNullOrWhiteSpace($Query)) { return $result }
    foreach ($pair in $Query.TrimStart("?").Split("&")) {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $parts = $pair.Split("=", 2)
        $key = [Uri]::UnescapeDataString($parts[0].Replace("+", " "))
        $value = if ($parts.Length -gt 1) { [Uri]::UnescapeDataString($parts[1].Replace("+", " ")) } else { "" }
        $result[$key] = $value
    }
    return $result
}

function Convert-ToProxyUrl {
    param([Uri]$BaseUri, [string]$Value, [string]$Profile)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $Value }
    try {
        $absolute = [Uri]::new($BaseUri, $Value)
        $encoded = [Uri]::EscapeDataString($absolute.AbsoluteUri)
        $encodedProfile = [Uri]::EscapeDataString($Profile)
        return "/proxy?p=$encodedProfile&url=$encoded"
    } catch {
        return $Value
    }
}

function Rewrite-HlsPlaylist {
    param([string]$Text, [Uri]$BaseUri, [string]$Profile)
    $lines = $Text -split "`r?`n"
    $output = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed)) {
            $output.Add($line)
            continue
        }

        if ($trimmed.StartsWith("#")) {
            $rewritten = [regex]::Replace($line, 'URI="([^"]+)"', {
                param($match)
                $proxied = Convert-ToProxyUrl $BaseUri $match.Groups[1].Value $Profile
                return 'URI="' + $proxied + '"'
            })
            $output.Add($rewritten)
            continue
        }

        $output.Add((Convert-ToProxyUrl $BaseUri $trimmed $Profile))
    }

    return [string]::Join("`n", $output)
}

function Get-RemoteContent {
    param(
        [string]$Url,
        [string]$Profile,
        [hashtable]$IncomingHeaders
    )

    $uri = [Uri]$Url
    if ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https") {
        throw "Only HTTP and HTTPS proxy targets are allowed."
    }

    $request = [System.Net.HttpWebRequest]::Create($uri)
    $request.Method = "GET"
    $request.AllowAutoRedirect = $true
    $request.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
    $request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    $request.Accept = "*/*"
    $request.Timeout = 18000
    $request.ReadWriteTimeout = 18000

    if ($Profile -eq "n12") {
        $request.Referer = "https://www.n12.co.il/"
        $request.Headers["Origin"] = "https://www.n12.co.il"
        $request.Headers["Accept-Language"] = "he-IL,he;q=0.9,en;q=0.7"
    } elseif ($Profile -eq "mako12") {
        $request.Referer = "https://www.mako.co.il/"
        $request.Headers["Origin"] = "https://www.mako.co.il"
        $request.Headers["Accept-Language"] = "he-IL,he;q=0.9,en;q=0.7"
    }

    if ($IncomingHeaders.ContainsKey("Range") -and -not [string]::IsNullOrWhiteSpace($IncomingHeaders["Range"])) {
        $range = $IncomingHeaders["Range"]
        if ($range -match '^bytes=(\d+)-(\d*)$') {
            $from = [Int64]$Matches[1]
            if ([string]::IsNullOrWhiteSpace($Matches[2])) {
                $request.AddRange($from)
            } else {
                $request.AddRange($from, [Int64]$Matches[2])
            }
        }
    }

    try {
        $response = [System.Net.HttpWebResponse]$request.GetResponse()
    } catch [System.Net.WebException] {
        if ($null -eq $_.Exception.Response) { throw }
        $response = [System.Net.HttpWebResponse]$_.Exception.Response
    }

    try {
        $memory = New-Object IO.MemoryStream
        $response.GetResponseStream().CopyTo($memory)
        $bytes = $memory.ToArray()
        $contentType = $response.ContentType
        if ([string]::IsNullOrWhiteSpace($contentType)) { $contentType = "application/octet-stream" }

        $isPlaylist = $contentType.ToLowerInvariant().Contains("mpegurl") -or $uri.AbsolutePath.ToLowerInvariant().EndsWith(".m3u8")
        if ($isPlaylist) {
            $text = [Text.Encoding]::UTF8.GetString($bytes)
            $rewritten = Rewrite-HlsPlaylist $text $response.ResponseUri $Profile
            $bytes = [Text.Encoding]::UTF8.GetBytes($rewritten)
            $contentType = "application/vnd.apple.mpegurl; charset=utf-8"
        }

        return @{
            Status = [int]$response.StatusCode
            StatusText = $response.StatusDescription
            ContentType = $contentType
            Body = $bytes
        }
    }
    finally {
        $response.Close()
    }
}

function Get-N12LiveContent {
    param([hashtable]$IncomingHeaders)

    $meta = Get-RemoteContent $N12ResolverUrl "n12" @{}
    if ($meta.Status -lt 200 -or $meta.Status -ge 300) {
        throw "N12 resolver returned HTTP $($meta.Status)."
    }

    $jsonText = [Text.Encoding]::UTF8.GetString($meta.Body)
    $data = $jsonText | ConvertFrom-Json
    $urls = @()
    if ($null -ne $data.media) {
        foreach ($item in $data.media) {
            if ($null -ne $item.url -and -not [string]::IsNullOrWhiteSpace([string]$item.url)) {
                $urls += [string]$item.url
            }
        }
    }

    if ($urls.Count -eq 0) {
        throw "N12 did not publish any live HLS source."
    }

    $lastError = $null
    foreach ($url in $urls) {
        foreach ($profile in @("n12", "mako12")) {
            try {
                $remote = Get-RemoteContent $url $profile $IncomingHeaders
                if ($remote.Status -ge 200 -and $remote.Status -lt 300) {
                    return $remote
                }
                $lastError = "$profile HTTP $($remote.Status)"
            } catch {
                $lastError = "${profile}: $($_.Exception.Message)"
            }
        }
    }

    throw "All N12 live sources failed. Last error: $lastError"
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host ""
Write-Host "Israel News Multiview" -ForegroundColor Cyan
Write-Host "Running at http://127.0.0.1:$Port/"
Write-Host "Close this window or press Ctrl+C to stop."
Write-Host ""

Start-Process "http://127.0.0.1:$Port/"

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 8192, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

            $requestHeaders = @{}
            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line -or $line -eq "") { break }
                $separator = $line.IndexOf(":")
                if ($separator -gt 0) {
                    $name = $line.Substring(0, $separator).Trim()
                    $value = $line.Substring($separator + 1).Trim()
                    $requestHeaders[$name] = $value
                }
            }

            $parts = $requestLine.Split(" ")
            if ($parts.Length -lt 2 -or $parts[0] -ne "GET") {
                $body = [Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
                Write-HttpResponse $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" $body
                continue
            }

            $requestTarget = $parts[1]
            $question = $requestTarget.IndexOf("?")
            $rawPath = if ($question -ge 0) { $requestTarget.Substring(0, $question) } else { $requestTarget }
            $rawQuery = if ($question -ge 0) { $requestTarget.Substring($question + 1) } else { "" }

            if ($rawPath -eq "/n12/live.m3u8") {
                try {
                    $remote = Get-N12LiveContent $requestHeaders
                    Write-HttpResponse $stream $remote.Status $remote.StatusText $remote.ContentType $remote.Body @{ "Access-Control-Allow-Origin" = "*" }
                } catch {
                    $body = [Text.Encoding]::UTF8.GetBytes("N12 Resolver Error: " + $_.Exception.Message)
                    Write-HttpResponse $stream 502 "Bad Gateway" "text/plain; charset=utf-8" $body @{ "Access-Control-Allow-Origin" = "*" }
                }
                continue
            }

            if ($rawPath -eq "/proxy") {
                $query = Parse-QueryString $rawQuery
                if (-not $query.ContainsKey("url") -or [string]::IsNullOrWhiteSpace($query["url"])) {
                    $body = [Text.Encoding]::UTF8.GetBytes("Missing proxy url")
                    Write-HttpResponse $stream 400 "Bad Request" "text/plain; charset=utf-8" $body
                    continue
                }

                $profile = if ($query.ContainsKey("p")) { $query["p"] } else { "default" }
                try {
                    $remote = Get-RemoteContent $query["url"] $profile $requestHeaders
                    Write-HttpResponse $stream $remote.Status $remote.StatusText $remote.ContentType $remote.Body @{ "Access-Control-Allow-Origin" = "*" }
                } catch {
                    $body = [Text.Encoding]::UTF8.GetBytes("Proxy Error: " + $_.Exception.Message)
                    Write-HttpResponse $stream 502 "Bad Gateway" "text/plain; charset=utf-8" $body @{ "Access-Control-Allow-Origin" = "*" }
                }
                continue
            }

            $decoded = [Uri]::UnescapeDataString($rawPath).TrimStart("/")
            if ([string]::IsNullOrWhiteSpace($decoded)) { $decoded = "index.html" }

            $candidate = [IO.Path]::GetFullPath((Join-Path $Root $decoded.Replace("/", [IO.Path]::DirectorySeparatorChar)))
            if (-not $candidate.StartsWith([IO.Path]::GetFullPath($Root), [StringComparison]::OrdinalIgnoreCase)) {
                $body = [Text.Encoding]::UTF8.GetBytes("Forbidden")
                Write-HttpResponse $stream 403 "Forbidden" "text/plain; charset=utf-8" $body
                continue
            }

            if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
                $body = [Text.Encoding]::UTF8.GetBytes("Not Found")
                Write-HttpResponse $stream 404 "Not Found" "text/plain; charset=utf-8" $body
                continue
            }

            $bytes = [IO.File]::ReadAllBytes($candidate)
            $ext = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
            $type = if ($Mime.ContainsKey($ext)) { $Mime[$ext] } else { "application/octet-stream" }
            Write-HttpResponse $stream 200 "OK" $type $bytes
        }
        catch {
            try {
                $body = [Text.Encoding]::UTF8.GetBytes("Internal Server Error: " + $_.Exception.Message)
                Write-HttpResponse $stream 500 "Internal Server Error" "text/plain; charset=utf-8" $body
            } catch { }
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
