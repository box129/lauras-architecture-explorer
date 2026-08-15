<#
.SYNOPSIS
Friendly one-command starter for Laura's (the refurbished backend +
observatory frontend). Thin wrapper around the existing, verified
start-refurbished-syntax-tree.ps1 -- does not duplicate its process-
launch logic, just gives it an approachable name/entry point and a
clear, upfront prerequisite check.

.DESCRIPTION
Requires setup-syntax-tree.ps1 to have been run at least once (creates
the backend .venv and installs frontend node_modules). This script does
NOT run setup automatically -- it fails with a clear instruction instead
of silently installing things on first run.

.EXAMPLE
.\start-lauras.ps1
.\start-lauras.ps1 -OpenBrowser
#>
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$WorkspaceRoot = $PSScriptRoot
$VenvPython = Join-Path $WorkspaceRoot "syntax-tree-refurbished-backend\.venv\Scripts\python.exe"
$NodeModules = Join-Path $WorkspaceRoot "syntax-tree-ui\node_modules"

if (-not (Test-Path -LiteralPath $VenvPython) -or -not (Test-Path -LiteralPath $NodeModules)) {
    Write-Host ""
    Write-Host "Laura's has not been set up in this checkout yet." -ForegroundColor Yellow
    Write-Host "Run this once first:" -ForegroundColor Yellow
    Write-Host "  .\setup-syntax-tree.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "(Tip: run .\doctor.ps1 for a detailed readiness check.)"
    exit 1
}

& (Join-Path $WorkspaceRoot "start-refurbished-syntax-tree.ps1") -BackendPort $BackendPort -FrontendPort $FrontendPort -OpenBrowser:$OpenBrowser

Write-Host ""
Write-Host "Open the URL printed above (Frontend: ...) in your browser." -ForegroundColor Cyan
Write-Host "To stop Laura's later, run: .\stop-lauras.ps1" -ForegroundColor Cyan
