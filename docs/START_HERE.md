# Running Laura's on Windows

This is the only document you need to launch and use Laura's. Every
command below has been run and verified on this machine, in this exact
checkout, before being written down.

## The 4 steps

1. Open **PowerShell**.
2. Go to the Laura's folder:
   ```powershell
   cd "C:\Users\LENOVO T14\Development\lauras-product-end-user-acceptance"
   ```
3. **First time only**, install everything Laura's needs (takes a couple
   of minutes):
   ```powershell
   .\setup-syntax-tree.ps1
   ```
4. Start Laura's:
   ```powershell
   .\start-lauras.ps1
   ```
   The script prints two URLs, e.g.:
   ```
   Backend:  http://127.0.0.1:8000
   Frontend: http://127.0.0.1:5175
   ```
   **Open the "Frontend" URL it prints** in your browser (it is usually
   `http://127.0.0.1:5173`, but the script automatically moves to the
   next free port if something else is already using it — always use
   the URL actually printed, not a URL from memory).

That's it — Laura's is running.

## Which checkout is this?

This document describes exactly one checkout:

- Path: `C:\Users\LENOVO T14\Development\lauras-product-end-user-acceptance`
- Branch: `product/end-user-acceptance`
- Version tag: `v2-end-user-acceptance-ready`

Run `.\doctor.ps1` at any time from that folder to double-check you're
in the right place and everything is ready (see below).

## Using Laura's

### First launch

You'll see **"What repo do you want to understand?"** with a "Repository
path" box and a **Build architecture map** button — this is the primary
action; nothing else needs to be clicked first.

### Analyze a codebase

1. Paste an **absolute local folder path** to a Python repository into
   "Repository path" (e.g. `C:\path\to\some\repo`).
2. Click **Build architecture map**.

If the path doesn't exist, isn't a folder, or has no Python source
files, Laura's tells you exactly that instead of failing silently.

### Where progress appears

Right after clicking, the same screen switches to a progress view
showing the real analysis stages (scanning, parsing, extracting
relationships, building the architecture) — not a generic spinner.

### The Architecture view

Once analysis finishes, the architecture map opens automatically. It's
a node-and-edge diagram: modules, then classes, then methods.

- **Module → class → method**: click a node to open it; if it has
  children, you drill into them.
- **Back**: the arrow button in the top-left returns to the previous
  level.
- **Accessible table**: click "View architecture as accessible tables"
  (bottom-left) for a plain HTML-table alternative to the diagram —
  useful for keyboard/screen-reader navigation, and it can drill down
  the same way.

### Architectural Explanation

With a class or method selected, click the **Architectural
Explanation** button in its detail panel. This shows:

- a plain-language narrative;
- a list of **claims** (e.g. "X calls Y"), each labeled either
  **SUPPORTED** or **INSUFFICIENT EVIDENCE** (hover either label for a
  one-line explanation of what it means — insufficient evidence does
  **not** mean the claim is false, just that Laura's couldn't establish
  it from the code it analyzed).

### Inspecting evidence

Click a claim card to expand it. You'll see its **evidence chain** —
the specific relationship(s) Laura's found — including the file and
exact line range.

### Open source

Inside an expanded claim, click **Open source** to open the exact cited
file at the exact cited line, in a read-only code viewer. Close it with
the **Close source code** button (top-right of that view).

### Configuring architectural explanations (optional)

Architectural explanations are **off by default** and require an
external language-model provider to turn on. Repository analysis and
the architecture map work fully without this. To configure it, see
[`OPENAI_CONFIGURATION.md`](./OPENAI_CONFIGURATION.md) — it walks
through the exact Settings screen fields.

### Reopening a previous run

Just reload the page (F5 / Ctrl+R). Laura's remembers the last
completed analysis and reopens it without re-analyzing.

### Stopping Laura's

Back in the same PowerShell window (or a new one, from the same
folder):
```powershell
.\stop-lauras.ps1
```
This stops only the backend/frontend processes Laura's own launcher
started — nothing else on your machine.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `.\start-lauras.ps1` says "has not been set up in this checkout yet" | You skipped step 3 | Run `.\setup-syntax-tree.ps1`, then retry |
| `.\setup-syntax-tree.ps1` fails on the Python check | No Python 3.11+ on PATH | Install Python 3.12, then rerun (or pass `-PythonCommand "C:\path\to\python.exe"` if you have one installed but not on PATH) |
| `.\setup-syntax-tree.ps1` fails on the Node.js check | Node.js missing or too old | Install Node.js 22 LTS (22.12+), then rerun |
| The frontend page loads but never analyzes / stays on a spinner forever | Backend isn't reachable | Check the backend log at `syntax-tree-test-artifacts\local-refurbished-dev\backend.log`, or run `.\doctor.ps1` |
| Browser shows a connection error at the URL you tried | You used a stale/remembered URL | Re-run `.\start-lauras.ps1` and use the URL it prints *this time* — the port can shift if the default is busy |
| Not sure if anything is running, or what state things are in | — | Run `.\doctor.ps1` — it's read-only and safe to run anytime |
| You ran `python` directly (not through these scripts) and got confusing behavior | Your PATH may point `python` at a *different* project's virtual environment | Don't run `python`/`pip`/`npm` directly for Laura's — always use `setup-syntax-tree.ps1` / `start-lauras.ps1`, which use this checkout's own environment explicitly |

For anything not covered here, run `.\doctor.ps1` and read its output —
each check names exactly what's wrong and what to run next.
