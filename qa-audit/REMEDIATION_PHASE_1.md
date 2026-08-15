# Remediation Phase 1

Date: 2026-08-05  
Scope: credential/configuration security, analysis WebSocket recovery, and reproducible clean-clone startup

## Outcome

The current tree no longer tracks local credentials, startup is portable and validated, and the repository-analysis workflow now establishes a real WebSocket connection while the analysis pipeline runs in a background task. A live Chromium test observed a 101 upgrade, multiple status messages, a completion message, clean closure, and no WebSocket 404.

Credential remediation is only partial until account owners revoke/rotate all exposed provider keys and an administrator rewrites shared Git history. No history rewrite or provider-side rotation was performed automatically.

## Root causes and corrections

### Credential and configuration security

- Root cause: `.env` was tracked and three provider credential values were duplicated in a tracked batch launcher.
- Root cause: the batch launcher contained developer-specific absolute paths and disabled TLS verification inline.
- Correction: `.env` was removed from Git tracking and root ignore rules now cover environment files, databases, logs, traces, browser reports, PID files, and temporary QA output.
- Correction: `start_backend.bat` is now a portable wrapper around the canonical PowerShell launcher.
- Correction: `.env.example` contains only safe defaults and empty credential fields.
- Correction: the launcher parses `.env` without printing values and validates provider-specific required variable names. It warns when LLM TLS verification is disabled.
- Correction: active UI/test scripts derive workspace, repository, artifact, and optional browser paths from their location or environment variables.

History-wide redacted scanning found the same three credentials across nine reachable revisions. The affected variables are `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2`, and `BLACKBOX_API_KEY`. All three must be revoked/rotated manually. The exact coordinated `git filter-repo` procedure is documented in the root README. External credentials were not and cannot be rotated by these code changes.

### Analysis WebSocket

- Root cause: the frontend and Vite proxy used the intended `/api/ws/analyze/{job_id}` path, but the refurbished backend had no corresponding route.
- Root cause: bare Uvicorn installed no WebSocket protocol implementation.
- Root cause: analysis ran synchronously inside POST and marked the job complete after snapshot creation, before parsing, orientation, and anchor stages.
- Correction: `uvicorn[standard]` declares the runtime protocol support.
- Correction: the existing analysis router now streams `status_update`, `pipeline_complete`, and `error` packets from the shared status DTO.
- Correction: POST creates a running job and schedules the existing pipeline as a background task. Stage changes update the job, the snapshot no longer terminalizes it, and completion occurs after the final stage.
- Correction: frontend analysis sockets use a shared URL builder. Same-origin ws/wss remains the default through Vite; `VITE_WS_BASE_URL` supports configured direct deployments and normalizes HTTP(S) schemes.
- Correction: socket errors or premature closes immediately poll and continue polling until terminal state. Explicit reconnect is not intended; polling is the recovery path. Server reconnect to an existing job is covered by integration tests.

### Clean startup

- Root cause: no root instructions or dependency setup existed, and the combined launcher incorrectly searched only the legacy backend virtual environment before falling back to global Python.
- Correction: `setup-syntax-tree.ps1` creates the refurbished virtual environment, installs backend/dev dependencies, runs `npm ci`, and creates an ignored `.env` from the sanitized example.
- Correction: the launcher requires that environment, validates dependencies (including WebSockets), checks frontend installation, and reports actionable setup errors.
- Correction: the root README documents versions, variables, services, ports, health checks, test commands, production build, optional LLM dependencies, and reverse-proxy WebSocket requirements.

No Docker Compose stack is intended or present for the refurbished application. SQLite is local; no graph database, vector store, migration, or external database is required for the tested startup path.

## Files changed

- Root security/startup: `.gitignore`, `.env.example`, `README.md`, `setup-syntax-tree.ps1`, `start-refurbished-syntax-tree.ps1`, `start_backend.bat`.
- Backend: `pyproject.toml`, backend README/example environment, analysis route/controller/store, WebSocket integration test, and existing API contract assertions updated from synchronous `completed` to asynchronous `running`.
- Frontend: shared WebSocket URL builder, both analysis progress consumers, API-client lint correction, package test command, focused Playwright test, root-relative legacy QA scripts, and frontend README.
- Audit: defect status table and this remediation report.
- Tracking cleanup: local `.env`; generated audit logs/screenshots/traces; historical server logs/PID record; and generated test-results output are removed from the Git index but retained locally where they existed.

## Validation executed

| Validation | Result |
|---|---|
| Backend WebSocket integration tests | PASS — 4 tests cover running progress, completion, failure message, unknown job, disconnect, and reconnect. |
| Full backend suite | PASS — 81 tests; one pre-existing Starlette/httpx deprecation warning. |
| Frontend lint | PASS — zero errors. |
| Frontend production build | PASS — large-chunk warning remains. |
| Focused headed Playwright journey | PASS — valid local repository reached Orientation ready. |
| Live WebSocket network contract | PASS — one socket, HTTP 101, five `status_update` packets, one `pipeline_complete`, and clean close. |
| Browser console check | PASS for QA-003 — no WebSocket failure or 404; one unrelated orientation 409 remains. |
| Current tracked-tree secret scan | PASS — zero likely secret candidates. |
| Current tracked active-code path scan | PASS — no user-profile absolute paths in runtime/test configuration; six remaining candidates are historical reports/artifacts. |
| Missing-variable startup validation | PASS — selected provider without its required key stops and names the missing variable without a value. |
| Prepared-workspace canonical setup | PASS after stopping the Vite process that held a Windows native module lock. |
| Isolated clean startup | PASS — copied tree began without `.venv`/`node_modules`, completed canonical setup, created sanitized `.env`, and served backend health 200 plus frontend 200. |

Evidence retained locally under ignored paths:

- `qa-audit/logs/remediation-websocket-playwright.json`
- `qa-audit/screenshots/remediation-websocket-complete.png`
- `qa-audit/traces/remediation-websocket-trace.zip`

## Remaining risks and manual actions

1. Revoke/rotate the two exposed OpenRouter keys and one Blackbox key, then review provider audit/usage logs.
2. Perform the coordinated history rewrite documented in `README.md`; old clones, forks, CI caches, pull-request refs, and archives may retain compromised objects.
3. `npm ci` reports seven dependency vulnerabilities (one low, two moderate, four high). They were not auto-fixed because dependency upgrades are outside this focused phase.
4. The frontend build still reports large chunks, including a roughly 2.16 MB main bundle.
5. A valid background run can issue an early orientation request that returns HTTP 409 before succeeding; QA-006 remains open.
6. Historical documentation/evidence contains six user-profile absolute-path references. They are not active configuration and were retained to preserve audit history.
7. `audit-input/project-specification.md` remains missing, so formal FR/NFR traceability remains not testable.
8. The integrated browser connector was unavailable; the declared Playwright CLI and Chromium CDP provided the live evidence instead.

## Workflows still requiring end-to-end validation

- Graph rendering, dependency semantics, zoom, pan, node selection, and large-graph usability.
- Documentation generation, hierarchy/source correspondence, deep links, and refresh behavior.
- Semantic search relevance, navigation, timing, empty/error states, and live LLM behavior.
- Persistence across reload and service restart.
- Accessibility, keyboard coverage, Firefox, and WebKit.
- Backend/database/LLM outage and network interruption recovery beyond the analysis-socket polling fallback.

No untested workflow above is marked passed by this remediation phase.
