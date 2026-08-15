# Product-hardening round — end-user acceptance evidence

Prepared against the frozen implementation checkpoint
`v2-provenance-explanation-usable` (commit `b707831`). All work lives on
branch `product/end-user-acceptance`, branched from that tag via an
isolated git worktree — the frozen tag, the production application at
that checkpoint, and the separate `human-evaluation-protocol-ready`
research branch all remain untouched.

This round's goal: real end-to-end product usability hardening — a
first-time user can launch Laura's, configure the LLM through a real
Settings screen, analyze a repository, understand progress, explore the
architecture, request an explanation, inspect provenance, open exact
source, recover from common failures, reopen a persisted analysis, and
understand what the interface is telling them — backed by dissertation-
quality visual/video evidence, not just unit tests.

## What changed this round

1. **Real end-user Settings UI** (Phase 2) — `syntax-tree-ui/src/features/settings/`
   + `syntax-tree-refurbished-backend/.../api/routes/settings.py`: enable/
   disable, provider, base URL, model, API key, Test connection, Save.
   Credentials are held in a process-local, in-memory-only store
   (`ArchExplanationRuntimeConfig`) — never returned by GET, never in
   `/api/health`, never logged, never persisted to disk. Environment
   variables continue to work as a fallback.
2. **LLM-failure fallback UX** (Phase 2/7) — a genuinely-configured-but-
   failing live LLM now surfaces as a 503 with a stable `{code,
   message}` detail; `ArchitecturalExplanationPanel` shows "Architectural
   explanation unavailable" with Retry/Open Settings instead of a
   generic error or blank panel. Repository analysis/architecture
   exploration are structurally unaffected by any LLM failure.
3. **Plain-language provenance copy** (Phase 6) — SUPPORTED/INSUFFICIENT
   EVIDENCE badges now carry the task-specified tooltip copy, scoped to
   this one feature via a new optional `StatusBadge` `title` override.
4. **Architecture-map legend tooltip** (Phase 5) — a one-line, additive
   fix: the canvas status legend now has hover explanations (data the
   component already computed but didn't attach).
5. **WebSocket runtime fix** (Phase 8) — `websockets` was missing from
   this evaluation session's Python environment (the project's own
   `pyproject.toml`/`setup-syntax-tree.ps1` were already correct);
   installed it and confirmed no more `/ws/analyze/{job_id}` 404s.
6. Two bounded observations **documented, not changed** (see
   `phase4-through-7-ux-audit.md`): the accessible table can overlap
   canvas clicks if left open, and the explanation panel can fire a
   (correctly-404ing) request for a transiently-selected module id.
   Neither is evaluation-blocking.

## Phase 3 — live external LLM validation

**LIVE EXTERNAL LLM VALIDATION NOT COMPLETED.** No real
`OPENROUTER_*`/`BLACKBOX_*` credentials are present in this environment
(checked directly — only an unrelated `BLACKBOX_INSTALL_DIR` env var
exists). All claim-proposal traffic in this round's evidence was
produced by `qa-audit/v2-vertical-slice/scripts/fake_llm_server.py`, a
local OpenAI-compatible stand-in that exercises the real
`OpenAICompatibleInvestigationModel` HTTP-calling code path end-to-end
(including through the new Settings-saved runtime credential, not just
env vars) but is **not** a real external provider. This matches the
same honest finding from the prior product-hardening round
(`qa-audit/v2-final-hardening/README.md`).

## Files

```
README.md                                  (this file)
phase8-websocket-resolution.md             WebSocket runtime root cause + fix
phase4-through-7-ux-audit.md               narrative UX audit + 2 documented observations
phase12-flask-principal-acceptance.md      20-item normal-runtime checklist
phase14-human-usability-dry-run-status.md  NOT COMPLETED + facilitator checklist
acceptance-matrix.md                       full state x area PASS/FAIL matrix
scripts/
  product-acceptance-flow.cjs              principal journey driver (18 screenshots + video A)
  provenance-flow.cjs                      provenance-focus driver (video B)
screenshots/                               01-18 numbered principal screenshots + 3 edge-case screenshots
recordings/
  recording-full-user-journey.webm         Phase 11 recording A
  recording-provenance-flow.webm           Phase 11 recording B
logs/
  full-journey-summary.json                machine-readable run summary
  full-journey-run.log, provenance-flow-run.log, repo-input-edge-cases.log
```

## Reproducing this evidence

```
# Backend (from syntax-tree-refurbished-backend/, with websockets installed):
PYTHONPATH=src SYNTAX_TREE_ARCH_EXPLANATION_ENABLED=1 \
SYNTAX_TREE_ARCH_EXPLANATION_LLM_PROVIDER=openrouter \
SYNTAX_TREE_ARCH_EXPLANATION_LLM_MODEL=fake-local-test-model \
SYNTAX_TREE_ARCH_EXPLANATION_LLM_BASE_URL=http://127.0.0.1:8991 \
SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY=fake-key-for-wiring-test \
python -m uvicorn syntax_tree_refurbished.main:app --port 8091

# Fake LLM stand-in:
python qa-audit/v2-vertical-slice/scripts/fake_llm_server.py 8991

# Frontend (from syntax-tree-ui/):
VITE_API_TARGET=http://127.0.0.1:8091 npx vite --port 5491 --strictPort

# Evidence run:
NODE_PATH=node_modules FRONTEND_URL=http://localhost:5491 \
TARGET_REPO=<path to a Flask checkout> \
EVIDENCE_DIR=<path to this directory> \
node ../qa-audit/final-end-user-acceptance/scripts/product-acceptance-flow.cjs
```

**STOP FOR REVIEW.**
