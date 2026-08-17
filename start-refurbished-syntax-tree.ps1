param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [string]$HostAddress = "127.0.0.1",
    [switch]$OpenBrowser,
    [switch]$SkipEnvFile
)

$ErrorActionPreference = "Stop"

$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "syntax-tree-refurbished-backend"
$FrontendDir = Join-Path $WorkspaceRoot "syntax-tree-ui"
$ArtifactDir = Join-Path $WorkspaceRoot "syntax-tree-test-artifacts\local-refurbished-dev"
$PidFile = Join-Path $ArtifactDir "syntax-tree-refurbished-dev-pids.json"
# A previous detached server can outlive its wrapper and retain its output
# file handle. Per-launch logs avoid making a fresh, port-safe launch fail
# before either command starts; the exact paths remain in the PID manifest.
$LaunchStamp = (Get-Date).ToString("yyyyMMdd-HHmmss-fff")
$BackendLog = Join-Path $ArtifactDir "backend-$LaunchStamp.log"
$FrontendLog = Join-Path $ArtifactDir "frontend-$LaunchStamp.log"

function Test-IdlePort {
    param(
        [string]$Address,
        [int]$Port
    )
    $listener = $null
    try {
        $ip = [System.Net.IPAddress]::Parse($Address)
        $listener = [System.Net.Sockets.TcpListener]::new($ip, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener -ne $null) {
            $listener.Stop()
        }
    }
}

function Find-IdlePort {
    param(
        [string]$Address,
        [int]$StartPort,
        [int]$MaxAttempts = 100
    )
    for ($port = $StartPort; $port -lt ($StartPort + $MaxAttempts); $port++) {
        if (Test-IdlePort -Address $Address -Port $port) {
            return $port
        }
    }
    throw "No idle port found from $StartPort to $($StartPort + $MaxAttempts - 1)."
}

function Assert-PathExists {
    param(
        [string]$Path,
        [string]$Label
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label was not found at: $Path"
    }
}

function Import-DotEnv {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $parts = $trimmed.Split("=", 2)
        $name = if ($parts.Count -ge 1) { $parts[0].Trim() } else { "" }
        if ($parts.Count -ne 2 -or $name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw "Invalid configuration entry in .env. Expected NAME=value."
        }
        $value = $parts[1].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if (-not (Test-Path "Env:$name")) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

function Assert-SafeConfiguration {
    $provider = $env:SYNTAX_TREE_LLM_PROVIDER
    if ($provider) {
        switch ($provider.Trim().ToLowerInvariant()) {
            "blackbox" {
                if (-not $env:BLACKBOX_API_KEY) {
                    throw "SYNTAX_TREE_LLM_PROVIDER=blackbox requires BLACKBOX_API_KEY. No value was loaded."
                }
            }
            "openrouter" {
                if (-not $env:OPENROUTER_API_KEY -and -not $env:OPENROUTER_API_KEY_2) {
                    throw "SYNTAX_TREE_LLM_PROVIDER=openrouter requires OPENROUTER_API_KEY or OPENROUTER_API_KEY_2. No value was loaded."
                }
            }
            "off" { }
            default { throw "Unsupported SYNTAX_TREE_LLM_PROVIDER. Use blackbox, openrouter, off, or leave it blank." }
        }
    }

    if ($env:SYNTAX_TREE_LLM_SSL_VERIFY -and $env:SYNTAX_TREE_LLM_SSL_VERIFY.Trim().ToLowerInvariant() -in @("0", "false", "no", "off")) {
        Write-Warning "LLM TLS certificate verification is disabled (SYNTAX_TREE_LLM_SSL_VERIFY='$($env:SYNTAX_TREE_LLM_SSL_VERIFY)'). Do not use this setting outside controlled local diagnostics (e.g. a corporate TLS-intercepting proxy)."
        Write-Warning "This checkout's own .env.example ships '1' (verification enabled), so this value came from either this checkout's .env file or an existing session/user environment variable. To restore normal, secure behavior: check this workspace's .env for a SYNTAX_TREE_LLM_SSL_VERIFY line, AND, in THIS PowerShell window, run: Remove-Item Env:SYNTAX_TREE_LLM_SSL_VERIFY -ErrorAction SilentlyContinue"
    }
}

Assert-PathExists -Path $BackendDir -Label "Refurbished Backend directory"
Assert-PathExists -Path $FrontendDir -Label "Frontend directory"
if (-not $SkipEnvFile) {
    Import-DotEnv -Path (Join-Path $WorkspaceRoot ".env")
}
Assert-SafeConfiguration
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null

$SelectedBackendPort = Find-IdlePort -Address $HostAddress -StartPort $BackendPort
$SelectedFrontendPort = Find-IdlePort -Address $HostAddress -StartPort $FrontendPort
$BackendUrl = "http://$HostAddress`:$SelectedBackendPort"
$FrontendUrl = "http://$HostAddress`:$SelectedFrontendPort"

$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $PythonExe)) {
    throw "Backend environment is missing. Run .\setup-syntax-tree.ps1 first."
}

& $PythonExe -c "import fastapi, pydantic, uvicorn, websockets" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "Backend dependencies are incomplete. Run .\setup-syntax-tree.ps1 first."
}

if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "node_modules"))) {
    throw "Frontend dependencies are missing. Run .\setup-syntax-tree.ps1 first."
}
$ViteExecutable = if ($env:ComSpec) {
    Join-Path $FrontendDir "node_modules\.bin\vite.cmd"
} else {
    Join-Path $FrontendDir "node_modules\.bin\vite"
}
if (-not (Test-Path -LiteralPath $ViteExecutable)) {
    throw "Frontend dependencies are incomplete. Run .\setup-syntax-tree.ps1 first."
}

$NpmCommand = "npm"
if ($env:ComSpec) {
    $NpmCommand = "npm.cmd"
}

$BackendCommand = @"
Set-Location -LiteralPath '$BackendDir'
`$env:PYTHONUNBUFFERED = '1'
`$env:PYTHONPATH = 'src'
& '$PythonExe' -m uvicorn syntax_tree_refurbished.main:app --reload --host $HostAddress --port $SelectedBackendPort *> '$BackendLog'
"@

$FrontendCommand = @"
Set-Location -LiteralPath '$FrontendDir'
`$env:VITE_API_TARGET = '$BackendUrl'
`$env:VITE_OBSERVATORY_UI = '1'
& '$NpmCommand' run dev -- --host $HostAddress --port $SelectedFrontendPort *> '$FrontendLog'
"@

Write-Host ""
Write-Host "Starting Refurbished Syntax Tree and UI together..." -ForegroundColor Cyan
Write-Host "Backend preferred port:  $BackendPort -> selected $SelectedBackendPort"
Write-Host "Frontend preferred port: $FrontendPort -> selected $SelectedFrontendPort"
Write-Host "Using Python executable: $PythonExe"
Write-Host ""

$BackendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $BackendCommand
) -WindowStyle Hidden -PassThru

$FrontendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $FrontendCommand
) -WindowStyle Hidden -PassThru

$State = [ordered]@{
    started_at = (Get-Date).ToString("o")
    backend = [ordered]@{
        pid = $BackendProcess.Id
        url = $BackendUrl
        port = $SelectedBackendPort
        log = $BackendLog
    }
    frontend = [ordered]@{
        pid = $FrontendProcess.Id
        url = $FrontendUrl
        port = $SelectedFrontendPort
        log = $FrontendLog
    }
}
$State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $PidFile -Encoding UTF8

Write-Host "Backend:  $BackendUrl"
Write-Host "Frontend: $FrontendUrl"
Write-Host ""
Write-Host "Logs:"
Write-Host "  Backend:  $BackendLog"
Write-Host "  Frontend: $FrontendLog"
Write-Host "PIDs written to: $PidFile"
Write-Host ""
Write-Host "To stop these processes, close them by PID or use Task Manager." -ForegroundColor DarkGray

if ($OpenBrowser) {
    Start-Process $FrontendUrl | Out-Null
}
