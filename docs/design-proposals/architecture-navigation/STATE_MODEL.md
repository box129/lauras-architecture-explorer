# Four-State Navigation Model

Non-authoritative UX design, grounded in current data contracts (see `DATA_MAPPING.md`). No
product source changed to produce this document.

## State-transition diagram

```
                         ┌───────────────────────────────┐
                         │  STATE 1 — OVERVIEW            │
                         │  (1A clustered / 1B domain-    │
                         │   card, see OVERVIEW_COMPARISON)│
                         └───────────────┬─────────────────┘
                                         │ select a group/area (click / Enter)
                                         ▼
                         ┌───────────────────────────────┐
              ◄──────────┤  STATE 2 — AREA DRILL-DOWN     │
              Back        │  focused subgraph of one group │
                         └───────────────┬─────────────────┘
                                         │ select an entity (module/symbol)
                                         ▼
                         ┌───────────────────────────────┐
              ◄──────────┤  STATE 3 — ENTITY FOCUS        │
              Back        │  local neighborhood + panel    │
                         └───────────────┬─────────────────┘
                                         │ open an architectural statement
                                         ▼
                         ┌───────────────────────────────┐
              ◄──────────┤  STATE 4 — STATEMENT/EVIDENCE/ │
              Back        │  SOURCE                        │
                         └─────────────────────────────────┘

Breadcrumb (persistent, all states below Overview):
  Overview  >  [Area]  >  [Entity]  >  [Statement]
  Any earlier crumb is clickable and truncates the stack to that point.

Back (persistent, all states below Overview): always returns exactly one
state up the stack above, never skips a level, never changes meaning
depending on where the user is (see "Back strategy" below — this is a
target property, not yet true of the current four-affordance codebase).
```

## State 1 — Overview

**Purpose.** Orient the user to the repository's shape before committing to a direction. This
is the state Participant #1 failed to read as "an architecture" rather than "a pile of boxes."

**Visible entities.** Either (1A) existing per-file/per-module `ArchitectureMapNode`s
deterministically clustered by containing directory, rendered as smaller cards inside a
labeled cluster container; or (1B) fewer, larger cards — see `OVERVIEW_COMPARISON.md` for which
is recommended and why. Either way, entities visible here are exactly the level-1 nodes the
backend already returns from `GET /api/architecture-map`; nothing new is fabricated by this
state on its own.

**Visible edges.** Group-to-group edges only if defined per the deterministic aggregation rule
in `DATA_MAPPING.md`'s "group-to-group edge" row; otherwise omit inter-group edges at this
level and rely on drill-down to reveal real edges (avoids inventing a "the groups relate"
claim the data can't back).

**Right-panel behavior.** No entity selected by default: panel shows repository-level stats
already returned by the API (`repo_identity.file_count`, node/edge counts,
`diagnostics.verified_node_count`/`insufficient_node_count`/`unsupported_node_count`). On
hover/focus of a group (not yet entered): member count and up to N representative member
labels — real node labels, not synthesized prose.

**Allowed interactions.** Single click or Enter/Space on a group card enters State 2. Click on
"View as accessible tables" expands the existing table alternative unchanged. No double-click
requirement.

**Breadcrumb.** `Overview` only (no Back control shown — this is the root state).

**Back behavior.** Not shown; Overview is the floor of the stack.

**Transition in.** Initial load of an analysis run, or clicking the `Overview` breadcrumb
crumb from any deeper state.

**Transition out.** Selecting a group/area → State 2.

**Accessibility equivalent.** The existing `<details>` accessible-table overlay
(`ArchitectureMapCanvas.tsx:128-212`), scoped to level-1 nodes, reusing the same `onEnterNode`
row-button semantics already proven not to regress (per its own test file's documented Phase-2
bug fix).

## State 2 — Area drill-down

**Purpose.** Let the user answer: *where am I, what belongs here, how do I go deeper, how do I
get back.*

**Visible entities.** The selected group's children — real `ArchitectureMapNode`s returned by
`GET /api/architecture-map/nodes/{group_id}/children`. For a directory-grouped area (1A/Hybrid)
these are the files within that directory (or, one level further, top-level symbols within a
single file if the group *is* a file). Reduced graph scope by construction — the endpoint
already filters to one parent's children.

**Visible edges.** Real edges among the visible children only (`contains`, `imports`, or
resolved `calls`/`inherits` from `ObservedProgramRelation` at the symbol level) — never edges
to nodes outside the current scope; those are reachable only by entering that node's own
drill-down.

**Right-panel behavior.** Selected area's `description`/`summary` (from `OverviewComponent` or
`LensChildComponent`), `evidence_count`, `children_count`, and (if the component came from an
LLM lens) its `responsibilities` list — every field with a byline back to
`ArchitectureMapNode.confidence`/`status` so "map confidence" and "evidence status" render as
visually distinct elements per the project's standing convention (`design/mapConfidence.ts`).

**Allowed interactions.** Single click/Enter on a child → State 3 (module/entity) or, if the
child itself `can_drilldown`, another State-2 level (nested area). Zoom/fit/mini-map are
presentation-only additions (classification D) layered onto the existing canvas.

**Breadcrumb.** `Overview > [Area label]`.

**Back behavior.** Returns to State 1, preserving the last-scrolled/zoomed overview position if
feasible (presentation-only enhancement, not required for correctness).

**Transition in.** Selecting a group card from State 1, or a nested area from another State 2.

**Transition out.** Selecting an entity → State 3; Back/breadcrumb → State 1 or an ancestor
area.

**Accessibility equivalent.** Same accessible-table pattern, scoped to
`GET .../children`'s response for the current node — this endpoint already exists and is
already table-renderable with no new backend work.

## State 3 — Entity focus

**Purpose.** Make one module/symbol dominate the view, with only directly relevant neighbors
visible, and make its Architectural Explanation naturally reachable.

**Visible entities.** The selected entity node, its immediate dependencies/dependents
(one-hop, from real `ArchitectureMapEdge`s or resolved `ObservedProgramRelation`s), and its
containing area (breadcrumb, not necessarily rendered as a graph node). This is already close
to what `ArchitectureMapProjector._symbol_children`/`_module_children` and the entity's own
`source_refs` provide; a "neighborhood" query (dependencies ∪ dependents, one hop) is new but
purely deterministic graph-traversal code (classification B), not new inference.

**Visible edges.** Only edges touching the selected entity.

**Right-panel behavior.** `ArchitecturalExplanationPanel` content as it exists today: the
legend ("the model proposes, Laura's verifies"), narrative text, and the list of
`ArchitecturalClaim` cards for this entity (`POST /api/entities/{id}/architectural-explanation`
— already implemented, already wired to this panel).

**Allowed interactions.** Single click/Enter on a neighbor → re-centers State 3 on that
neighbor (does not push a new breadcrumb level unless the neighbor is in a different area).
Click on an `ArchitecturalClaim` card → State 4.

**Breadcrumb.** `Overview > [Area] > [Entity label]`.

**Back behavior.** Returns to the parent State 2 (the entity's containing area), exactly the
behavior `useArchitectureLens.goBack()` already implements (`useArchitectureLens.ts:269-277`).

**Transition in.** Selecting an entity from State 2 (or from Overview directly, if a
file-level node has no meaningful further drill-down and is itself the entity).

**Transition out.** Selecting a claim/statement → State 4; Back/breadcrumb → State 2 or an
ancestor.

**Accessibility equivalent.** The explanation panel is already a normal DOM list, not a canvas
element — inherently accessible. The one-hop neighborhood graph needs its own accessible-table
row (new, small, same pattern as State 1/2's table).

## State 4 — Architectural statement / evidence / source

**Purpose.** Preserve continuity from *what entity* → *what statement* → *what evidence* →
*where in source* → *how to get back*, without ever implying a whole narrative paragraph is
verified when only its structured proposition is.

**Visible entities.** The single `ArchitecturalClaim` under inspection: its `statement` text,
its `support_status` (`supported`/`insufficient_evidence`/`contradicted` — all three are real,
reachable outcomes of `verify_proposition`, not aspirational), and its ordered `EvidenceChain`
items, each resolving to a `SourceRegion` (`path`, `start_line`, `end_line`).

**Visible edges.** N/A — this state is not a graph view; it is claim → evidence list → source
pane, matching the existing `EvidenceItemRow`/source-overlay pattern.

**Right-panel/main-panel behavior.** Retain the existing split: evidence chain list (with the
existing "Technical details" disclosure for raw provenance) alongside the source viewer, which
must preserve exact line highlighting (`goToCode(path, start_line, end_line)` — unchanged).

**Allowed interactions.** "Open source" per evidence item (already implemented, already
disabled with an explicit message when no `source_region_id` exists —
`EvidenceItemRow.tsx:10`, `NO_SOURCE_COPY`). Back returns to State 3 with the same entity still
focused (no loss of "what was I investigating" context).

**Breadcrumb.** `Overview > [Area] > [Entity] > [Statement]` (statement crumb may show a
truncated statement text rather than a full sentence).

**Back behavior.** Returns to State 3, entity still selected — this is the one state where
"return to the prior graph state" must be exact, since evidence review is where a user is most
likely to want to compare multiple claims about the same entity in sequence.

**Transition in.** Selecting a claim card from State 3.

**Transition out.** Back → State 3 (same entity). Breadcrumb clicks → any ancestor state.

**Accessibility equivalent.** Evidence chain is already a DOM list; source viewer already
supports keyboard-reachable "Open source" buttons per evidence item. No new non-canvas
representation is needed here since nothing in this state is canvas-rendered.

## Navigation model notes (applies to all states)

- **One Back, not four.** Today there are four distinct Back-like affordances (top-bar
  ArrowLeft/hamburger toggle in `ObservatoryTopBar.tsx:55-66`, entity-panel "Back to parent" in
  `ObservatoryShell.tsx:523`, Doc Studio's own textual "← Back to Observatory" in
  `DocsStudio.tsx:147,303`, and the just-fixed code-viewer Back in
  `ObservatoryShell.tsx:572-579`). The four-state model requires these to converge on one
  visual pattern and one semantic (`goBack()`-style: pop exactly one state), even though the
  underlying components may remain separate files. This is presentation/interaction work
  (classification D) but is explicitly called out because "one consistent navigation model" is
  a stated requirement, not a nice-to-have.
- **Breadcrumbs already exist** (`BreadcrumbTrail.tsx`, `ArchitectureLensCrumb[]`) and already
  support click-to-truncate (`goToBreadcrumb`, `useArchitectureLens.ts:260-267`). Extending them
  to a fixed four-segment shape (Overview/Area/Entity/Statement) is additive, not a rewrite.
- **Browser Back**: current lens state persists to the URL (`lensUrlState.ts`) — browser
  Back/Forward already has a hook point; verifying it walks the four states correctly (rather
  than only area-level lens pushes) is an explicit test requirement for Phase A.
