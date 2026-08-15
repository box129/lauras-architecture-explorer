param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [string]$HostAddress = "127.0.0.1",
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "syntax-tree"
$FrontendDir = Join-Path $WorkspaceRoot "syntax-tree-ui"
$ArtifactDir = Join-Path $WorkspaceRoot "syntax-tree-test-artifacts\local-dev"
$PidFile = Join-Path $ArtifactDir "syntax-tree-dev-pids.json"
$BackendLog = Join-Path $ArtifactDir "backend.log"
$FrontendLog = Join-Path $ArtifactDir "frontend.log"

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

Assert-PathExists -Path $BackendDir -Label "Backend directory"
Assert-PathExists -Path $FrontendDir -Label "Frontend directory"
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null

$SelectedBackendPort = Find-IdlePort -Address $HostAddress -StartPort $BackendPort
$SelectedFrontendPort = Find-IdlePort -Address $HostAddress -StartPort $FrontendPort
$BackendUrl = "http://$HostAddress`:$SelectedBackendPort"
$FrontendUrl = "http://$HostAddress`:$SelectedFrontendPort"

$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $PythonExe)) {
    $PythonExe = "python"
}

$NpmCommand = "npm"
if ($env:ComSpec) {
    $NpmCommand = "npm.cmd"
}

$BackendCommand = @"
Set-Location -LiteralPath '$BackendDir'
`$env:PYTHONUNBUFFERED = '1'
& '$PythonExe' -m uvicorn syntax_tree.api.app:app --reload --host $HostAddress --port $SelectedBackendPort *> '$BackendLog'
"@

$FrontendCommand = @"
Set-Location -LiteralPath '$FrontendDir'
`$env:VITE_API_TARGET = '$BackendUrl'
`$env:VITE_OBSERVATORY_UI = '1'
& '$NpmCommand' run dev -- --host $HostAddress --port $SelectedFrontendPort *> '$FrontendLog'
"@

Write-Host ""
Write-Host "Starting Syntax Tree without touching busy ports..." -ForegroundColor Cyan
Write-Host "Backend preferred port:  $BackendPort -> selected $SelectedBackendPort"
Write-Host "Frontend preferred port: $FrontendPort -> selected $SelectedFrontendPort"
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
Write-Host "Legacy:   $FrontendUrl/legacy"
Write-Host "Preview:  $FrontendUrl/__observatory-preview"
Write-Host ""
Write-Host "Logs:"
Write-Host "  Backend:  $BackendLog"
Write-Host "  Frontend: $FrontendLog"
Write-Host "PIDs written to: $PidFile"
Write-Host ""
Write-Host "This script does not kill or free ports. If a preferred port is busy, it uses the next idle one." -ForegroundColor DarkGray
Write-Host "To stop these launched processes later, close them by PID from the pid file or use Task Manager." -ForegroundColor DarkGray

if ($OpenBrowser) {
    Start-Process $FrontendUrl | Out-Null
}
