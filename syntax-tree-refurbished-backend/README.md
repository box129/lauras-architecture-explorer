# Syntax Tree Refurbished Backend

This folder contains the refurbished FastAPI backend. New users should follow the canonical clean-clone setup in the repository root `README.md`.

It is intentionally separate from the existing `syntax-tree` backend so the current system can remain available while the new design is worked out.

## Current Intent

The refurbished backend should be built around:

- system overview generation during architectural discovery;
- semantic anchors as the main starting points for understanding;
- an evidence browser for dynamic source inspection;
- raw readable code access even when parsing is weak;
- parser output as a precision accelerator, not the only way the AI can read code;
- implicit source proof whenever code is referenced;
- progressive understanding from overview to component to source region.

## Initial Shape

```text
syntax-tree-refurbished-backend/
  docs/    design notes, contracts, migration decisions
  src/     future backend implementation
  tests/   future tests and fixtures
```

## PR0 Status

PR0 scaffold is implemented:

- FastAPI app factory;
- health endpoint;
- plain environment config loading;
- basic logging setup;
- test setup;
- PowerShell start script.

## Run

After running the root setup script, from this folder:

```powershell
.\scripts\start-refurbished-backend.ps1
```

Or manually:

```powershell
$env:PYTHONPATH="src"
.\.venv\Scripts\python.exe -m uvicorn syntax_tree_refurbished.main:app --host 127.0.0.1 --port 8010 --reload
```

Health endpoint:

```text
GET http://127.0.0.1:8010/api/health
```

## Test

```powershell
.\.venv\Scripts\python.exe -m pytest
```
