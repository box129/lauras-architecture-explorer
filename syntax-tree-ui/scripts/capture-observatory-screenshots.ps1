param(
  [string]$BrowserExecutable = $env:PLAYWRIGHT_BROWSER_EXECUTABLE
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$artifactDir = Join-Path $root "artifacts\observatory\phase-6"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $artifactDir "vite-screenshot-server-$stamp.log"
$errPath = Join-Path $artifactDir "vite-screenshot-server-$stamp.err.log"
$port = 5175
$baseUrl = "http://127.0.0.1:$port"
if (-not $BrowserExecutable -or -not (Test-Path -LiteralPath $BrowserExecutable)) {
  throw "Set PLAYWRIGHT_BROWSER_EXECUTABLE or pass -BrowserExecutable with an installed Chromium-family browser path."
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$server = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$port") `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError $errPath `
  -PassThru

try {
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      Invoke-WebRequest -Uri "$baseUrl/__observatory-preview" -UseBasicParsing -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    throw "Vite server did not become ready on $baseUrl"
  }

  $shots = @(
    @{ Name = "landscape-1440x900.png"; Width = 1440; Height = 900; Url = "$baseUrl/__observatory-preview" },
    @{ Name = "landscape-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview" },
    @{ Name = "rag-selected-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline" },
    @{ Name = "related-flows-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline" },
    @{ Name = "question-dock-idle-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview" },
    @{ Name = "question-loading-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=query-loading&question=login" },
    @{ Name = "login-question-lens-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=login" },
    @{ Name = "rag-upload-question-lens-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=rag-upload" },
    @{ Name = "question-step-selected-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=rag-upload&qstep=span-retriever" },
    @{ Name = "understanding-technical-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=login&understandingTab=technical" },
    @{ Name = "understanding-evidence-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=login&understandingTab=evidence" },
    @{ Name = "question-answer-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=login&proof=1" },
    @{ Name = "unsupported-question-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=unsupported" },
    @{ Name = "partial-question-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=partial" },
    @{ Name = "no-lens-answer-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?question=no-lens" },
    @{ Name = "login-flow-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?flow=login-flow" },
    @{ Name = "login-flow-route-step-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?flow=login-flow&step=login-route-step" },
    @{ Name = "login-flow-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?flow=login-flow&proof=1" },
    @{ Name = "login-step-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?flow=login-flow&step=login-auth-step&proof=1" },
    @{ Name = "rag-document-flow-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?flow=rag-document-flow" },
    @{ Name = "rag-document-retrieval-step-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?flow=rag-document-flow&step=retrieval-step" },
    @{ Name = "partial-flow-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=partial-flow&flow=unresolved-api-flow" },
    @{ Name = "partial-flow-gap-step-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=partial-flow&flow=unresolved-api-flow&step=partial-api-step" },
    @{ Name = "no-flows-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=no-flows" },
    @{ Name = "rag-proof-open-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline&proof=1" },
    @{ Name = "rag-proof-expanded-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline&proof=1&proofMode=expanded" },
    @{ Name = "rag-proof-collapsed-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline&proof=1&proofMode=collapsed" },
    @{ Name = "rag-simple-tab-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline" },
    @{ Name = "rag-technical-tab-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline&railTab=technical" },
    @{ Name = "rag-evidence-tab-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline&railTab=evidence" },
    @{ Name = "rag-evidence-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?node=rag-pipeline&railTab=evidence&proof=1" },
    @{ Name = "rag-focused-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?focus=rag-pipeline" },
    @{ Name = "rag-child-selected-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?focus=rag-pipeline&node=retrieval" },
    @{ Name = "retrieval-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?focus=rag-pipeline&node=retrieval&proof=1" },
    @{ Name = "retrieval-deep-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?focus=rag-pipeline,retrieval" },
    @{ Name = "unsupported-node-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=unsupported-node&node=rag-pipeline" },
    @{ Name = "unsupported-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=unsupported-node&node=rag-pipeline&proof=1" },
    @{ Name = "stale-node-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=stale-node&node=rag-pipeline" },
    @{ Name = "stale-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=stale-node&node=rag-pipeline&proof=1" },
    @{ Name = "no-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=no-proof&node=rag-pipeline&proof=1" },
    @{ Name = "multi-file-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=multi-file-proof&node=rag-pipeline&proof=1" },
    @{ Name = "single-file-proof-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=single-file-proof&node=rag-pipeline&proof=1" },
    @{ Name = "no-explanation-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=no-explanation&node=rag-pipeline" },
    @{ Name = "llm-failed-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=llm-failed&node=rag-pipeline" },
    @{ Name = "rag-selected-1920x1080.png"; Width = 1920; Height = 1080; Url = "$baseUrl/__observatory-preview?node=rag-pipeline" },
    @{ Name = "loading-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=loading" },
    @{ Name = "empty-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=empty" },
    @{ Name = "error-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=error" },
    @{ Name = "stale-lens-1536x960.png"; Width = 1536; Height = 960; Url = "$baseUrl/__observatory-preview?state=stale-lens" },
    @{ Name = "narrow-laptop-1366x768.png"; Width = 1366; Height = 768; Url = "$baseUrl/__observatory-preview" }
  )

  foreach ($shot in $shots) {
    $output = Join-Path $artifactDir $shot.Name
    if (Test-Path $output) { Remove-Item $output -Force }
    $profile = Join-Path $env:TEMP ("syntax-tree-edge-profile-" + [Guid]::NewGuid().ToString("N"))
    $arguments = @(
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=1200",
      "--user-data-dir=$profile",
      "--window-size=$($shot.Width),$($shot.Height)",
      "--screenshot=$output",
      $shot.Url
    )
    & $BrowserExecutable @arguments | Out-Null
    if (-not (Test-Path $output)) {
      throw "Screenshot was not created: $output"
    }
    if (Test-Path $profile) { Remove-Item $profile -Recurse -Force }
  }

  Write-Host "Observatory screenshots written to $artifactDir"
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
  $listeners = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" } |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($ownerPid in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -like "*syntax-tree-ui*" -and $process.CommandLine -like "*vite*") {
      Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
    }
  }
}
