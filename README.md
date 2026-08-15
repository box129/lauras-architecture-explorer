# Syntax Tree

Syntax Tree is a local codebase-observability application with a React/Vite frontend and a FastAPI backend. The refurbished stack analyzes local repositories, exposes source-backed orientation data, and streams analysis status over WebSocket.

## Requirements

- Windows PowerShell 5.1 or PowerShell 7
- Python 3.12 is recommended and is the canonical tested runtime (3.11 or newer is supported)
- Node.js 22.12 or newer with npm 10 or newer; Node.js 22 LTS is the canonical tested runtime
- Network access during first dependency and Playwright browser installation

The remediation environment was verified with Python 3.12.12, Node.js 22.20.0, and npm 10.9.3. The setup script prints the versions it actually selects and warns when Python differs from the preferred 3.12 runtime.

The default configuration uses a local SQLite file. It does not require Docker, a graph database, a vector database, or a separate database service. Live LLM features are optional; deterministic repository scanning works without an API credential.

## Clean-clone setup

Use this as the canonical new-user path from the repository root:

```powershell
.\setup-syntax-tree.ps1
.\start-refurbished-syntax-tree.ps1
```

The setup script creates `syntax-tree-refurbished-backend/.venv`, installs the backend with test dependencies, runs `npm ci`, and creates an ignored `.env` from `.env.example` if one does not exist. The start script validates the environment without displaying credential values and launches both services.

Setup reports each phase and its elapsed time. Package-index connections use a 60-second pip timeout and three retries by default; these values can be adjusted for a slow network without changing the script:

```powershell
.\setup-syntax-tree.ps1 -PipTimeoutSeconds 90 -PipRetries 4
```

Allow at least ten minutes for the first uncached setup. A failure exits non-zero and identifies the failed phase. Package resolution requires working DNS and Python/npm registry access; retrying cannot repair an unavailable registry or proxy. To use a particular supported Python installation, pass the executable command name with `-PythonCommand`.

On Windows, stop any running frontend before rerunning setup; a live Vite process can hold native npm modules open and cause `npm ci` to fail with `EPERM`.

Default URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- Health: `http://127.0.0.1:8000/api/health`
- OpenAPI: `http://127.0.0.1:8000/api/docs`

After startup, verify both processes using the URLs printed by the launcher (substitute them below if it selected different ports):

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
(Invoke-WebRequest http://127.0.0.1:5173).StatusCode
```

The health request and frontend status should both succeed; the frontend command should print `200`.

If a preferred port is occupied, the launcher selects the next free port and prints the actual URLs. Runtime logs and the PID record are written beneath the ignored `syntax-tree-test-artifacts/local-refurbished-dev` directory.

To select ports explicitly:

```powershell
.\start-refurbished-syntax-tree.ps1 -BackendPort 8100 -FrontendPort 5273
```

The launcher starts the FastAPI backend and Vite frontend together. Confirm the printed backend health URL returns HTTP 200 before using the frontend. No separate database startup or migration command is required.

## Configuration

Copy `.env.example` to `.env` and edit the ignored copy. Base repository analysis requires no credential.

| Variable | Required | Purpose |
|---|---:|---|
| `SYNTAX_TREE_REFURBISHED_ENV` | No | Runtime label; default `development`. |
| `SYNTAX_TREE_REFURBISHED_LOG_LEVEL` | No | Backend log level. |
| `SYNTAX_TREE_REFURBISHED_DB_PATH` | No | SQLite path; default `.syntax-tree-refurbished/backend.sqlite`. |
| `SYNTAX_TREE_LLM_PROVIDER` | No | Blank/off, `blackbox`, or `openrouter`. |
| `BLACKBOX_API_KEY` | With Blackbox | Blackbox credential. |
| `OPENROUTER_API_KEY` | With OpenRouter | Primary OpenRouter credential. |
| `OPENROUTER_API_KEY_2` | No | Optional OpenRouter fallback credential. |
| `OPENROUTER_MODEL` / `BLACKBOX_MODEL` | No | Provider model selection. |
| `SYNTAX_TREE_LLM_SSL_VERIFY` | No | TLS verification; keep enabled (`1`). |
| `SYNTAX_TREE_LLM_TIMEOUT_SECONDS` | No | Provider request timeout. |
| `VITE_WS_BASE_URL` | No | Explicit browser-visible WebSocket origin. Leave blank for same-origin proxying. HTTP(S) values are normalized to WS(S). |

Selecting a live provider without its corresponding key stops startup with the missing variable name but never displays a value.

## Services and external dependencies

The root setup and launcher are the single supported local startup path. The launcher starts both the backend and frontend; Vite proxies HTTP and WebSocket `/api` traffic to the selected backend port.

- SQLite is embedded and local. Docker, a graph database, a vector database, and a separate database service are not required.
- Base repository analysis and local retrieval require no external-model credential.
- Blackbox or OpenRouter access is optional. Selecting one requires its corresponding credential in the ignored `.env` and outbound HTTPS access to that provider.
- Dependency installation requires access to the configured Python package index and npm registry.
- Playwright validation requires a one-time browser download unless a compatible browser is already cached.
- A production reverse proxy must forward both HTTP and WebSocket upgrades for `/api`, including `/api/ws`.

## Verification

Run these commands from the repository root after setup. Start the services only for the browser journey.

```powershell
# Backend suite, including WebSocket contract integration tests
syntax-tree-refurbished-backend\.venv\Scripts\python.exe -m pytest syntax-tree-refurbished-backend\tests

# Frontend lint and production build
Push-Location syntax-tree-ui
try {
    npm run lint
    npm run build
} finally {
    Pop-Location
}

# One-time browser installation and focused live journey (services must be running)
Push-Location syntax-tree-ui
try {
    npx playwright install chromium
    $env:SYNTAX_TREE_FRONTEND_URL='http://127.0.0.1:5173'
    $env:SYNTAX_TREE_E2E_REPOSITORY=(Resolve-Path '..\syntax-tree-refurbished-backend').Path
    npm run test:e2e:analysis-websocket
} finally {
    Pop-Location
}
```

Production frontend assets are generated by `npm run build` in `syntax-tree-ui/dist`. A production deployment must separately run the backend and serve/proxy the built frontend with `/api` HTTP and WebSocket forwarding.

## Credential incident and required manual action

The repository previously committed two OpenRouter credentials and one Blackbox credential in `.env` and `start_backend.bat`. Removing them from the current tree does **not** revoke them or erase Git history. An account owner must immediately:

1. Revoke all three exposed credentials at their respective providers.
2. Create replacements only if live LLM access is still required.
3. Store replacements in the ignored local `.env` or a deployment secret manager.
4. Review provider usage/audit logs for unauthorized activity.

History rewriting is intentionally not automated. After rotations, coordinate a repository freeze and have an administrator prepare an untracked replacement file outside a fresh mirror clone. That file must contain one `git filter-repo --replace-text` literal replacement for each of the three old values; never print or commit it. Then run:

```powershell
git filter-repo --force --path .env --invert-paths --replace-text <SECURE_REPLACEMENT_FILE>
git remote add origin <REMOTE_URL>  # only if filter-repo removed the remote
git push --force --mirror origin
```

Verify the rewritten history with a redacted history-wide scanner, securely delete the replacement file, and only then force-push. All collaborators must discard old clones and re-clone; forks, pull-request refs, CI caches, release archives, and provider logs may retain old objects and must be handled according to the hosting provider's sensitive-data-removal procedure.
