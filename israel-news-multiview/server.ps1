param(
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
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
    param($Stream, [int]$Status, [string]$StatusText, [string]$ContentType, [byte[]]$Body)
    $headers = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
    $Stream.Flush()
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
            $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

            do { $line = $reader.ReadLine() } while ($line -ne $null -and $line -ne "")

            $parts = $requestLine.Split(" ")
            if ($parts.Length -lt 2 -or $parts[0] -ne "GET") {
                $body = [Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
                Write-HttpResponse $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" $body
                continue
            }

            $rawPath = $parts[1].Split("?")[0]
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
                $body = [Text.Encoding]::UTF8.GetBytes("Internal Server Error")
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
