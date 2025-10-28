<#
    CueAI Local Development Server
    - Serves the app over HTTP to avoid CORS issues with manifest.json and service worker
    - Tries Python's built-in HTTP server first
    - Falls back to a PowerShell HttpListener if Python isn't available
#>

$ErrorActionPreference = 'Stop'

Write-Host "Starting CueAI local server..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "" 

$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Start-PythonServer {
    try {
        Write-Host "Attempting Python 3 http.server on port $port..." -ForegroundColor DarkCyan
        & python -m http.server $port
        if ($LASTEXITCODE -eq 0) { return $true }
    } catch {}
    try {
        Write-Host "Python 3 failed. Trying Python 2 SimpleHTTPServer..." -ForegroundColor DarkYellow
        & python -m SimpleHTTPServer $port
        if ($LASTEXITCODE -eq 0) { return $true }
    } catch {}
    return $false
}

function Get-ContentType([string]$path) {
    switch -Regex ($path) {
        '\\.html$' { 'text/html; charset=utf-8'; break }
        '\\.js$'   { 'application/javascript; charset=utf-8'; break }
        '\\.css$'  { 'text/css; charset=utf-8'; break }
        '\\.json$' { 'application/json; charset=utf-8'; break }
        '\\.svg$'  { 'image/svg+xml; charset=utf-8'; break }
        '\\.(png)$' { 'image/png'; break }
        '\\.(jpg|jpeg)$' { 'image/jpeg'; break }
        '\\.ico$'  { 'image/x-icon'; break }
        default     { 'application/octet-stream' }
    }
}

function Start-PowerShellServer {
    Add-Type -AssemblyName System.Net.HttpListener
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
    Write-Host "PowerShell static server listening at $prefix (root: $root)" -ForegroundColor Green

    try {
        while ($true) {
            $context = $listener.GetContext()
            $req = $context.Request
            $res = $context.Response

            $localPath = $req.Url.LocalPath
            if ($localPath -eq '/') { $localPath = '/index.html' }

            # Basic path sanitization
            $safePath = $localPath -replace '/', '\\'
            if ($safePath -match '\.\.|:') { $res.StatusCode = 400; $res.Close(); continue }

            $filePath = Join-Path $root ($safePath.TrimStart('\\'))
            if (-not (Test-Path $filePath)) {
                # Handle implicit paths like /service-worker.js etc.
                $res.StatusCode = 404
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                $res.Close()
                continue
            }

            try {
                $contentType = Get-ContentType $filePath
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $res.ContentType = $contentType
                $res.AddHeader('Cache-Control','no-cache, no-store, must-revalidate')
                $res.AddHeader('Pragma','no-cache')
                $res.AddHeader('Expires','0')
                $res.StatusCode = 200
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $res.StatusCode = 500
            } finally {
                $res.Close()
            }
        }
    } finally {
        $listener.Stop()
        $listener.Close()
    }
}

if (-not (Start-PythonServer)) {
    Write-Host "Python not available. Falling back to PowerShell server..." -ForegroundColor Yellow
    Start-PowerShellServer
}
