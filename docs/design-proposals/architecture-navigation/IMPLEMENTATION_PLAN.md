# Implementation Plan (bounded, phased — not executed in this pass)

No code was written for this plan. File lists are best-effort based on the current module
layout observed during this review; actual PRs should re-verify paths at implementation time.

## Phase A — Navigation / progressive disclosure

**Goal.** Establish the four-state navigation shape without changing any architectural
semantics or grouping logic — i.e., ship the *shape* of Overview → Area → Entity → Evidence
using exactly today's data (flat file-level overview, real children/evidence endpoints),
before touching how Overview is grouped.

**Scope.**
- Unify the four existing Back affordances into one visual/interaction pattern.
- Extend `BreadcrumbTrail`/`ArchitectureLensCrumb` to a fixed four-segment shape including a
  Statement segment (new — evidence/source currently has no breadcrumb entry).
- Add a one-hop neighborhood query for Entity Focus (dependencies ∪ dependents), backend
  traversal only, no new node/edge types.
- Preserve the accessible-table alternative at every state.
- Verify browser Back/Forward walks all four states via the existing `lensUrlState.ts` hook.

**Frontend files likely affected.** `features/architecture-map/useArchitectureLens.ts`,
`ObservatoryTopBar.tsx`, `ObservatoryShell.tsx`, `BreadcrumbTrail.tsx`, `docs-studio/
DocsStudio.tsx` (back-link unification), `ArchitectureMapCanvas.tsx` (table scoping per state).

**Backend files likely affected.** `app/architecture_map/projection.py` (new neighborhood
query method), `api/dto/architecture_map.py` (response shape for a neighborhood), `api/routes/
architecture_map.py` (new endpoint or query param).

**New API/data contract needs.** One new read endpoint or query parameter for "one-hop
neighborhood of node X" — purely additive, no schema break.

**Test requirements.** Navigation state-machine tests (one per state transition), breadcrumb
truncation tests, back-button unification tests (assert one shared component/handler, not
four), browser Back/Forward integration test.

**Migration risk.** Low — no data model change, only routing/state consolidation.

**Research-semantic risk.** None — this phase touches no claim/verification/proposition code.

**Expected UX benefit.** Directly answers Participant #1's "relied heavily on one learned Back
affordance and became frustrated when navigation appeared inconsistent."

**Relative complexity.** MEDIUM.

## Phase B — Graph hierarchy / visual grouping

**Goal.** Make the Overview state visually comprehensible using only existing deterministic
truth — the Hybrid overview from `OVERVIEW_COMPARISON.md`.

**Scope.**
- Generalize `app/architecture_map/structural_fallback.py`'s directory-grouping algorithm from
  "empty-`main_components` fallback only" to "primary Overview grouping whenever components are
  file-shaped" (i.e., every `OverviewComponent.kind == "module"`).
- New Overview-level node type or response field distinguishing a directory-group container
  from a leaf component, so the frontend can render Option B-style cards without conflating
  grouped and ungrouped nodes.
- Frontend: cluster-container rendering, collapsed-by-default groups, group member count and
  representative-file display, removal or relaxation of the current hard 40-node visible cap
  (`mapAdapter.ts`'s `visibleSourceNodes.slice(0, 40)`) now that grouping reduces top-level
  count.
- If a deterministic group-to-group edge aggregation rule is adopted, implement it exactly as
  documented in `DATA_MAPPING.md` (explicit source/target member sets, relation kinds included,
  directionality preserved, unresolved relations excluded from "proven" edges).

**Frontend files likely affected.** `features/architecture-map/mapAdapter.ts`,
`mapLayout.ts`, `ArchitectureMapCanvas.tsx`, `LensNode.tsx` (or a new `GroupNode.tsx`),
`features/observatory/types.ts` (new `ObservatoryNode` shape for a group container).

**Backend files likely affected.** `app/architecture_map/structural_fallback.py` (generalize),
`app/architecture_map/projection.py` (route group-container nodes into the main projection,
not only the fallback branch), `core/models/architecture_map.py` (possible new `kind` value
for a group container, distinct from `structural_package`/`structural_module` if semantics
differ), `api/dto/architecture_map.py`.

**New API/data contract needs.** A `kind` value (or boolean flag) distinguishing a
group-container node from a real entity node, so the frontend never treats a synthetic
grouping as if it were an analyzed symbol/file.

**Test requirements.** Grouping algorithm unit tests (directory boundary cases: root-level
files, single-file "directories," deeply nested trees), snapshot test confirming group titles
are literal path fragments (guards against future reintroduction of synthesized names), edge-
aggregation rule tests if implemented.

**Migration risk.** Medium — changes what Overview renders for every existing analysis run;
needs a compatibility check against any cached `ArchitectureMapProjection` (`store.
get_architecture_map`/`put_architecture_map` caching keyed on `overview_input_hash` — a schema
change here likely needs a cache-key bump, same pattern already used for
`GenerationMode`/`prompt_version` elsewhere in this codebase).

**Research-semantic risk.** None — purely a presentation/grouping layer over existing
deterministic facts, so long as Phase B strictly avoids the `_architecture_label`/
`_child_label`/live-LLM component-hypothesis paths for card titles.

**Expected UX benefit.** Directly reduces Overview density and reintroduces "categorization"
Participant #1 could not find — truthfully.

**Relative complexity.** LARGE (touches the map projection's core structure and its cache key).

## Phase C — Contextual inspector / evidence continuity

**Goal.** Preserve architectural context as the user moves from map → explanation → evidence →
source, per State 3/4's design in `STATE_MODEL.md`.

**Scope.**
- Contextual right-panel content for Area/Entity states as specified in `DATA_MAPPING.md`
  (only real fields; explicit "not available" state for directory-grouped areas with no
  `summary`).
- Statement breadcrumb segment (new — see Phase A) actually wired to State 4 entry/exit.
- Consolidate the two existing "reveal source" surfaces
  (`EvidenceItemRow`→`goToCode`→code overlay, and `CodeCompanion`'s `openProof`) so State 4 has
  one coherent source-reveal path rather than two overlapping ones — this is a UX audit finding
  discovered during this review, not something the mockups called out; flag for design
  confirmation before implementation.
- Map-confidence vs. claim-status visual separation carried through every new panel
  (already-established convention, must not regress).

**Frontend files likely affected.**
`features/architectural-explanation/ArchitecturalExplanationPanel.tsx`, `ClaimCard.tsx`,
`EvidenceChainView.tsx`, `EvidenceItemRow.tsx`, `features/code-companion/CodeCompanion.tsx`,
`ObservatoryShell.tsx` (surface consolidation).

**Backend files likely affected.** None expected — Phase C is presentation-only over the
already-live `POST /api/entities/{id}/architectural-explanation` and
`GET /api/source-regions/{id}` contracts.

**New API/data contract needs.** None.

**Test requirements.** Continuity tests (open a claim, open its evidence, hit Back, confirm the
originating entity is still selected/focused — this is the exact scenario State 4's design
calls out as needing to be exact). Regression tests for the M3 "architectural statement"
terminology and the map-confidence/claim-status visual separation.

**Migration risk.** Low.

**Research-semantic risk.** None, provided Phase C only reshapes presentation and never touches
`verify_proposition`, `ClaimProposer`, or the proposition vocabulary — explicitly out of scope
per the task's research boundary.

**Expected UX benefit.** Closes the "does the user still know what they were investigating"
gap called out for State 4, and resolves the two-source-viewer duplication before it compounds.

**Relative complexity.** MEDIUM.

## Explicitly deferred (not part of any phase above)

- Any semantic/LLM-backed domain naming (Option B literal names) — flagged for research review,
  not ordinary UX work, per `OVERVIEW_COMPARISON.md`.
- Narrator/"Play Guide" integration into the four-state model — it currently lives entirely
  outside Observatory, driven by a separate legacy overview/subsystems/violations API
  (`components/architecture/Narrator.tsx`, only mounted via the `/legacy` route). Porting it
  onto the Observatory/architecture-map data model is a separate, larger effort; for this pass,
  the only conclusion is that Narrator has no current surface area in the proposed states and
  should not be assumed to "just work" there.
- Numeric confidence display on `ArchitecturalClaim` — the field exists but is always `None`
  today; do not add UI for it until the verifier actually populates it (research work, out of
  scope here).
