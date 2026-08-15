# Architecture Navigation — Phase A Acceptance

Bounded implementation of Phase A from `docs/design-proposals/architecture-navigation/IMPLEMENTATION_PLAN.md`:
navigation/state-machine foundation for the Overview → Area → Entity Focus → Evidence model, on top of
today's deterministic data (no Phase B grouping, no Phase C inspector redesign, no new architectural
inference). Verified live against the pinned Flask repository
(`lauras-gt-r2-flask/research/real-repo-pilot/repos/r2-medium/source/src/flask`) through the real running
backend + frontend, not just automated tests.

## What changed

**Backend** (`syntax-tree-refurbished-backend`):
- New `GET /api/architecture-map/nodes/{node_id}/neighborhood` route, `ArchitectureMapNeighborhoodResponse`
  DTO, and `ArchitectureMapProjector.neighborhood()` — a one-hop neighborhood (dependencies ∪ dependents)
  computed from real `ObservedProgramRelation` facts (`app/analysis/run_store.get_relations`), independent
  of parent/child containment. Relations with no real `target_entity_id` (fully unresolved, or partial with
  no entity match) are skipped entirely rather than upgraded to a definite neighbor. Edge confidence is
  passed through unchanged: `None` for a `resolved` relation, the real value for `partial`/`unresolved`.
- Two new backend tests (`test_node_neighborhood_returns_real_one_hop_relations`,
  `test_node_neighborhood_404_for_unknown_node`) using the same real-analysis-pipeline fixture pattern as
  the file's existing tests — no hand-fabricated relation objects.

**Frontend** (`syntax-tree-ui`):
- `useArchitectureLens.ts`: browser history integration (`pushObservatoryUrlState` on every user-initiated
  navigation, a `popstate` listener reconciling lens state when the browser's own Back/Forward is used,
  instead of only `replaceState`); new Entity Focus data (`entityFocusLandscape`/`entityFocusLoading`/
  `isEntityFocus`), fetched via the new neighborhood endpoint only when the selected node is a genuine
  child selection, not the scope's own just-entered focal node.
- `mapAdapter.ts` / `mapLayout.ts`: `adaptArchitectureNeighborhood` + `layoutEntityFocusNodes` — builds the
  bounded Entity Focus graph (selected entity centered, dependents left, dependencies right, matching real
  edge direction) from the neighborhood response.
- `ObservatoryShell.tsx`: swaps the canvas to the Entity Focus landscape when active; a single `unifiedBack`
  (Evidence → Entity → Group → Overview, one level per press, used by both the topbar Back and the entity
  panel's "Back to parent") replacing the old `goBackLens`/`goBack` split; a unified breadcrumb appending
  Entity and Evidence segments on top of the existing Overview/Area crumbs; a `popstate` handler
  reconciling the Evidence (proof) panel the same way.
- `proofUrlState.ts`: evidence open/close now pushes a history entry (was `replaceState`) so Evidence is a
  real, browser-Back-reachable state.
- `BreadcrumbTrail.tsx`: crumbs carry an optional `title` for the full untruncated label (accessible name /
  hover) when the visible label is truncated.
- `ObservatoryTopBar.tsx`: Back button's accessible name changed from "Back to previous architecture lens"
  to "Back", since it now pops any of the four levels, not only a lens/area level.

No changes to `verify_proposition`, `ClaimProposer`, the proposition vocabulary, or any research-semantic
code.

## Live acceptance walkthrough (real browser, pinned Flask repo)

repository → Overview (24 modules) → app.py (Group) → Flask class (Group, 35 methods) →
`full_dispatch_request` (Entity Focus) → Architectural Explanation → Evidence tab → `app.py:992-1019`
source open (Evidence) → Back → same entity (`full_dispatch_request`) still focused → Back → Back →
prior Group scope → Back → Overview; separately, browser Back/Forward walked the same stack.

Observed and confirmed:
- **Entity Focus is genuinely bounded**: selecting `full_dispatch_request` narrowed the canvas from
  Flask's 35 methods to exactly 6 nodes / 5 edges — the entity itself, its one dependent (`wsgi_app`,
  edge pointing in) and its four dependencies (`preprocess_request`, `dispatch_request`,
  `handle_user_exception`, `finalize_request`, edges pointing out) — matching the real `calls` relations
  in `app.py`. See `screenshots/02-entity-focus-full_dispatch_request.jpg`.
- **Accessible table stays in sync**: with Entity Focus active, "View architecture as accessible tables"
  showed the identical 6 areas / 5 relationships, not the full 35-method scope. See
  `screenshots/04-accessible-table-entity-focus-scope.jpg`.
- **Relation truthfulness preserved**: all five `calls` edges show map confidence "Not supplied" (a
  `resolved` relation correctly carries no confidence value, not a fabricated percentage).
- **Back is unified and predictable**: four consecutive Back presses walked Evidence → Entity → Group
  (Flask) → Group (app.py) → Overview, one level each, from both the topbar control and the entity
  panel's "Back to parent" (same `unifiedBack`).
- **Breadcrumb reflects real state at every level** and is click-navigable; the Evidence crumb reads as a
  distinct `app.py:992` locator rather than duplicating the Entity crumb's label (fixed during this pass
  after first observing the duplication live — see Notes).
- **Browser Back/Forward matches in-app Back**: a real browser Back press from the Entity Focus state
  landed on Overview (not outside the app); Forward restored the Entity Focus state. A hard page refresh
  mid-flow restored the exact same lens/entity/evidence state from the URL.
- **Evidence/source continuity intact**: opening evidence for `full_dispatch_request` showed
  `app.py:992-1019` with the SUPPORTED/INSUFFICIENT EVIDENCE legend ("the model proposes... Laura's
  verifies") still present and unmodified; no live LLM is configured in this dev environment, so no
  SUPPORTED claim was available to click through end-to-end — this is expected, honest behavior
  (`fallback no llm` badge, "No architectural statements were returned for this entity"), not a defect.
  See `screenshots/03-evidence-source-open.jpg`.
- **Map-confidence vs. evidence-status stayed visually distinct** throughout (e.g. "100% map confidence"
  chip separate from the "Verified" status badge on every panel).

## Notes / minor findings from this pass (fixed, not deferred)

- First live pass showed the Evidence breadcrumb crumb duplicating the Entity crumb's label (both read
  "full_dispatch_request"), because the default proof-selection `title` is usually just the parent
  entity's own label. Fixed by preferring a `file:line` locator (or the evidence's own `reason` text) for
  that specific crumb.
- Confirmed `syntax-tree-ui/src/features/observatory/ObservatoryCanvas.tsx` (the component the earlier
  feasibility review's "hard 1040px width" finding referred to) is dead code — not imported anywhere,
  not the live map surface. The live map (`ArchitectureMapCanvas.tsx`, ReactFlow-based) has no such
  constraint; verified no clipping of Back/breadcrumb/canvas controls at 1366×768 and 1280×720.
- Drilling into a component with many children (Flask's 35 methods) is visibly slow to render (multiple
  10+ second waits observed) — pre-existing ReactFlow layout cost, not introduced by this phase and not
  something Phase A's scope covers; flagged for a future performance pass.

## Test results

- Backend: `python -m pytest` — 536 tests, all passing (2 new: neighborhood-returns-real-relations,
  neighborhood-404-for-unknown-node).
- Frontend: `vitest run` — 75 tests, all passing (13 new: `mapAdapter.test.ts` Entity Focus adapter
  coverage, new `lensUrlState.test.ts` push-vs-replace/round-trip/popstate coverage).
- `tsc -b`: clean. `eslint .`: clean. `vite build`: succeeds.

## Explicitly not done in this pass

- Phase B (directory-grouping Overview clustering) — not implemented.
- Phase C (contextual inspector redesign, source-reveal-surface consolidation) — not implemented.
- No change to research semantics: `verify_proposition`, `ClaimProposer`, proposition vocabulary,
  SUPPORTED/INSUFFICIENT EVIDENCE/CONTRADICTED meanings all untouched.
- No architectural inference added: the neighborhood endpoint is a pure filter over existing
  `ObservedProgramRelation` facts, with unresolved/no-entity relations explicitly excluded.
- Participant #2 was not started; no formal A/B/C study material touched; no frozen tag moved.
