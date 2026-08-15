<#
.SYNOPSIS
Read-only readiness check for running Laura's from this checkout.
Never installs, starts, stops, or modifies anything.

.EXAMPLE
.\doctor.ps1
#>
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Continue"
$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "syntax-tree-refurbished-backend"
$FrontendDir = Join-Path $WorkspaceRoot "syntax-tree-ui"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

$issues = 0
$warnings = 0

function Write-Check {
    param([string]$Label, [bool]$Ok, [string]$Detail = "", [bool]$WarnOnly = $false)
    if ($Ok) {
        Write-Host "  [OK]   $Label" -ForegroundColor Green
        if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray }
    } elseif ($WarnOnly) {
        Write-Host "  [WARN] $Label" -ForegroundColor Yellow
        if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray }
        $script:warnings++
    } else {
        Write-Host "  [FAIL] $Label" -ForegroundColor Red
        if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkGray }
        $script:issues++
    }
}

Write-Host ""
Write-Host "Laura's readiness check" -ForegroundColor Cyan
Write-Host "Checkout: $WorkspaceRoot"
Write-Host ""

Write-Host "Repository / version" -ForegroundColor Cyan
$gitOk = Get-Command git -ErrorAction SilentlyContinue
if ($gitOk) {
    Push-Location $WorkspaceRoot
    $branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    $head = (& git rev-parse --short HEAD 2>$null).Trim()
    $isClean = (& git status --porcelain 2>$null)
    $describesTag = (& git describe --tags --exact-match HEAD 2>$null)
    Write-Check -Label "git available" -Ok $true
    Write-Check -Label "Branch: $branch, HEAD: $head" -Ok $true
    if ($describesTag) {
        Write-Check -Label "HEAD is exactly tag '$describesTag'" -Ok $true
    } else {
        Write-Check -Label "HEAD does not exactly match a known product tag" -Ok $false -WarnOnly $true -Detail "Expected on the intended product checkpoint: v2-end-user-acceptance-ready. Run 'git tag --list' and 'git log --oneline -1' to check."
    }
    if ([string]::IsNullOrWhiteSpace($isClean)) {
        Write-Check -Label "Working tree clean" -Ok $true
    } else {
        Write-Check -Label "Working tree has uncommitted changes" -Ok $false -WarnOnly $true
    }
    Pop-Location
} else {
    Write-Check -Label "git available" -Ok $false -Detail "Cannot verify branch/commit/tag without git."
}

Write-Host ""
Write-Host "TLS / network security" -ForegroundColor Cyan
# Mirrors the exact resolution order start-refurbished-syntax-tree.ps1
# uses (Import-DotEnv only sets a variable that isn't ALREADY present in
# the session), so this reports the same effective value that would
# actually be used -- never the whole .env file, only this one
# variable's name and safe/unsafe boolean state.
$insecureTlsTokens = @("0", "false", "no", "off")
$sessionSslVerify = $env:SYNTAX_TREE_LLM_SSL_VERIFY
$envFileSslVerify = $null
$envFilePath = Join-Path $WorkspaceRoot ".env"
if (Test-Path -LiteralPath $envFilePath) {
    $match = Select-String -LiteralPath $envFilePath -Pattern '^\s*SYNTAX_TREE_LLM_SSL_VERIFY\s*=' | Select-Object -First 1
    if ($match) {
        $envFileSslVerify = ($match.Line -split "=", 2)[1].Trim().Trim('"').Trim("'")
    }
}
if ($sessionSslVerify) {
    $effective = $sessionSslVerify
    $source = "current PowerShell session (`$env:SYNTAX_TREE_LLM_SSL_VERIFY) -- takes priority over .env"
} elseif ($envFileSslVerify) {
    $effective = $envFileSslVerify
    $source = ".env"
} else {
    $effective = "1"
    $source = "default (unset everywhere)"
}
$isInsecure = $effective.Trim().ToLowerInvariant() -in $insecureTlsTokens
if (-not $isInsecure) {
    Write-Check -Label "SYNTAX_TREE_LLM_SSL_VERIFY resolves to a safe (verifying) value" -Ok $true -Detail "Effective value: '$effective' (source: $source)."
} else {
    Write-Check -Label "SYNTAX_TREE_LLM_SSL_VERIFY resolves to an INSECURE value -- TLS certificate verification is disabled" -Ok $false -Detail "Effective value: '$effective' (source: $source). This must never be the case for a real OpenAI/HTTPS provider request. Fix: run `Remove-Item Env:SYNTAX_TREE_LLM_SSL_VERIFY` in THIS PowerShell window if it is session-set, or check this checkout's own .env file. This setting is only for controlled local diagnostics (e.g. a corporate TLS-intercepting proxy) -- never leave it disabled for normal use."
}

Write-Host ""
Write-Host "Directories" -ForegroundColor Cyan
Write-Check -Label "Backend directory exists ($BackendDir)" -Ok (Test-Path -LiteralPath $BackendDir)
Write-Check -Label "Frontend directory exists ($FrontendDir)" -Ok (Test-Path -LiteralPath $FrontendDir)

Write-Host ""
Write-Host "Python" -ForegroundColor Cyan
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCmd) {
    $pyVersion = (& python -c "import sys; print('.'.join(map(str, sys.version_info[:3])))" 2>$null).Trim()
    Write-Check -Label "python on PATH: $pyVersion ($($pythonCmd.Source))" -Ok $true -Detail "This is informational only -- setup-syntax-tree.ps1 and doctor.ps1's own checks below use this checkout's own .venv, never bare 'python', so this does not need to be 3.12 itself."
    if ($pythonCmd.Source -like "*venv*" -and $pythonCmd.Source -notlike "*$WorkspaceRoot*") {
        Write-Check -Label "PATH 'python' resolves into a DIFFERENT checkout's virtual environment" -Ok $false -WarnOnly $true -Detail "$($pythonCmd.Source) -- if you ever run a bare 'python' command yourself (not via these scripts), you may be using the wrong checkout's Python. Always use .\setup-syntax-tree.ps1 / .\start-lauras.ps1 in THIS directory instead of typing python directly."
    }
} else {
    Write-Check -Label "python on PATH" -Ok $false -Detail "Install Python 3.12."
}
Write-Check -Label "Backend virtual environment exists ($VenvPython)" -Ok (Test-Path -LiteralPath $VenvPython) -Detail "If missing: run .\setup-syntax-tree.ps1"
if (Test-Path -LiteralPath $VenvPython) {
    & $VenvPython -c "import fastapi, pydantic, uvicorn" 2>$null
    Write-Check -Label "Backend core dependencies importable (fastapi, pydantic, uvicorn)" -Ok ($LASTEXITCODE -eq 0) -Detail "If failing: rerun .\setup-syntax-tree.ps1"
    & $VenvPython -c "import websockets" 2>$null
    Write-Check -Label "WebSocket runtime dependency importable (websockets)" -Ok ($LASTEXITCODE -eq 0) -Detail "Required for live analysis-progress streaming over /ws/analyze/{job_id}. If failing: rerun .\setup-syntax-tree.ps1 (installs uvicorn[standard])."
}

Write-Host ""
Write-Host "Node.js / npm" -ForegroundColor Cyan
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVersion = (& node -p "process.versions.node" 2>$null).Trim()
    Write-Check -Label "node on PATH: v$nodeVersion" -Ok $true
} else {
    Write-Check -Label "node on PATH" -Ok $false -Detail "Install Node.js 22 LTS."
}
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) { $npmCmd = Get-Command npm -ErrorAction SilentlyContinue }
if ($npmCmd) {
    Write-Check -Label "npm on PATH" -Ok $true
} else {
    Write-Check -Label "npm on PATH" -Ok $false
}
$nodeModules = Join-Path $FrontendDir "node_modules"
Write-Check -Label "Frontend dependencies installed (node_modules)" -Ok (Test-Path -LiteralPath $nodeModules) -Detail "If missing: run .\setup-syntax-tree.ps1"

Write-Host ""
Write-Host "Ports" -ForegroundColor Cyan
function Test-PortFree {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}
$backendPortFree = Test-PortFree -Port $BackendPort
Write-Check -Label "Backend port $BackendPort free" -Ok $backendPortFree -WarnOnly $true -Detail "Not fatal: start-lauras.ps1 automatically picks the next free port if this one is busy."
$frontendPortFree = Test-PortFree -Port $FrontendPort
Write-Check -Label "Frontend port $FrontendPort free" -Ok $frontendPortFree -WarnOnly $true -Detail "Not fatal: start-lauras.ps1 automatically picks the next free port if this one is busy."

Write-Host ""
Write-Host "Running instance (optional)" -ForegroundColor Cyan
$pidFile = Join-Path $WorkspaceRoot "syntax-tree-test-artifacts\local-refurbished-dev\syntax-tree-refurbished-dev-pids.json"
if (Test-Path -LiteralPath $pidFile) {
    $state = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    try {
        $health = Invoke-RestMethod -Uri "$($state.backend.url)/api/health" -TimeoutSec 3
        Write-Check -Label "Backend responding at $($state.backend.url)" -Ok $true
        $archLlm = $health.architectural_explanation_llm
        $summary = "enabled=$($archLlm.enabled) configured=$($archLlm.configured) provider=$($archLlm.provider)"
        Write-Check -Label "Architectural-explanation LLM config: $summary" -Ok $true
    } catch {
        Write-Check -Label "Backend responding at $($state.backend.url)" -Ok $false -WarnOnly $true -Detail "PID file exists but backend did not respond -- it may not be running, or another process now occupies that port. Start it with .\start-lauras.ps1"
    }
} else {
    Write-Host "  (not started yet -- run .\start-lauras.ps1)" -ForegroundColor DarkGray
}

Write-Host ""
if ($issues -eq 0) {
    Write-Host "Result: READY ($warnings warning(s))." -ForegroundColor Green
} else {
    Write-Host "Result: NOT READY -- $issues problem(s) found above." -ForegroundColor Red
}
Write-Host ""
