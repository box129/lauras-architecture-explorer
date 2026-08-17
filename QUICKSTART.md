# Laura's Quick Start

Laura's is a local application for exploring and understanding the architecture of a codebase. Repository analysis is fully deterministic and works without any AI configuration. AI is optional and adds architectural explanations, cluster interpretations, and generated Doc Studio documentation.

## Requirements

- **Python 3.12** (preferred; 3.11 or newer is required)
- **Node.js 22 LTS** (22.12 or newer) with **npm 10 or newer**
- **Windows PowerShell** (the setup/start/stop scripts are PowerShell scripts)

## First-time setup

From the repository root, run once:

```powershell
.\setup-syntax-tree.ps1
```

This creates the backend virtual environment, installs backend and frontend dependencies, and creates a local `.env` from the sanitized example. To check readiness at any time without changing anything:

```powershell
.\doctor.ps1
```

## Start Laura's

```powershell
.\start-lauras.ps1
```

The script starts both services in the background and prints their URLs:

- **Frontend (open this):** http://127.0.0.1:5173
- **Backend:** http://127.0.0.1:8000

If a default port is busy, the script automatically picks the next free port and prints the actual URL — always use the printed `Frontend:` URL.

Manual fallback (two separate PowerShell windows):

```powershell
# Backend
cd syntax-tree-refurbished-backend
$env:PYTHONPATH = 'src'
.\.venv\Scripts\python.exe -m uvicorn syntax_tree_refurbished.main:app --host 127.0.0.1 --port 8000
```

```powershell
# Frontend
cd syntax-tree-ui
$env:VITE_API_TARGET = 'http://127.0.0.1:8000'
$env:VITE_OBSERVATORY_UI = '1'
npm run dev -- --host 127.0.0.1 --port 5173
```

## Analyse a repository

1. Open Laura's in the browser (the printed frontend URL).
2. Click **Browse repository**.
3. Select a local repository folder.
4. Wait for the analysis to finish.
5. The architecture view opens when it is ready.

Python repositories are the best-supported path.

## Optional AI setup

Open **Settings** (gear icon on the start screen, or the top-bar menu) and use the **Architectural Explanations** section:

1. Turn on **Enabled**.
2. Choose a provider: **None (no provider)**, **OpenAI**, or **OpenRouter**.
3. Enter the API Base URL, model id, and your API key.
4. Use **Test connection**, then **Save**.

Notes:

- Repository analysis works fully without AI.
- The API key is held in backend process memory only — it is never written to disk and must be re-entered after a backend restart.
- Never commit API keys to the repository.

AI enables: architectural explanations, optional cluster interpretations, and AI-generated Doc Studio documentation.

## Stop Laura's

```powershell
.\stop-lauras.ps1
```

The start script runs both services as background processes, so closing the terminal or pressing Ctrl+C does not stop them — use `stop-lauras.ps1`, which stops exactly the processes it started. (If you used the manual fallback commands instead, Ctrl+C in each window stops that service.)

## Troubleshooting

### Browser shows backend/service unavailable

Make sure the backend is running on port 8000. A quick check: open http://127.0.0.1:8000/api/health — it should return `"status": "ok"`.

### AI says "No model configured"

Open **Settings → Architectural Explanations**, turn on **Enabled**, select a provider and model, and enter the API key. Analysis is unaffected either way.

### AI worked before a restart but no longer works

The credential lives only in backend process memory. Re-enter the API key in Settings after every backend restart.

### Port already in use

The start script automatically selects the next free port and prints the actual URLs — use the printed `Frontend:` URL rather than assuming 5173. If a previous Laura's is still running from this checkout, stop it first:

```powershell
.\stop-lauras.ps1
```

### Wrong or old Laura's UI appears

Confirm you are running the frozen final product from this checkout:

```powershell
git branch --show-current
git rev-parse --short HEAD
git describe --tags --exact-match HEAD
```

The expected tag is `thesis-final-product-v1`. Also confirm you started Laura's from this repository folder, not another checkout.
