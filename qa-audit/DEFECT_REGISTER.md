# Defect Register

## Remediation phase 1 status

| Defect | Status | Phase 1 evidence |
|---|---|---|
| QA-001 | FIXED | Root setup documentation and one canonical setup/launcher path were added. An isolated tree without `.venv` or `node_modules` installed and launched successfully. |
| QA-002 | PARTIALLY FIXED | Current tracked credentials and machine paths were removed; `.env` is no longer tracked. Provider revocation/rotation and coordinated Git-history rewriting remain manual actions. |
| QA-003 | FIXED | The backend now exposes the existing frontend contract, analysis runs in the background, WebSocket runtime support is declared, and live Chromium evidence shows HTTP 101 plus progress and completion frames. |
| QA-004 | STILL OPEN | `audit-input/project-specification.md` remains absent and was not invented during remediation. |
| QA-005 | FIXED | The unsafe frontend token-walk type was corrected; `npm run lint` now passes. |
| QA-006 | STILL OPEN | A transient orientation HTTP 409 remains visible during valid analysis and the invalid-path coordination case was not remediated in this phase. |

## QA-001 — Clean-clone setup is not documented or reproducible

- Severity: Blocker
- Journey: installation and startup
- Environment: clean-clone perspective on Windows/PowerShell
- Prerequisites: repository checkout
- Reproduction: inspect root; attempt to locate root README and installation command; inspect frontend README; run the supplied combined launcher.
- Expected: documented runtimes, versions, dependency installation, configuration, URL, and verification steps.
- Actual: no root README; frontend README is the Vite template; launcher installs nothing and succeeds here only because global Python packages and existing frontend modules are present.
- Evidence: `SETUP_REPRODUCTION.md`; launcher output; repository inventory.
- Likely subsystem: packaging/documentation
- Reproducible: consistently
- Requirements: formal IDs unavailable (missing specification); clean-clone primary question

## QA-002 — Credentials and developer-specific path committed in startup file

- Severity: Critical
- Journey: configuration/startup/security
- Environment: repository checkout
- Prerequisites: read access to `start_backend.bat`
- Reproduction: open `start_backend.bat` without executing it.
- Expected: secrets supplied externally and portable paths.
- Actual: multiple hard-coded credential values and a developer-specific absolute path are present. Values are intentionally omitted from this report.
- Evidence: local `start_backend.bat` inspection.
- Likely subsystem: configuration/security
- Reproducible: consistently
- Requirements: formal IDs unavailable; secure configuration

## QA-003 — Analysis progress WebSocket fails

- Severity: High
- Journey: repository analysis/progress
- Environment: Chromium, frontend 5273, backend 8100
- Prerequisites: services started by combined launcher
- Reproduction: open landing page; enter a valid repository path; select Build architecture map; inspect console/network/backend log.
- Expected: live progress channel connects, or the product deliberately uses a documented fallback without an error.
- Actual: `ws://.../api/ws/analyze/{job}` handshake returns 404. Backend says no supported WebSocket library is installed. Polling permits partial continuation.
- Evidence: `logs/valid-repository-evidence.json`, `traces/chromium-trace.zip`, backend log.
- Likely subsystem: backend runtime dependencies / Vite proxy / progress transport
- Reproducible: consistently on both valid and invalid submissions
- Requirements: formal IDs unavailable; visible progress

## QA-004 — Required requirements specification is missing

- Severity: Blocker
- Journey: acceptance/traceability
- Environment: checkout on branch `main`
- Prerequisites: repository checkout
- Reproduction: test for `audit-input/project-specification.md`.
- Expected: file exists and defines every FR/NFR acceptance criterion.
- Actual: directory/file absent.
- Evidence: `REQUIREMENTS_TRACEABILITY.md` and setup command output.
- Likely subsystem: product requirements/release packaging
- Reproducible: consistently
- Requirements: all FR/NFR entries

## QA-005 — Frontend lint gate fails

- Severity: Medium
- Journey: release verification
- Environment: Node 22.20.0, npm 10.9.3
- Prerequisites: frontend dependencies installed
- Reproduction: `npm run lint` in `syntax-tree-ui`.
- Expected: zero lint errors.
- Actual: one `@typescript-eslint/no-explicit-any` error in `src/api/client.ts`.
- Evidence: command output recorded in setup reproduction.
- Likely subsystem: frontend API client
- Reproducible: consistently
- Requirements: formal IDs unavailable; maintainability/release quality

## QA-006 — Failed analysis triggers conflicting orientation request

- Severity: Low
- Journey: invalid repository recovery
- Environment: Chromium, live services
- Prerequisites: enter nonexistent local path
- Reproduction: submit `C:\definitely\missing\syntax-tree-audit`; observe requests.
- Expected: failed analysis stops dependent requests.
- Actual: UI clearly reports failure but also requests orientation, receiving HTTP 409 and producing a console resource error.
- Evidence: `logs/invalid-repository-evidence.json`, `screenshots/invalid-repository-result.png`.
- Likely subsystem: frontend analysis/orientation state coordination
- Reproducible: observed once
- Requirements: formal IDs unavailable; failure/recovery behavior
