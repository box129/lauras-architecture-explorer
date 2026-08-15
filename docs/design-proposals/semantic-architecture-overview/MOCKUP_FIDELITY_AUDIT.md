# Mockup-Fidelity Audit — Phase B vs. the Five Frozen Concepts

Design-only document. No product source was changed to produce this file.
Compared: the five PNGs in `docs/design-proposals/architecture-navigation/`
against Phase B as implemented at `fdd77aa`, using
`qa-audit/architecture-navigation-phase-b/screenshots/` and a fresh
inspection of `LensNode.tsx`/`mapLayout.ts`/`ArchitectureMapCanvas.tsx`/
`RepoOrientationPanel.tsx`.

Be candid: **Phase B does not visually resemble the mockups.** It restored
truthful grouping and correct navigation mechanics, but the mockups'
central visual idea — large enclosing regions containing nested content —
was never attempted. Every group card in Phase B is a peer card in a flat
grid, exactly like the pre-Phase-B file cards were, just fewer of them and
slightly bigger.

| Design element | Mockup intent | Current implementation | Fidelity | Reason for deviation | Restore next? |
|---|---|---|---|---|---|
| Large enclosing grouped regions | 01a/01b: a big bordered container literally surrounds its members | `LensNode.tsx`'s `.obs-rf-node--group` is one bigger flat card, not a container that visually surrounds other cards | **MISSING** | Phase B scope was explicitly bounded to "the existing flat grid layout, no ReactFlow layout-algorithm change beyond bounded work" (IMPLEMENTATION_PLAN.md's own Phase B scope note) | YES |
| Nested visual hierarchy (region → sub-region → module) | 01a nests module cards inside domain boxes; the desired repo tree is 3+ levels deep visually at once | Phase B is one flat level at a time — Overview shows groups OR (after a click) that group's direct children, never both at once | **MISSING** | Same scope boundary; Phase A's existing one-level-at-a-time drill-down was reused unmodified | YES |
| Top-level object count | 01b: 8 domain cards for an 83-module repo (~10:1 compression) | 3 groups for Flask's 24 modules (8:1) — comparable ratio, but see "nested hierarchy" above; a JS/TS-heavy repo like `topic-similarity-mvp` still leaves one 50-file flat wall (`services/`) | **PARTIAL** | Directory-only grouping has no second level to further compress a flat directory | YES (needs Layer 2 relation clustering, see INFORMATION_MODEL.md) |
| Group cards vs. module cards | 01b: domain cards are visually a different *class* of object (bigger, bordered, member list) from a module row inside them | Phase B group cards ARE visually distinct (`.obs-rf-node--group`, `FolderTree` icon, larger footprint) — this part *was* built | **MATCHES** | — | keep |
| Group labels | 01b: human-readable domain names ("Core Runtime", "Request Handling") | Literal directory paths (`"json"`, `"sansio"`, `"Repository root files"`) | **INTENTIONALLY REJECTED** | Deliberate, documented epistemic decision — the mockup's names are LLM/hand-authored and explicitly flagged non-reproducible deterministically (`OVERVIEW_COMPARISON.md`) | Restore via Layer 3 AI label, never as ground truth (see AI_INTERPRETATION_SPEC.md) |
| Representative members | 01b: "src/flask/wrappers.py, src/flask/ctx.py, src/flask/sansio/app.py, + 9 more" | Present, same shape (`"Contains: a.py, b.py, +N more"`) | **MATCHES** | — | keep |
| Relationship lines | 01a: solid arrows between domain boxes (primary flow) + dashed (config/shared) | **None visible** — Phase B's Overview edge strategy is deliberately NONE (see Phase B REPORT.md §9); canvas watermark reads "0 links" | **INTENTIONALLY REJECTED** at Overview | Correct epistemic call — no deterministic group-to-group edge rule exists; inventing one would be exactly the risk the design docs warned against | Only restore if/when a defined aggregation rule exists (Phase C2 territory, not free) |
| Relationship lines (drill-down) | 02: real directed dependency graph inside a domain (`app.py → routes.py`, dashed `ctx.py ↔ app.py`) | Group drill-down (State 2) shows member cards with **zero edges** — `_group_children()` explicitly returns `(), ()` | **MISSING** | Real, honest gap — Phase B never wired child-level import/call edges into group drill-down at all | YES |
| Semantic descriptions | 01a/02: "Handles incoming HTTP requests, dispatches them..." | Template sentence ("Repository section 'X', containing N module(s)...") | **INTENTIONALLY REJECTED** as *semantic* prose; present as *structural* prose | Correct — mockup prose is LLM-authored; a template sentence about real counts is the honest substitute | Restore real semantic prose only via Layer 3, clearly marked |
| Contextual right panel | 01b/02/03: panel content changes with selection — domain "What it does"/"Why it matters"/"Key modules" | Phase B's *default* (nothing selected) right panel is `RepoOrientationPanel.tsx` — repo-wide "Snapshot orientation"/README guidance, unrelated to whatever group is on screen; it DOES change correctly once a group/entity is actually selected | **PARTIAL** | The unselected-state panel was never redesigned for Phase B's new grouped Overview — it's Phase A's leftover default | YES (see RIGHT_PANEL_SPEC.md) |
| Breadcrumb | present in all 4 mockup states | Present, correct (`flask > sansio > sansio/app.py > _make_timedelta`) | **MATCHES** | — | keep |
| Back | single consistent control in all states | Present, unified (Phase A) | **MATCHES** | — | keep |
| Entity Focus | 03: centered entity + real dependents/dependencies, each tagged with a colored domain chip | Present, centered + real one-hop neighbors (Phase A); no domain-membership chip on neighbor cards | **PARTIAL** | Domain-chip-on-neighbor was never in Phase A/B scope | nice-to-have, not required |
| Mini-map / zoom / fit | 02/04: persistent mini-map, zoom controls | Present (`<MiniMap>`/`<Controls>` in `ArchitectureMapCanvas.tsx`) | **MATCHES** | — | keep |
| Selected state | all mockups | Present (`.obs-rf-node--selected`, right panel updates) | **MATCHES** | — | keep |
| Evidence/source continuity | 04: claim → evidence chain → highlighted source, Back returns to same entity | Present (Phase A's existing State 4 flow, unmodified by Phase B) | **MATCHES** (structurally) | — | keep |
| Exact source highlighting | 04: line-range highlight in a real code viewer | Present (`goToCode`, unchanged) | **MATCHES** | — | keep |
| "Architecture map (context)" mini-graph inside Evidence view | 04: small graph panel showing the claim's file in its surrounding context, to the left of the claim | **Not present** — no dedicated context-graph panel inside the evidence surface today | **MISSING** | Never built in any phase; not part of Phase A's or B's scope | nice-to-have, low priority relative to C1–C3 |
| Accessible equivalent | implicit requirement across all states | Present, mirrors canvas state including groups (new "Members" column added in Phase B) | **MATCHES** | — | keep |
| AI contribution visibility | not shown in any of the 5 mockups (they predate this question) — but the *product* needs it now | **Absent everywhere in the current Overview/grouping flow** — the only visible AI surface is the entity-only Architectural Explanation panel, several clicks away from any group | **MISSING** (new requirement, not a mockup regression) | This is exactly Participant #2 finding P2-B | YES — this is the primary addition this design pass makes (Layer 3) |

## Most important reason for the visual divergence

Phase B's own scope note in `IMPLEMENTATION_PLAN.md` explicitly bounded
itself to *"remove/relax the flat 40-node cap... no ReactFlow layout-
algorithm change beyond bounded work necessary for the grouped Overview."*
Phase B correctly solved the **epistemic** problem (truthful grouping, no
invented categories) but never attempted the **spatial/containment**
problem the mockups are actually built around (regions that visually
contain their members, at more than one level simultaneously). Those are
two different problems, and only one was in scope. This document's
recommendation (§9 of the parent request, `DESIGN_PRINCIPLES.md`) is that
the spatial problem is now solvable natively by the ReactFlow version
already in the codebase (`@xyflow/react@12.10.2`, which ships `parentId`/
`extent:'parent'` sub-flow support) — it was not a library limitation, it
was a scope limitation.
