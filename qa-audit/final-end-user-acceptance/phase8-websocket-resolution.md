# Phase 8 — WebSocket / runtime resolution

## Is WebSocket functionality part of the normal product runtime?

**Yes.** `POST /api/analyze` kicks off a background analysis job, and the
backend exposes a real, always-registered WebSocket route,
`@router.websocket("/ws/analyze/{job_id}")`
(`syntax-tree-refurbished-backend/src/syntax_tree_refurbished/api/routes/analyze.py:43`),
that streams genuine `status_update` and `pipeline_complete` events for
that job as analysis progresses. This is not a dev-only or optional
feature — it is the mechanism the frontend uses to show live analysis
progress instead of an unexplained spinner (Phase 4C).

## Root cause of the previously-observed 404

The backend's `pyproject.toml` already declares the correct dependency:
`uvicorn[standard]>=0.30`, where the `[standard]` extra is what pulls in
`websockets` (uvicorn's actual WebSocket protocol implementation — without
it, uvicorn has no WebSocket support at all and any `/ws/...` route
404s). The project's own official setup script
(`setup-syntax-tree.ps1`) installs the backend via
`pip install --editable "<backend>[dev]"` against a fresh `.venv`, which
correctly resolves and installs `uvicorn[standard]`'s `websockets`
dependency.

The 404 in prior acceptance rounds — and initially in this round, before
the fix below — came from running the backend against an **ad hoc global
Python environment** that had a bare `uvicorn` installed (no `[standard]`
extra), not from the project's declared dependencies or its official
setup path. Confirmed directly in this round:

```
$ python -c "import websockets"
ModuleNotFoundError: No module named 'websockets'
```

and the backend's own startup log before the fix:

```
WARNING:  No supported WebSocket library detected. Please use "pip install 'uvicorn[standard]'", or install 'websockets' or 'wsproto' manually.
INFO:     127.0.0.1:64931 - "GET /api/ws/analyze/job%3A... HTTP/1.1" 404 Not Found
```

## Resolution

- `pip install "websockets>=13"` into the runtime environment (now
  `websockets==17.0.1`) and restarted the backend process. The startup
  warning is gone, and `/ws/analyze/{job_id}` connects successfully in
  the Phase 9–12 acceptance recording — no WebSocket 404 anywhere in
  that run's network log.
- No code or dependency-declaration change was needed: `pyproject.toml`
  and `setup-syntax-tree.ps1` were already correct. This is recorded
  here as a **runtime-environment fix for this evaluation session**, not
  a product-code change — consistent with the instruction not to alter
  product behavior unless an evaluation-blocking defect requires it. The
  actual defect was that this acceptance session's ad hoc Python
  environment did not go through the project's own setup script; running
  `setup-syntax-tree.ps1` (or `pip install -e ".[dev]"` from the backend
  directory) from a clean environment would never hit this gap.
