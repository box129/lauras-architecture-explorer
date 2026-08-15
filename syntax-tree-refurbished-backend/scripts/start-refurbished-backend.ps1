param(
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 8010
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$env:PYTHONPATH = Join-Path $root "src"

Set-Location $root
python -m uvicorn syntax_tree_refurbished.main:app --host $HostAddress --port $Port --reload

