# Phase 2 User Acceptance Report

Date: 2026-08-06  
Audit type: black-box-first end-user acceptance  
Production code changes: none

## Executive conclusion

Repository submission and real-time analysis transport work, but the product's remaining primary workflows do not. Valid Python, TypeScript, and mixed repositories complete analysis over WebSocket, yet no architecture graph appears. Docs Studio shows the same generic onboarding outline rather than repository component documentation. All 20 semantic queries stall without a response or recovery. Refresh/reopen loses active state and the configured SQLite file does not exist.

The formal FR/NFR acceptance criteria are still absent from the supplied specification, so the numbered requirements are **NOT TESTABLE**. The explicit Section 6 journeys were exercised and are traced separately.

## Environment and method

- Windows PowerShell; prepared backend Python 3.12.12; frontend package toolchain from the Phase 1 workspace.
- Application under test: real frontend at `http://127.0.0.1:5473` proxied to real backend at `http://127.0.0.1:8300`.
- Startup command: `./start-refurbished-syntax-tree.ps1 -BackendPort 8300 -FrontendPort 5473 -SkipEnvFile`.
- `-SkipEnvFile` was used to ensure previously exposed local provider credentials were not loaded. This safety deviation did not inject mocks or replace services; health reported no configured LLM.
- The isolated documented clean-copy setup was attempted first. Its first run was blocked by external package resolution. A retry used cached packages but exceeded 120 seconds while installing backend dependencies. Consequently, the full test suite proceeded in the already prepared Phase 1 workspace and clean-startup claims remain blocked.
- The in-app browser integration was attempted first but reported no available browser. Repository Playwright 1.59.1 and locally cached Chromium, Firefox, and WebKit engines were used as the documented fallback.
- All test fixtures and artifacts are under `qa-audit/phase-2/`.

## A. Architectural graph — FAIL

Three fresh repositories completed the WebSocket contract. Captured frames include running status, completed status, and `pipeline_complete`; the analysis WebSocket then closes normally. Despite this:

- Chromium, Firefox, and WebKit each rendered 0 graph nodes and 0 edges.
- The same occurred at 1440×900, 1280×720, 768×1024, and 390×844.
- No meaningful empty/error state explained the absence.
- Graph requests occurred late and some were aborted during navigation/refresh.
- With no nodes or edges, zoom, pan, selection, back-navigation, edge-type distinction, tooltips, and manual node/edge comparison were blocked.
- The mixed fixture did not produce a usable moderate graph.
- No fatal console exceptions occurred in the matrix runs; absence is a functional failure rather than a browser crash.

Evidence: `screenshots/*-graph.png`, `logs/graph-api-metadata.json`, `logs/matrix-*.json`, `logs/docs-chromium-*.json`, and the browser traces.

## B. Documentation portal — FAIL

Docs Studio is reachable through the visible Lenses drawer after analysis. It does not satisfy the advertised documentation journey:

- No repository hierarchy is displayed.
- Zero modules, classes, functions, or methods can be opened.
- No corresponding source or syntax highlighting is shown.
- The Python, TypeScript, and mixed repositories display the same generic six-part “Architecture Onboarding” outline.
- Each generic section says `0 lenses`; the page reports 17% source-backed without repository component proof.
- Outline generation exceeded 20 seconds. Markdown generation remained on “Writing markdown from saved lenses...” during the subsequent observation.
- Direct `/docs` refresh preserves only the generic Docs Studio route, not a selected repository component.
- AI/generation wording is present, but this does not compensate for missing source-specific content.

The requested ten-component manual comparison could not be credited: zero eligible components were exposed in the UI. The intended ten source targets are recorded in `TEST_DATA.md`, and no claimed component documentation existed to compare.

Evidence: `screenshots/chromium-python-docs.png`, `chromium-typescript-docs.png`, `chromium-mixed-docs.png`; `logs/docs-chromium-*.json`.

## C. Semantic search — FAIL

Twenty documented, repository-specific queries were submitted through the visible architecture-question input across all three fixtures.

- 20/20 received no HTTP response within five seconds.
- Every stalled request left Submit disabled.
- Separately, one query per repository received no response within 30 seconds, confirming the result was not merely the five-second test bound.
- Top-five success: **0/20**.
- No ranked results, relevance scores, source excerpts, result selection, no-results state, or recoverable error appeared.
- Empty and whitespace-only submission correctly sent zero query requests.
- The set includes repeated, unrelated, highly specific, immediate-after-analysis, parser, dependency, error, and documentation queries.
- Query-after-refresh is blocked because refresh returns to repository entry. Query-after-backend-restart could not be completed because a separately isolated backend instance could not remain running in this execution environment.

Evidence: `logs/semantic-20.json`, `screenshots/semantic-search-stalled.png`, `traces/semantic-20.zip`.

## D. Persistence and recovery — FAIL

- Browser refresh after analysis returns to repository entry.
- Closing and reopening a browser page also returns to repository entry.
- Active repository, graph state, documentation state, and semantic state are not restored.
- Health advertises SQLite at `.syntax-tree-refurbished/backend.sqlite`, but that file and containing persistence data are absent in the workspace. There were therefore no database tables or records to validate.
- An attempted backend-only restart was obstructed by an orphaned Windows listener: port 8300 remained reported as owned by a PID that process enumeration could no longer see. A second combined documented instance reported new PIDs but exited before becoming reachable. Backend/service/full-restart persistence remains partially blocked by this environment behavior.
- Two simultaneous visible-UI submissions of the same TypeScript fixture both returned 200 and created different run IDs.
- Switching from prior repositories to the mixed fixture displayed `mixed-moderate` and neither earlier repository name, so stale repository identity was not observed in the tested switch.

There is no evidence that repository records, graph data, generated docs, or semantic indexes are durably stored.

Evidence: `logs/recovery-qa006.json`, `logs/persistence-store.json`, matrix refresh fields, `logs/backend-restart.stderr.log`.

## E. QA-006 orientation 409 — STILL OPEN, NON-BLOCKING

Exact reproduced sequence:

1. Load the entry page.
2. Submit a nonexistent local repository path.
3. Analysis responds and the UI displays the correct stopped/error state.
4. The frontend issues two dependent orientation reads; both return 409.

No subsequent successful retry was observed for that failed run. The 409 does not prevent the primary invalid-path message and did not corrupt valid analyses. Twelve concurrent orientation reads during a valid run all returned 200 in 190–263 ms, so ordinary read concurrency did not reproduce it. It affects invalid-input recovery/state coordination and remains a low-severity defect.

Evidence: `logs/accessibility.json`, `logs/recovery-qa006.json`.

## F. Browser and viewport compatibility — PARTIAL

Chromium, Firefox, and WebKit all loaded, submitted a repository, established the analysis WebSocket, and reached orientation. Chromium also ran at all four required viewport sizes without a browser-specific crash. The principal journey cannot pass in any engine because graph interaction, source documentation, and semantic results are globally unavailable.

No engine-specific application error was isolated; each engine reproduced the same 0-node/0-edge outcome. Mobile width is visually compressed but the test cannot establish graceful degradation of graph/docs/search because those features fail before meaningful responsive interaction.

## G. Accessibility — FAIL

Manual and automated checks found:

- Keyboard can reach the repository input and Enter submits analysis.
- The focused primary input reports no outline and no box shadow, so its focus is not visibly distinguishable by those measurable styles.
- Visible controls scanned on the analyzed view had accessible names; the invalid-path message appears in an `aria-live="polite"` region.
- Major `header`, `nav`, `main`, and `aside` landmarks exist, but the analyzed view has no `h1`.
- A custom computed-color WCAG scan found 25 text contrast failures; sampled ratios include 3.15:1 and 3.29:1 where 4.5:1 is required.
- The graph has no accessible alternative or meaningful explanation because it renders no content.
- Dependency type cannot be checked for non-color cues because no edges render.

The scanner is a focused DOM/style audit, not a substitute for full assistive-technology testing. No network package installation was performed to add axe because clean dependency setup was already blocked.

Evidence: `logs/accessibility.json`, `screenshots/keyboard-focus-input.png`.

## H. Performance observations

Submission acknowledgement is consistently below one second, and the real-time pipeline completes quickly, but the useful-result timings fail: graph never renders, docs generation exceeds the observation bound, and search exceeds both five- and thirty-second bounds. Raw per-fixture and browser timings are in `PERFORMANCE_RESULTS.md`. Formal target comparison is **NOT TESTABLE** because NFR targets are absent.

## Console, network, WebSocket, and backend evidence

- No fatal page errors were recorded in the browser matrix.
- The real analysis WebSocket uses the expected `/api/ws/analyze/{job}` contract and captured progress/completion frames without 404.
- HMR query tokens were redacted from JSON evidence even though they are ephemeral development tokens; no provider credential or authorization value is stored in Phase 2 evidence.
- Backend logs show accepted analysis WebSockets and 200 orientation/flow reads. Graph/docs/search behavior is correlated in Playwright request logs and traces.

## Reproduction commands

From the repository root with the prepared services running on 5473/8300:

```powershell
node qa-audit/phase-2/playwright/phase2-ui-audit.cjs docs
node qa-audit/phase-2/playwright/phase2-ui-audit.cjs matrix
node qa-audit/phase-2/playwright/recovery-qa006.cjs
node qa-audit/phase-2/playwright/accessibility.cjs
node qa-audit/phase-2/playwright/semantic-20.cjs
```

## Precise blockers to FULLY FUNCTIONAL

1. No non-empty repository-derived architectural graph or graph interaction.
2. No repository hierarchy/component documentation/source portal.
3. Semantic query requests do not return; top-five success is 0/20.
4. No verified durable persistence across refresh/reopen/restart.
5. Invalid analysis still causes orientation 409 requests.
6. Keyboard focus, heading structure, contrast, and graph accessibility failures.
7. Clean-copy dependency setup was not completed in this environment.
8. Original FR/NFR criteria and measurable targets are missing from the supplied specification.

## Final verdict

**NOT FUNCTIONAL FROM THE USER PERSPECTIVE**
