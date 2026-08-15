param(
    [string]$PythonCommand = "python",
    [ValidateRange(5, 300)]
    [int]$PipTimeoutSeconds = 60,
    [ValidateRange(0, 10)]
    [int]$PipRetries = 3
)

$ErrorActionPreference = "Stop"

$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "syntax-tree-refurbished-backend"
$FrontendDir = Join-Path $WorkspaceRoot "syntax-tree-ui"
$VenvDir = Join-Path $BackendDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$EnvFile = Join-Path $WorkspaceRoot ".env"
$EnvExample = Join-Path $WorkspaceRoot ".env.example"
$SetupTimer = [System.Diagnostics.Stopwatch]::StartNew()

function Write-SetupStep {
    param(
        [int]$Number,
        [int]$Total,
        [string]$Message
    )

    Write-Host ""
    Write-Host "[$Number/$Total] $Message" -ForegroundColor Cyan
}

function Format-Duration {
    param([System.TimeSpan]$Duration)
    return "{0:mm\:ss}" -f $Duration
}

function Invoke-CheckedNativeCommand {
    param(
        [string]$Label,
        [string]$Executable,
        [string[]]$Arguments,
        [string]$FailureHelp
    )

    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    & $Executable @Arguments
    $exitCode = $LASTEXITCODE
    $timer.Stop()

    if ($exitCode -ne 0) {
        throw "$Label failed with exit code $exitCode after $(Format-Duration $timer.Elapsed). $FailureHelp"
    }

    Write-Host "$Label completed in $(Format-Duration $timer.Elapsed)." -ForegroundColor DarkGray
}

function Assert-FileExists {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label was not found at '$Path'. Run this script from an intact repository checkout."
    }
}

Write-SetupStep -Number 1 -Total 6 -Message "Validating the repository and supported runtimes"

Assert-FileExists -Path (Join-Path $BackendDir "pyproject.toml") -Label "Backend package metadata"
Assert-FileExists -Path (Join-Path $FrontendDir "package-lock.json") -Label "Frontend dependency lockfile"
Assert-FileExists -Path $EnvExample -Label "Sanitized environment example"

if (-not (Get-Command $PythonCommand -ErrorAction SilentlyContinue)) {
    throw "Python command '$PythonCommand' was not found. Install Python 3.12 (preferred; 3.11 or newer is supported), or rerun with -PythonCommand pointing to it."
}

$PythonVersion = (& $PythonCommand -c "import sys; print('.'.join(map(str, sys.version_info[:3])))").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not determine the version reported by Python command '$PythonCommand'."
}
if ([version]$PythonVersion -lt [version]"3.11.0") {
    throw "Python $PythonVersion is unsupported. Install Python 3.12 (preferred; 3.11 or newer is required)."
}
if (-not $PythonVersion.StartsWith("3.12.")) {
    Write-Warning "Python $PythonVersion is supported by the package metadata, but the canonical setup is tested with Python 3.12."
}

if (-not (Get-Command "node" -ErrorAction SilentlyContinue) -or (-not (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) -and -not (Get-Command "npm" -ErrorAction SilentlyContinue))) {
    throw "Node.js/npm was not found. Install Node.js 22 LTS (22.12 or newer), then rerun this script."
}

$NodeVersion = (& node -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not determine the installed Node.js version."
}
if ([version]$NodeVersion -lt [version]"22.12.0") {
    throw "Node.js 22.12 or newer is required."
}

$NpmCommand = if ($env:ComSpec) { "npm.cmd" } else { "npm" }
$NpmVersion = (& $NpmCommand --version).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not determine the installed npm version."
}
if ([version]$NpmVersion -lt [version]"10.0.0") {
    throw "npm $NpmVersion is unsupported. Install npm 10 or newer (included with the tested Node.js 22 LTS runtime)."
}

Write-Host "Workspace: $WorkspaceRoot"
Write-Host "Python:    $PythonVersion ($PythonCommand)"
Write-Host "Node.js:   $NodeVersion"
Write-Host "npm:       $NpmVersion"

Write-SetupStep -Number 2 -Total 6 -Message "Preparing the backend virtual environment"
if (-not (Test-Path -LiteralPath $VenvPython)) {
    Invoke-CheckedNativeCommand `
        -Label "Backend virtual-environment creation" `
        -Executable $PythonCommand `
        -Arguments @("-m", "venv", $VenvDir) `
        -FailureHelp "Verify that the Python venv module is installed and that the checkout directory is writable."
} else {
    Write-Host "Reusing existing backend environment at $VenvDir"
}

$VenvPythonVersion = (& $VenvPython -c "import sys; print('.'.join(map(str, sys.version_info[:3])))").Trim()
if ($LASTEXITCODE -ne 0 -or [version]$VenvPythonVersion -lt [version]"3.11.0") {
    throw "The backend virtual environment is invalid or uses an unsupported Python. Remove '$VenvDir' and rerun setup with Python 3.12."
}
if ($VenvPythonVersion -ne $PythonVersion) {
    Write-Warning "The existing backend environment uses Python $VenvPythonVersion while '$PythonCommand' reports $PythonVersion. Remove '$VenvDir' to rebuild it with the selected interpreter."
}

Invoke-CheckedNativeCommand `
    -Label "pip initialization" `
    -Executable $VenvPython `
    -Arguments @("-m", "ensurepip", "--upgrade") `
    -FailureHelp "Repair or reinstall Python, then remove the incomplete backend .venv and rerun setup."

Write-SetupStep -Number 3 -Total 6 -Message "Installing backend runtime and test dependencies"
Write-Host "pip package-index timeout: $PipTimeoutSeconds seconds per connection attempt; retries: $PipRetries"
$BackendDevSpec = "${BackendDir}[dev]"
Invoke-CheckedNativeCommand `
    -Label "Backend dependency installation" `
    -Executable $VenvPython `
    -Arguments @(
        "-m", "pip", "install",
        "--disable-pip-version-check",
        "--timeout", [string]$PipTimeoutSeconds,
        "--retries", [string]$PipRetries,
        "--prefer-binary",
        "--editable", $BackendDevSpec
    ) `
    -FailureHelp "Check package-index/DNS access and retry. The failing package and command output above identify whether resolution, download, build, or installation failed."

Write-SetupStep -Number 4 -Total 6 -Message "Installing locked frontend dependencies"
Push-Location $FrontendDir
try {
    Invoke-CheckedNativeCommand `
        -Label "Frontend dependency installation" `
        -Executable $NpmCommand `
        -Arguments @("ci") `
        -FailureHelp "Check npm registry access and package-lock.json. On Windows, stop any running Vite process before retrying because it can lock native modules."
} finally {
    Pop-Location
}

Write-SetupStep -Number 5 -Total 6 -Message "Preparing local configuration"
if (-not (Test-Path -LiteralPath $EnvFile)) {
    Copy-Item -LiteralPath $EnvExample -Destination $EnvFile
    Write-Host "Created .env from the sanitized example."
} else {
    Write-Host "Keeping the existing ignored .env file; no values were displayed or changed."
}

Write-SetupStep -Number 6 -Total 6 -Message "Verifying the installed toolchains"
Invoke-CheckedNativeCommand `
    -Label "Backend import check" `
    -Executable $VenvPython `
    -Arguments @("-c", "import fastapi, pydantic, uvicorn, websockets") `
    -FailureHelp "The backend environment is incomplete. Rerun setup after resolving the dependency error above."

$ViteExecutable = Join-Path $FrontendDir "node_modules\.bin\vite.cmd"
if (-not (Test-Path -LiteralPath $ViteExecutable -PathType Leaf)) {
    throw "Frontend verification failed: Vite was not installed at '$ViteExecutable'. Rerun setup after resolving npm output above."
}

$SetupTimer.Stop()
Write-Host ""
Write-Host "Setup complete in $(Format-Duration $SetupTimer.Elapsed)." -ForegroundColor Green
Write-Host "Start both services with: .\start-refurbished-syntax-tree.ps1"
