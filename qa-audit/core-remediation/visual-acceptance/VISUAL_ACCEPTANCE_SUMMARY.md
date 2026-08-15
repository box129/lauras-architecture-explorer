# Visual Acceptance Walkthrough

Date: 2026-08-07
Method: standalone Playwright driver (outside the repository working tree, no
repo config added) against the real backend (127.0.0.1:8301) and real frontend
dev server (127.0.0.1:5473), Chromium, 1440x900 viewport. Not a mocked run.

## Video

- File: `video/principal-journey-walkthrough.webm`
- Duration: ~25.8 seconds (confirmed via WebM Duration element)
- File size: 2,848,410 bytes (≈2.8 MB)
- Resolution: 1440x900 (matches `recordVideo.size` and browser viewport)
- Recording completed normally: yes — the driver script reached
  `WALKTHROUGH COMPLETE`, the browser context/browser closed cleanly, and the
  `.webm` file was finalized on disk with a valid Duration element.

**Sanitized replacement (2026-08-07, later same day):** this video supersedes
an earlier recording that used the real absolute fixture paths (see the
"Privacy/sensitivity note" below for what that exposed). It was re-recorded
using two temporary Windows directory junctions created **outside the
repository** and never added to it:
- `C:\qa\typescript-small` → the real `qa-audit/phase-2/fixtures/typescript-small`
- `C:\qa\python-nested` → the real `qa-audit/phase-2/fixtures/python-nested`

Both junctions were verified to resolve and analyze correctly (6/6 files
parsed each) via direct backend API calls before recording. A dedicated
pre-recording check confirmed the repository-path input field renders exactly
`C:\qa\typescript-small` (the neutral string as typed — Playwright's `.fill()`
sets the DOM value directly; server-side junction resolution to the real path
happens only inside backend file I/O and is never echoed back into any
visible UI text). Representative frames from the new recording (repository
selection with the field filled, root graph, drilldown/breadcrumb, Code
Companion, alternate repository) were individually inspected and confirmed
free of any `C:\Users\<username>` path, personal username, credential, token,
or unrelated personal information, while repository fixture/source names
(`typescript-small`, `python-nested`, `src/analyzer.ts`, etc.) remain fully
readable and the complete workflow remains visually understandable. No new
visual defect was introduced by the path change.

The video shows one continuous session covering, in order: the repository
selection screen, filling and submitting the real `typescript-small` fixture
path, the real analysis WebSocket run to completion, the populated root
architecture graph, a zoom-in and a pan drag, an Alt-click + click drilldown
into `src/analyzer.ts` showing its real child symbols, a single click of
"Back to previous architecture lens" (breadcrumb correctly collapsing back to
root), navigation to the documentation hierarchy and a component detail/source
view, a real semantic query with ranked results and evidence, opening Code
Companion / View answer proof with real source loaded, a page reload with the
answer pane state restored, "Analyze another repository", and a full second
analysis of the `python-nested` fixture ending on its own distinct,
visibly-different graph.

## Screenshots

All 10 screenshots below were opened and visually inspected (not just
confirmed to exist). Each is a full-page capture.

| # | Evidence file | Workflow state | Visible proof | Visual defects observed | PASS/FAIL |
|---|---|---|---|---|---|
| 01 | `01-repository-selection.png` | Initial / repository-selection screen | Clean landing page: "What repo do you want to understand?", empty repository-path input with placeholder, "Build architecture map" button, feature cards | None | PASS |
| 02 | `02-analysis-complete-root-graph.png` | Root architecture graph after analysis | `typescript-small` title, run ID badge, 5 real modules (`src/analyzer.ts`, `src/docs.ts`, `src/index.ts`, `src/parser.ts`, `src/types.ts`) with import edges, "5 areas · 6 links", orientation side panel | Minor: a fragment of text ("pt-" + an icon) is partially clipped at the bottom-left viewport edge, behind the floating "Lenses" control. Cosmetic only, no content loss, no functional impact | PASS |
| 03 | `03-architecture-drilldown.png` | Drilldown into `src/analyzer.ts` | Breadcrumb `typescript-small / src/analyzer.ts`, focal header "component · src/analyzer.ts · 2 child areas", both real child symbols visible as nodes (`RepositoryAnalyzer` class, `analyze` method) with source line refs, side panel with full explanation/evidence/dependencies | Same minor bottom-left clipping artifact as #02 | PASS |
| 04 | `04-back-to-root-breadcrumb.png` | After one topbar Back click | Breadcrumb collapsed to `typescript-small` only, root graph restored (same 5 nodes), focal header gone, orientation panel restored — pixel-identical to #02, proving the single-click Back + breadcrumb-reset fix | None | PASS |
| 05 | `05-documentation-hierarchy.png` | Documentation hierarchy | Repository-derived component tree: 5 real modules each expanded with their real child symbols (`RepositoryAnalyzer`, `analyze`, `generateDocumentation`, `startAnalysis`, `parseTypeScript`, `AnalysisResult`), module detail with real Dependencies list and source excerpt beginning | None | PASS |
| 06 | `06-documentation-detail-source.png` | Documentation component detail/source | `CLASS RepositoryAnalyzer`, qualified name, exact declared line range (4-8), real Dependencies (`analyze`, `parseTypeScript`, `AnalysisResult` — all real cross-references), Source section header with correct line range | Source code body is below the fold (page not scrolled) — expected; the automated spec independently verifies actual source text content, not just heading presence | PASS |
| 07 | `07-query-results-evidence.png` | Semantic query results / evidence | Real question answered, `generateDocumentation` top-ranked at 100% relevance, 3 other real ranked candidates with real relevance percentages, Evidence tab showing a source-backed citation at `src/docs.ts:3-5` | None | PASS |
| 08 | `08-code-companion-proof.png` | Code Companion / View answer proof | Real source code loaded and rendered (`export function generateDocumentation(...)`), correct lines 3-5 highlighted, matching the cited evidence span, "100% confidence" | None (re-captured after fixing an initial premature-screenshot timing issue in the walkthrough driver — see note below) | PASS |
| 09 | `09-reload-restored-state.png` | Reload with state restored | Same answer pane, same lens title, same source file/lines restored after a full page reload, from URL + localStorage state | Minor observation: confidence badge reads 39% here vs 100% in #08 for the same lens. Traced to two legitimate, differently-computed fields (`relevance_score` from the query response vs. the lens's own intrinsic `confidence`, per `local_search.py`), not stale/wrong data — but the UI labels both simply "confidence", which is a minor copy/consistency nit worth a future look, not a functional defect | PASS |
| 10 | `10-alternate-repository.png` | Alternate-repository analysis | `python-nested` title, a **different** run ID, 5 different Python-specific modules (`app/__init__.py`, `app/models.py`, `app/parser.py`, `app/service.py`, `main.py`), "5 areas · 5 links", Python-specific orientation file (`pyproject.toml` vs. the first repo's `package.json`) — zero overlap with the first repository's TypeScript content | None | PASS |

**Note on screenshot #08**: the first walkthrough run captured this checkpoint
mid-load (a "Reading source file..." placeholder), because the driver script
only waited a fixed 500ms after opening Code Companion. This was a timing gap
in the *walkthrough script*, not an application defect — the automated
Playwright spec's own `toContainText` assertion on `[aria-label="Code
Companion"]` already independently proves the real content loads correctly.
The driver was corrected to poll for real code content before capturing, and
the full walkthrough was re-run to produce the final, accurate evidence set
reported above.

## Cross-check against automated gate

The same journey exercised by `core-workflows-real.spec.cjs` (Phase 2) matches
what this visual walkthrough shows: non-empty run-specific graph, real
drilldown/children, single-click Back with breadcrumb reset, documentation
hierarchy/detail, query/evidence/proof, reload persistence, and a second,
distinct alternate-repository run — with no stale data, no cross-repository
contamination, no loading/error state left visible after completion, and no
broken layout beyond the one cosmetic clipping note above.

## Privacy/sensitivity note (resolved)

The **screenshots** never showed a filled or focused repository-path field, so
no local filesystem path was ever visible in any retained `.png` — unchanged
by this update. The **video** originally exposed the real absolute local
workspace path (including the local Windows profile name) during the ~1-2
seconds the repository-path field was typed into, twice. This has been
resolved: the retained video above was
re-recorded through the neutral `C:\qa\...` junction paths described above and
contains no local Windows path, username, credential, token, or unrelated
personal information. The prior (unsanitized) recording was deleted, not
retained alongside this one.
