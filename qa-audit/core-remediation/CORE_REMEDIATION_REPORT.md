# Core Workflow Remediation Report

Date: 2026-08-06  
Scope: Phase 2 core-workflow remediation  
Status at this draft: implementation and backend contract validation are recorded; required final browser, frontend, accessibility, cross-browser, and clean-copy validation results are still pending

## Outcome

The remediation replaces the empty or placeholder core paths with repository-derived data and introduces durable run selection and storage. Backend evidence currently demonstrates non-empty source-backed graphs, repository component documentation, bounded local source retrieval, and SQLite recovery for all or representative Phase 2 fixtures. The frontend now carries an explicit analysis run through graph, documentation, and search requests, renders repository results, persists the active session, and exposes recovery/navigation/accessibility affordances.

This report does **not** yet call any principal workflow fixed from the end-user perspective. The task requires a real visible-browser pass before that conclusion, and the final Playwright, Firefox/WebKit, accessibility, and clean-copy artifacts have not yet been written under this evidence directory. Those validations are marked pending in `VALIDATION_RESULTS.md` and the defect statuses remain conservative in `UPDATED_DEFECT_STATUS.md`.

## Root causes and corrections

### Architecture graph and completion timing

Root causes:

- The analysis pipeline completed after parsing/orientation/anchor discovery without materializing a deterministic architecture overview and map.
- With no optional LLM configured, the fallback overview did not supply a usable repository module/import graph.
- Graph generation could therefore be triggered lazily after the WebSocket completion signal, while frontend reads were not consistently scoped to the submitted run.
- The frontend adapter did not preserve all relationship metadata needed by the renderer.

Corrections:

- Added deterministic Python and TypeScript/JavaScript module/import extraction from the real parsed repository snapshot.
- Added a static-structure analysis stage before the run is marked completed and before `pipeline_complete` is emitted.
- Projected source-backed components and relationships into the existing architecture-map contract rather than adding a duplicate route.
- Added explicit run resolution with query parameter, `X-Syntax-Tree-Run-Id`, then active-run precedence; incomplete and failed runs are rejected rather than silently serving another run.
- Scoped frontend graph fetches and caches to the selected run, preserved relationship kind/label/confidence/source references, and added a textual graph table.

Recorded backend evidence:

- Python: 6 nodes, 5 import edges.
- TypeScript: 6 nodes, 6 import edges.
- Mixed fixture: 16 nodes, 16 import edges.
- Every recorded edge was manually compared with an import statement in the fixture source.

Evidence: `logs/backend-graph-contract.json`.

### Documentation portal

Root causes:

- Docs Studio was driven by locally saved lenses and a generic onboarding outline rather than the completed analysis run's parsed modules and symbols.
- The backend did not expose the nested hierarchy/detail shape consumed by a repository documentation browser.
- Component selection and nested-route context were not durably tied to a run.

Corrections:

- Added run-scoped hierarchy and component-detail API contracts derived from parsed modules, classes, functions, methods, interfaces, and type aliases.
- Detail responses return exact repository path and line ranges, real source, dependency/reference information, and source-grounded summary text.
- Reworked Docs Studio to load the hierarchy, select a component, show source and dependencies, distinguish loading/error/unavailable states, and keep the run context in its route.
- Added repository source rendering with syntax-token classes; it is a lightweight highlighter, not a claim of parser-perfect highlighting for every language.

Recorded backend evidence:

- Python hierarchy: 13 items (5 modules, 2 classes, 2 functions, 4 methods).
- TypeScript hierarchy: 11 items (5 modules, 1 class, 3 functions, 1 interface, 1 method).
- Mixed hierarchy: 36 items (15 modules, 5 classes, 6 functions, 9 methods, 1 type alias).
- Selected details for `RepositoryService`, `RepositoryAnalyzer`, and `TaskService` resolved to their exact declarations and real source spans.

Evidence: `logs/backend-documentation-contract.json`.

### Semantic code search

Root causes:

- The core query path depended on investigation/model behavior even though external provider credentials are optional.
- There was no deterministic local retrieval fallback for clean-clone use, no bounded end-to-end request timeout, and ambiguous active-run selection could cross repository boundaries.
- The frontend did not present a stable ranked-result selection flow and could remain in loading state after a stalled request.

Corrections:

- Added a local source index over parsed symbols/modules and exact source regions. It produces ranked, run-scoped results with evidence and source tabs without an external model.
- Added explicit provider-off behavior so a residual credential does not silently enable a provider.
- Added whitespace validation, a 15-second backend timeout, a matching bounded frontend request, and cleanup that re-enables submission after success or failure.
- Added ranked result selection and normalized relevance display in the question lens.

Recorded backend evidence:

- 20/20 documented requests returned HTTP 200 from the selected run using `local_source_index`.
- Mean measured response time was 14.252 ms and maximum was 23.083 ms in the local TestClient evidence run.
- The documented expected substring appeared in the top five for 16/20 cases.

That last number is **not a semantic-accuracy score**. Manual source audit found only 7 expectations fully supported, 2 partially supported, and 11 contradicted by the immutable fixture source. Examples include nonexistent `Document`, `Parser`, `parse_document`, and `AnalysisService` symbols; an expectation that `src/index.ts` imports the parser when `src/analyzer.ts` does; and mixed-fixture questions about repository analysis or documentation generation where the source implements task creation and reporting instead. Eight literal "successes" were attached to contradicted expectations. The original 20-case oracle cannot validly establish semantic correctness without correction.

Evidence: `logs/backend-semantic-20.json` and `logs/backend-semantic-expectation-audit.json`.

### Persistence, recovery, and duplicate submissions

Root causes:

- The configured SQLite path was advertised but application startup always instantiated the process-local in-memory store.
- The browser store did not persist the completed run ID or repository path.
- Analysis start always generated a new job/run; no atomic normalized-repository claim existed.
- API consumers could fall back to whichever run was active instead of the run selected by the browser.

Corrections:

- Wired the configured SQLite store into non-test startup and added schema initialization for jobs, snapshots, parsed collections, source regions, stages, active run, and schema metadata.
- Restored completed runs on backend startup; interrupted queued/running jobs are restored as failed, keeping failed/incomplete state distinguishable.
- Closed every SQLite connection after work, including the Windows file-handle regression path.
- Persisted completed frontend session identity in Zustand/local storage and propagated it through all core routes.
- Added an atomic `claim_job` using normalized absolute repository identity so only a currently running duplicate is reused. A new completed re-analysis remains possible by design.

Recorded evidence: a real TypeScript fixture was analyzed into a temporary SQLite database, a second application instance opened the same database, and graph (6/6), documentation (5 roots), and query routes all returned the explicitly selected restored run. Evidence: `logs/backend-persistence-restart.json`.

### Clean-copy setup

Root causes:

- The backend package lacked an explicit PEP 517 build-system declaration.
- Setup gave little phase/timing information, and pip used implicit network retry/timeout behavior, so the Phase 2 120-second audit bound could not distinguish resolution, download, build, or installation progress.
- The root documentation mixed canonical and diagnostic startup paths.

Corrections:

- Added an explicit setuptools build backend.
- Added runtime/version checks, numbered setup phases, elapsed times, configurable pip connection timeout/retries, binary preference, non-zero actionable failures, and post-install verification.
- Documented one canonical root startup path, expected first-install duration, service/health URLs, local SQLite behavior, optional external providers, and test/build commands.

A clean-copy setup/start result must be attached before this item is called fixed in the final status.

### Accessibility and navigation

Root causes:

- Several custom controls lacked a visible focus treatment, secondary text tokens had insufficient contrast, and the canvas graph had no keyboard-readable equivalent.
- The analyzed view lacked an appropriate primary heading.
- `Open navigation` rendered a button without a navigation action.

Corrections:

- Added consistent `:focus-visible` treatment, higher-contrast tokens, associated form/error semantics, and analyzed-view heading structure.
- Added a keyboard-accessible graph component/relationship table tied to the same repository data as the canvas.
- Implemented an accessible navigation menu with repository documentation and "Analyze another repository" actions, outside-click and Escape dismissal, and menu semantics.

Automated contrast and keyboard results are pending; the source changes alone are not acceptance evidence.

### QA-006 duplicate orientation 409

Root cause:

- The orientation hook's immediate request and polling lifecycle overlapped, and the invalid-run progress view enabled the orientation read before graph readiness. Both reads correctly encountered a non-ready run and returned 409.

Correction:

- Split immediate fetch and polling effects, guard orientation reads on a completed/renderable run, and recognize terminal status in both WebSocket status and completion packets. The duplicate request regression still requires a visible invalid-path browser run before closure.

## Files changed

### Root setup and documentation

- `README.md`
- `setup-syntax-tree.ps1`
- `syntax-tree-refurbished-backend/pyproject.toml`

### Backend run selection, analysis, graph, docs, search, and persistence

- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/api/app.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/api/run_resolution.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/api/routes/{analyze,architecture_map,docs,flows,query,source,symbols,system_overview}.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/analysis/{analysis_controller,run_store,sqlite_run_store,static_structure}.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/architecture_map/projection.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/overview/system_overview_generator.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/query/{local_search,query_controller}.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/investigation/llm_model.py`
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/config.py`

### Backend tests

- `syntax-tree-refurbished-backend/tests/test_core_workflow_contracts.py`
- `syntax-tree-refurbished-backend/tests/test_sqlite_persistence.py`
- Existing graph, drilldown, health, and overview contract tests updated for deterministic static behavior.

### Frontend core workflow and accessibility

- `syntax-tree-ui/src/api/{client,hooks}.ts`
- `syntax-tree-ui/src/store.ts`
- `syntax-tree-ui/src/features/architecture-map/{ArchitectureMapCanvas,SemanticEdge,apiTypes,lensCache,mapAdapter,useArchitectureLens,useArchitectureMap}.ts*`
- `syntax-tree-ui/src/features/docs-studio/{DocsStudio,SourceCode}.tsx`
- `syntax-tree-ui/src/features/observatory/{ObservatoryEntry,ObservatoryShell,ObservatoryTopBar,types}.ts*`
- `syntax-tree-ui/src/features/question-lens/{UnderstandingPane,useQuestionLens}.ts*`
- `syntax-tree-ui/src/index.css`
- `syntax-tree-ui/package.json` and `package-lock.json`

### Frontend tests

- `syntax-tree-ui/tests/e2e/core-workflows.spec.cjs`
- `syntax-tree-ui/tests/e2e/core-workflows-real.spec.cjs`

## Remaining risks and required validation

1. Required real-browser evidence is pending for graph zoom, pan, node selection, drilldown/back navigation, and repository switching without stale data.
2. Required real-browser evidence is pending for nested documentation refresh, component switching, source rendering, and stale-text prevention.
3. Required real-browser evidence is pending for search loading cleanup, empty/whitespace/unrelated/repeated inputs, selecting the correct result, and active-run isolation.
4. Browser reopen, frontend restart, backend restart, and full application restart have not all been demonstrated through the visible frontend. Backend restart is covered only at the application/API integration layer in the current artifacts.
5. The static extractor evidence covers the supplied Python/TypeScript fixtures. Dynamic imports and some Python absolute-import layouts (for example, repository layouts whose import root is `src/`) remain parser-coverage risks and are not claimed complete.
6. The original semantic 20-query expected-answer list is internally inconsistent with its fixtures; a corrected, source-reviewed oracle is required for a defensible relevance score.
7. Firefox/WebKit principal journeys, accessibility contrast/keyboard checks, and clean-copy startup evidence remain pending.
8. Formal FR/NFR acceptance criteria and targets are absent from the supplied project specification; numbered FR/NFR conformance remains not testable.

No Git history rewrite, credential rotation, commit, push, merge, or unrelated redesign is part of this remediation phase.
