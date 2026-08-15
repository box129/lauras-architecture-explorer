# User Acceptance Audit

Audit date: 2026-08-05  
Environment: Windows, PowerShell, Node 22.20.0, npm 10.9.3, system Python 3.14.0, Chromium desktop  
Application URLs: `http://127.0.0.1:5273`, API `http://127.0.0.1:8100`

> Post-audit note: remediation phase 1 subsequently fixed QA-001, QA-003, and QA-005 and partially fixed QA-002. See `REMEDIATION_PHASE_1.md`. The original verdict below remains the historical audit verdict and is not upgraded because graph, documentation, search, persistence, accessibility, cross-browser coverage, and formal requirements remain unaccepted.

## Executive result

The application can be launched on this prepared workstation and a local Python repository can be submitted from the UI. The live backend performs analysis and the UI reaches an orientation result containing repository-specific files. An invalid path produces a visible explanation and reset action.

It cannot be accepted as complete from a clean clone. There is no root setup guide, the frontend README is the untouched Vite template, the launcher does not install dependencies, and its successful run depended on globally installed Python packages. The required acceptance specification is missing. The live progress WebSocket fails with HTTP 404 because WebSocket support is absent from the declared backend dependencies. The repository also contains a startup script with hard-coded credentials and a developer-specific absolute path.

## Demonstrated journeys

| Journey | Result | Evidence |
|---|---|---|
| Initial load | PASS | 200 response, meaningful landing state and primary action; 2,744 ms observed in Chromium; no fatal page exception. `screenshots/01-initial-load.png` |
| Valid local repository submission | PARTIAL | POST `/api/analyze` 200; repository-specific orientation rendered after about 15 seconds; progress WebSocket 404. `logs/valid-repository-evidence.json`, `screenshots/valid-repository-result.png` |
| Invalid local path | PASS with secondary defect | Clear path-not-found message and Reset action; an orientation request also returned 409. `logs/invalid-repository-evidence.json`, `screenshots/invalid-repository-result.png` |
| Narrow viewport | PARTIAL | 800x900 rendering captured; no full interaction sweep. `screenshots/03-narrow.png` |
| Graph interactions | NOT DEMONSTRATED | The tested run remained at orientation/loading within the observation window; zoom, pan, edge types, and node drill-down were not accepted. |
| Documentation portal | NOT DEMONSTRATED | No end-to-end generated-doc/source correspondence proof obtained. |
| Semantic search | NOT DEMONSTRATED | No completed index/query journey obtained. No live LLM was configured. |
| GitHub URL | NOT ADVERTISED IN TESTED UI | Landing copy and control request a local path. |
| Firefox/WebKit/accessibility | BLOCKED | Integrated browser had no available backend; standalone declared Chromium was used. No configured accessibility scanner exists. |
| Persistence/restart | NOT DEMONSTRATED | Full analysis artifacts were not reached and persistence intent is undocumented at root. |

## Technical verification

- Backend tests: 77 passed, one deprecation warning, using the pre-existing backend virtual environment.
- Frontend production build: passed; emitted a 2.16 MB main chunk and large-chunk warning.
- Frontend lint: failed with one `no-explicit-any` error in `src/api/client.ts`.
- Live health: 200, but the launched service used system Python 3.14 and reported no configured LLM.
- Live browser console: WebSocket handshake failed with 404 for each analysis attempt.
- Backend log: reports no WebSocket library installed and recommends installing WebSocket support.

## Limitations

The required `audit-input/project-specification.md` does not exist. This prevents authoritative advertised-feature inventory and FR/NFR acceptance. The integrated browser connector exposed zero browser backends. Chromium was therefore exercised through the repository's declared Playwright dependency; its expected browser revision was initially absent, while other cached Chromium revisions existed. LLM/API failure modes, full graph/docs/search functionality, Firefox, WebKit, keyboard coverage, accessibility scanning, and service-restart persistence were not proven and are not claimed as passing.

## Final verdict

PARTIALLY FUNCTIONAL

The landing page, valid local submission, backend analysis activity, repository-specific orientation, and invalid-path recovery are demonstrated end to end. Clean-clone installation is not reproducible from the documentation, the canonical requirements are absent, live progress is defective, and the advertised graph/documentation/search journeys lack end-to-end acceptance evidence.

Smallest blockers before presenting the application as fully functional:

1. Supply a complete, secret-free clean-clone installation/configuration guide and reproducible dependency installation.
2. Remove and rotate the credentials committed in `start_backend.bat`; replace its machine-specific path.
3. Add the missing specification and prove every FR/NFR against it.
4. Fix or remove the advertised WebSocket progress path and declare all runtime dependencies.
5. Demonstrate complete graph, documentation, and semantic-search workflows, including failures and persistence, in supported browsers.
