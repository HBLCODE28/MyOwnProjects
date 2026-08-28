param(
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::DefaultConnectionLimit = 16
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$N12ResolverUrl = "https://www.n12.co.il/AjaxPage?consumer=web_html5&encryption=no&galleryChannelId=1e2258089b67f510VgnVCM2000002a0c10acRCRD&isGallery=false&jspName=playlist.jsp&vcmid=1e2258089b67f510VgnVCM2000002a0c10acRCRD&videoChannelId=31750a2610f26110VgnVCM1000005201000aRCRD"
$KanGuideUrl = "https://www.kan.org.il/tv-guide/?channelId=4444"
$KanGuideFallbackUrl = "https://www.isramedia.net/%D7%9C%D7%95%D7%97-%D7%A9%D7%99%D7%93%D7%95%D7%A8%D7%99%D7%9D/1/%D7%9B%D7%90%D7%9F-11-%D7%9B%D7%90%D7%9F-%D7%A9%D7%99%D7%93%D7%95%D7%A8-%D7%97%D7%99?channelid=1&days=0&days=1"
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


function Get-TextEncodingForHtml {
    param(
        [byte[]]$Bytes,
        [string]$ContentType
    )

    $charset = $null
    if (-not [string]::IsNullOrWhiteSpace($ContentType) -and $ContentType -match '(?i)charset\s*=\s*["'']?\s*([a-z0-9._-]+)') {
        $charset = $Matches[1]
    }

    if ([string]::IsNullOrWhiteSpace($charset) -and $null -ne $Bytes -and $Bytes.Length -gt 0) {
        $sampleLength = [Math]::Min($Bytes.Length, 8192)
        $sample = [Text.Encoding]::ASCII.GetString($Bytes, 0, $sampleLength)
        if ($sample -match '(?i)<meta[^>]+charset\s*=\s*["'']?\s*([a-z0-9._-]+)') {
            $charset = $Matches[1]
        } elseif ($sample -match '(?i)<meta[^>]+content\s*=\s*["''][^"'']*charset\s*=\s*([a-z0-9._-]+)') {
            $charset = $Matches[1]
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($charset)) {
        try { return [Text.Encoding]::GetEncoding($charset) } catch { }
    }

    if ($null -ne $Bytes -and $Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
        return [Text.Encoding]::UTF8
    }

    try {
        $strictUtf8 = New-Object Text.UTF8Encoding($false, $true)
        [void]$strictUtf8.GetString($Bytes)
        return [Text.Encoding]::UTF8
    } catch {
        # Isramedia has historically served Hebrew HTML using a legacy Hebrew code page.
        foreach ($fallback in @('windows-1255', 'iso-8859-8')) {
            try { return [Text.Encoding]::GetEncoding($fallback) } catch { }
        }
        return [Text.Encoding]::Default
    }
}

function Convert-HtmlBytesToUtf8Text {
    param(
        [byte[]]$Bytes,
        [string]$ContentType
    )

    if ($null -eq $Bytes -or $Bytes.Length -eq 0) { return "" }
    $encoding = Get-TextEncodingForHtml $Bytes $ContentType
    return $encoding.GetString($Bytes)
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
    } elseif ($Profile -eq "kan") {
        $request.Referer = "https://www.kan.org.il/"
        $request.Accept = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        $request.Headers["Accept-Language"] = "he-IL,he;q=0.9,en;q=0.7"
    } elseif ($Profile -eq "isramedia") {
        $request.Referer = "https://www.isramedia.net/"
        $request.Accept = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
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

            if ($rawPath -eq "/kan/guide") {
                $lastGuideError = ""
                $guideSources = @(
                    @{ Url = $KanGuideFallbackUrl; Profile = "isramedia"; Marker = "isramedia" },
                    @{ Url = $KanGuideUrl; Profile = "kan"; Marker = "kan" }
                )

                $guideSent = $false
                foreach ($source in $guideSources) {
                    try {
                        $remote = Get-RemoteContent $source.Url $source.Profile @{}
                        if ($remote.Status -lt 200 -or $remote.Status -ge 300) {
                            throw "HTTP $($remote.Status)"
                        }

                        $guideHtml = Convert-HtmlBytesToUtf8Text $remote.Body $remote.ContentType
                        $payload = "<!-- LOCAL_SCHEDULE_SOURCE:$($source.Marker) -->`n" + $guideHtml
                        $body = [Text.Encoding]::UTF8.GetBytes($payload)
                        Write-HttpResponse $stream 200 "OK" "text/html; charset=utf-8" $body @{ "Access-Control-Allow-Origin" = "*"; "X-Schedule-Source" = $source.Marker }
                        $guideSent = $true
                        break
                    } catch {
                        $lastGuideError = "$($source.Profile): $($_.Exception.Message)"
                    }
                }

                if (-not $guideSent) {
                    $body = [Text.Encoding]::UTF8.GetBytes("Kan Guide Error: " + $lastGuideError)
                    Write-HttpResponse $stream 502 "Bad Gateway" "text/plain; charset=utf-8" $body @{ "Access-Control-Allow-Origin" = "*" }
                }
                continue
            }

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
