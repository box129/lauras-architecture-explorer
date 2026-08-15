# Updated Phase 2 Defect Status

Date: 2026-08-06  
Status basis: Phase 2 reproduction artifacts plus core-remediation evidence currently present on disk

Status meanings:

- **FIXED**: the repaired behavior has passed its required real end-to-end journey.
- **PARTIALLY FIXED**: implementation and/or lower-layer contracts pass, but required visible-browser or restart evidence is incomplete.
- **STILL OPEN**: the user-visible defect remains reproduced or no effective repair exists.
- **BLOCKED**: validation cannot proceed because of a specific external/environmental prerequisite.

No item below is promoted to **FIXED** solely from source inspection or a mocked frontend contract.

## QA-006 - duplicate orientation 409 after invalid repository

**Updated status: PARTIALLY FIXED**

- Root cause: the generic API hook's immediate and polling effects could overlap, while the invalid-run progress panel enabled orientation reads before a graph/result was ready. Two reads then correctly received the same 409 from the non-ready run.
- Files changed: `syntax-tree-ui/src/api/hooks.ts`, `syntax-tree-ui/src/features/observatory/ObservatoryEntry.tsx`; terminal-state handling also changed in the analysis progress consumer.
- Test added/updated: hook behavior is exercised indirectly by the focused frontend flows, but there is no dedicated recorded invalid-path Playwright regression artifact yet.
- Evidence obtained: code now gates orientation on completed/renderable state and separates immediate fetch from polling; backend contracts reject non-completed and failed runs deterministically.
- End-to-end evidence still required: submit `qa-audit/phase-2/fixtures/does-not-exist` in the real browser, prove zero redundant orientation requests (or the single intended recovery request), prove the primary recoverable error remains visible, then reset and successfully analyze a valid fixture.

## QA-007 - architecture graph remains empty

**Updated status: PARTIALLY FIXED**

- Root cause: the real pipeline stopped before deterministic architecture materialization, and the no-LLM fallback did not provide a usable module/import graph. Reads were not consistently scoped to the submitted run and the frontend adapter discarded some relationship metadata.
- Files changed: backend `app/analysis/{analysis_controller,static_structure}.py`, `app/overview/system_overview_generator.py`, `app/architecture_map/projection.py`, `api/run_resolution.py`, graph route; frontend architecture map hooks, cache, adapter, API types, `ArchitectureMapCanvas.tsx`, `SemanticEdge.tsx`, store and API client.
- Test added: `test_static_graph_is_source_backed_for_python_and_typescript`; relative package-import regression; existing static-overview and no-LLM projection tests. `core-workflows-real.spec.cjs` contains a real graph contract assertion but its final evidence artifact is pending.
- Evidence obtained: `logs/backend-graph-contract.json` records Python 6/5, TypeScript 6/6, and mixed 16/16 nodes/edges, selected by explicit run. Every recorded edge was checked against fixture imports.
- End-to-end evidence still required: visible repository-specific nodes and edges, zoom, pan, selection, drilldown/back navigation, relationship distinction, and repository switching with no stale graph. A mocked `core-workflows.spec.cjs` contract is not acceptance evidence.

## QA-008 - graph work starts late or stalls after completion

**Updated status: PARTIALLY FIXED**

- Root cause: overview/map projection was lazy GET-time work outside the analysis stage sequence, so `pipeline_complete` could precede usable graph data. Frontend immediate/polling lifecycles could overlap and navigation aborted reads.
- Files changed: backend analysis controller, static structure, overview generator, architecture projection and route resolution; frontend `api/hooks.ts`, architecture hooks/cache, analysis entry/progress handling.
- Test added: graph contracts assert completed real fixture analyses immediately return their selected non-empty map; non-completed workflow routes now have a rejection regression test.
- Evidence obtained: backend graph evidence is captured only after a completed real fixture analysis and returns 200 from the selected run.
- End-to-end evidence still required: browser network trace showing `pipeline_complete` followed by a successful graph response/render without late generation, abort loop, or 409/404; disconnect/recovery behavior must remain consistent with the Phase 1 WebSocket contract.

## QA-009 - documentation portal shows generic onboarding

**Updated status: PARTIALLY FIXED**

- Root cause: Docs Studio consumed saved-lens/generic onboarding state rather than parsed symbols for the completed run; the backend lacked the hierarchy/detail contract needed for a component browser.
- Files changed: backend `api/routes/docs.py`, run resolution, source/symbol routes and persisted source regions; frontend `DocsStudio.tsx`, `SourceCode.tsx`, shell navigation, API client/store, and documentation/accessibility CSS.
- Test added: `test_documentation_hierarchy_and_detail_return_exact_source`; mocked frontend contract for hierarchy, nested component selection, dependencies, source and run headers; real Playwright spec contains hierarchy/detail/source assertions.
- Evidence obtained: `logs/backend-documentation-contract.json` records 13 Python, 11 TypeScript, and 36 mixed items with modules and nested symbols. Three manually selected component details resolve to exact declarations and real line ranges.
- End-to-end evidence still required: real browser hierarchy, multiple component switches without stale text, source presentation, dependency display, nested-route refresh, and unavailable-state behavior. The mocked contract alone cannot close the defect.

## QA-010 - semantic search stalls and returns no results

**Updated status: PARTIALLY FIXED**

- Root cause: query execution depended on the investigation/optional-model path even for credential-free operation; there was no local retrieval fallback, bounded full request lifetime, or explicit selected-run contract. The frontend loading/result path did not reliably recover from a stalled request.
- Files changed: backend `app/query/{local_search,query_controller}.py`, `api/routes/query.py`, run resolution, LLM configuration/model construction; frontend API client, `useQuestionLens.ts`, `UnderstandingPane.tsx`, shell integration and CSS.
- Test added: ranked/bounded/run-scoped retrieval including unrelated no-results; whitespace route validation and non-completed-run rejection are covered at the backend contract layer. Mocked and real Playwright query contracts were authored.
- Evidence obtained: `logs/backend-semantic-20.json` records 20/20 HTTP 200 responses from the selected run, mean 14.252 ms and max 23.083 ms. All used local source retrieval and required no external model.
- Oracle limitation: the documented expected substring appears in 16/20 top fives, but `logs/backend-semantic-expectation-audit.json` shows only 7 expected answers are fully source-supported, 2 are partial, and 11 are contradicted. Eight contradicted cases still produced a literal "success." Therefore 16/20 is not a semantic-accuracy score and the Phase 2 oracle must be corrected before a valid relevance pass rate can be reported.
- End-to-end evidence still required: real-browser valid/repeated/unrelated/empty/whitespace cases, timeout/failure recovery with Submit re-enabled, ranked relevance display, result-to-correct-component navigation, and repository isolation after switching/restart.

## QA-011 - analysis is not persistent across refresh/restart

**Updated status: PARTIALLY FIXED**

- Root cause: application startup always used `InMemoryRunStore` despite the configured SQLite path, while frontend analysis identity lived only in volatile Zustand state. API fallback to a global active run could select the wrong repository.
- Files changed: backend `api/app.py`, `api/run_resolution.py`, `app/analysis/{sqlite_run_store,run_store,analysis_controller}.py` and all core routes; frontend `store.ts`, entry/shell, API client, lens cache and route context.
- Test added: completed artifact restoration, interrupted-run failure restoration, failed-run distinction, in-memory test isolation, database-handle release, and real second-application route recovery in `test_sqlite_persistence.py`; real Playwright spec includes refresh/session-run checks.
- Evidence obtained: `logs/backend-persistence-restart.json` records database creation and a second app instance restoring completed status, graph 6/6, docs, and query results for one explicit TypeScript run.
- End-to-end evidence still required: visible browser refresh and reopen; frontend, backend and full application restart; restored graph/docs/search selections; failed/incomplete run UX; and stale-data prevention when switching repositories. Current evidence proves backend application-instance recovery, not every requested restart journey.

## QA-012 - simultaneous duplicate submissions create different runs

**Updated status: PARTIALLY FIXED**

- Root cause: each start generated and inserted a new job without an atomic comparison of normalized repository identity.
- Files changed: backend `app/analysis/{analysis_controller,run_store,sqlite_run_store}.py` and analysis route.
- Test added: `test_only_running_duplicate_repository_is_reused` verifies two differently formatted paths claim the same currently running job; completed/failed runs remain distinguishable.
- Evidence obtained: backend automated test passed in the recorded 93-test suite.
- End-to-end evidence still required: two simultaneous visible submissions through the real frontend/network must return the same active job/run and remain usable. The intended rule is only-running deduplication; a later deliberate re-analysis after completion may create a new run.

## QA-013 - `Open navigation` has no visible effect

**Updated status: PARTIALLY FIXED**

- Root cause: the menu button had no click handler or menu content when back-navigation was unavailable.
- Files changed: `ObservatoryTopBar.tsx`, `ObservatoryShell.tsx`, `index.css`, plus run-aware docs navigation and reset behavior.
- Test added: the mocked frontend contract opens the menu, navigates to repository documentation with the run context, and resets through "Analyze another repository."
- Evidence obtained: component contract exists, but it uses intercepted API responses.
- End-to-end evidence still required: the same actions against the real backend, including keyboard open, Escape dismissal, docs navigation, and successful analysis of another repository.

## QA-014 - focus, contrast, heading and graph accessibility failures

**Updated status: PARTIALLY FIXED**

- Root cause: custom control styles lacked a consistent visible focus state, several secondary text colors were below AA contrast, the analyzed view lacked a primary heading, and the React Flow canvas had no meaningful keyboard-readable equivalent.
- Files changed: `syntax-tree-ui/src/index.css`, `ArchitectureMapCanvas.tsx`, entry/shell/top bar, Docs Studio, question results and supporting semantic edge/type files.
- Test added: mocked frontend contract asserts the accessible graph alternative and named navigation/components. No final automated contrast or keyboard report has yet been captured.
- Evidence obtained: a component/relationship table is rendered from the same graph data; focus-visible and higher-contrast styles are present in source.
- End-to-end evidence still required: rerun the contrast scanner, tab/Enter/Space/Escape journeys, visible focus measurement, form label/error association, graph-table navigation, and heading/landmark checks in the real browser. Assistive-technology testing is not claimed.

## QA-015 - clean-copy setup does not complete within audit bound

**Updated status: PARTIALLY FIXED**

- Root cause: backend packaging lacked an explicit build-system declaration; setup did not report granular progress or elapsed time; and pip network timeout/retry behavior was implicit, making a slow or unavailable index look like an undiagnosed hang.
- Files changed: `syntax-tree-refurbished-backend/pyproject.toml`, root `setup-syntax-tree.ps1`, root `README.md`, and frontend package runtime metadata.
- Test added: no unit test is appropriate for the full installer; the required test is an isolated clean-copy setup and startup reproduction.
- Evidence obtained: implementation now validates versions/files, reports six phases and elapsed time, configures pip timeout/retries, exits non-zero with actionable context, verifies imports/Vite, and documents one startup path.
- End-to-end evidence still required: retained log from a copy without `.venv`, `node_modules`, database, or cached analyses, followed by backend health 200 and frontend 200 using the documented commands. Until that artifact is present, this remains partially fixed.

## Summary

| Defect | Current status | Closure gate |
|---|---|---|
| QA-006 | PARTIALLY FIXED | Real invalid-path network/recovery regression |
| QA-007 | PARTIALLY FIXED | Real graph interaction and repository-switch journey |
| QA-008 | PARTIALLY FIXED | Browser timing/network trace after WebSocket completion |
| QA-009 | PARTIALLY FIXED | Real docs/component/source/nested-refresh journey |
| QA-010 | PARTIALLY FIXED | Real search journey plus corrected relevance oracle |
| QA-011 | PARTIALLY FIXED | Browser and service/full-restart recovery matrix |
| QA-012 | PARTIALLY FIXED | Simultaneous visible submission journey |
| QA-013 | PARTIALLY FIXED | Real navigation and re-analysis journey |
| QA-014 | PARTIALLY FIXED | Automated contrast and keyboard/accessibility checks |
| QA-015 | PARTIALLY FIXED | Retained isolated clean-copy setup/start evidence |

There are no defects marked **FIXED** in this draft because the task's final real-browser and clean-copy validation artifacts are pending. The implementation results are materially improved, but acceptance status must follow evidence rather than code presence.
