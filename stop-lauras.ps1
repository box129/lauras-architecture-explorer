<#
.SYNOPSIS
Cleanly stops the Laura's backend and frontend dev servers started by
start-lauras.ps1 / start-refurbished-syntax-tree.ps1.

.DESCRIPTION
start-refurbished-syntax-tree.ps1 launches each service as a hidden
PowerShell wrapper process, which itself launches further child
processes (uvicorn under python.exe for the backend; cmd.exe -> node.exe
-> vite under npm for the frontend). Stopping only the top-level
recorded PID leaves those inner server processes running and still
bound to their ports (verified directly on this machine with
Get-CimInstance Win32_Process before writing this script) -- so this
script recursively finds and stops the FULL descendant process tree for
each recorded PID, not just the top-level one.

Only stops processes that descend from the PIDs Laura's own launcher
recorded -- never a broad taskkill/pkill across unrelated processes.
#>
param(
    [string]$PidFile = (Join-Path $PSScriptRoot "syntax-tree-test-artifacts\local-refurbished-dev\syntax-tree-refurbished-dev-pids.json")
)

$ErrorActionPreference = "Stop"

function Get-DescendantProcessIds {
    param([int]$RootProcessId)
    $result = New-Object System.Collections.Generic.List[int]
    $frontier = New-Object System.Collections.Generic.Queue[int]
    $frontier.Enqueue($RootProcessId)
    while ($frontier.Count -gt 0) {
        $current = $frontier.Dequeue()
        $result.Add($current)
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue
        foreach ($child in $children) {
            $frontier.Enqueue([int]$child.ProcessId)
        }
    }
    return $result
}

function Stop-ProcessTree {
    param(
        [int]$RootProcessId,
        [string]$Label
    )
    $rootStillRunning = Get-CimInstance Win32_Process -Filter "ProcessId=$RootProcessId" -ErrorAction SilentlyContinue
    if (-not $rootStillRunning) {
        Write-Host "$Label (PID $RootProcessId): not running." -ForegroundColor DarkGray
        return
    }
    $allPids = Get-DescendantProcessIds -RootProcessId $RootProcessId
    Write-Host "$Label (PID $RootProcessId): stopping $($allPids.Count) process(es) in its tree..."
    # Stop leaf/child processes before their parents so a parent doesn't
    # respawn or reparent a still-running child mid-teardown.
    [array]::Reverse($allPids)
    foreach ($processId in $allPids) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
        } catch {
            # Already exited between enumeration and stop -- fine.
        }
    }
    Write-Host "${Label}: stopped." -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath $PidFile)) {
    Write-Host "No PID file found at: $PidFile" -ForegroundColor Yellow
    Write-Host "Laura's does not appear to have been started with start-lauras.ps1 / start-refurbished-syntax-tree.ps1 from this checkout."
    Write-Host "If a backend/frontend is still running from elsewhere, stop it manually via Task Manager."
    exit 0
}

$state = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json

Stop-ProcessTree -RootProcessId $state.backend.pid -Label "Backend  ($($state.backend.url))"
Stop-ProcessTree -RootProcessId $state.frontend.pid -Label "Frontend ($($state.frontend.url))"

Write-Host ""
Write-Host "Laura's stopped." -ForegroundColor Green
