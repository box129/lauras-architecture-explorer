# Setup Reproduction

> Post-audit note: the startup findings below describe the original audited revision. Remediation phase 1 added and successfully rehearsed the canonical root `setup-syntax-tree.ps1` plus `start-refurbished-syntax-tree.ps1` path. See `REMEDIATION_PHASE_1.md` for current results.

## Discovered prerequisites

- Windows PowerShell launcher
- Node.js/npm (tested: 22.20.0 / 10.9.3)
- Python >=3.11 (declared; launcher used global 3.14.0)
- Frontend npm dependencies
- FastAPI, Uvicorn and Pydantic; pytest/httpx for tests
- WebSocket runtime support is functionally required by the UI but absent from declared dependencies
- Optional LLM credentials/configuration; no working LLM was configured during audit
- Local SQLite storage; health reported `.syntax-tree-refurbished/backend.sqlite`
- Ports 8000/5173 preferred by launcher; audit used 8100/5273

No Docker, vector-store, graph-database, or migration setup for the tested refurbished stack was documented at root.

## Commands executed

Commands are listed without secret values. Read-only inventory commands and exact test/start commands are included.

```powershell
Get-Content -Raw <attached pasted-text.txt>
rg --files -g '!node_modules' -g '!qa-audit'
Get-ChildItem -Force
git status --short
git branch --show-current
Get-Content -Raw .env.example
Get-Content -Raw syntax-tree-ui\README.md
Get-Content -Raw syntax-tree-ui\package.json
Get-Content -Raw syntax-tree-refurbished-backend\README.md
Get-Content -Raw syntax-tree-refurbished-backend\pyproject.toml
Get-Content -Raw start-refurbished-syntax-tree.ps1
Get-Content -Raw start-syntax-tree.ps1
Get-Content -Raw start_backend.bat
node --version
npm --version
python --version
npm ci
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip check
.\start-refurbished-syntax-tree.ps1 -BackendPort 8100 -FrontendPort 5273
Invoke-WebRequest http://127.0.0.1:8100/api/health
Invoke-WebRequest http://127.0.0.1:5273
npx playwright install chromium
node qa-audit\playwright\live-audit.cjs
$env:AUDIT_REPO_PATH='C:\definitely\missing\syntax-tree-audit'; node qa-audit\playwright\live-audit.cjs
python -m pytest
.\.venv\Scripts\python.exe -m pytest
npm run build
npm run lint
```

## Results and undocumented steps

- `npm ci` was required but is not described in the application README.
- The combined launcher does not create/install a Python environment. It ignored the refurbished backend's existing `.venv` and selected global `python` because its lookup only checks the legacy backend virtual environment.
- Global Python happened to contain the runtime packages, allowing startup. This is not clean-clone reproducibility.
- The refurbished `.venv` had no pip module but did contain the test/runtime environment; it ran 77 tests successfully.
- System Python could not run pytest (`No module named pytest`).
- Playwright's expected Chromium revision was absent. An install command was attempted and timed out; a different already-cached Chromium revision was used by the audit harness.
- `npm run build` passed with a large-chunk warning.
- `npm run lint` failed with one error.
- Launcher-created processes were left running on 8100 and 5273 for reproducibility; their PID file is under `syntax-tree-test-artifacts/local-refurbished-dev`.

## Reachability

- Backend health: HTTP 200 at `http://127.0.0.1:8100/api/health`.
- Frontend: HTTP 200 at `http://127.0.0.1:5273`.
- Live browser initial load: 2,744 ms in the retained valid-run evidence.
