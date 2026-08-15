# Implementation Plan — Phases C1–C5

Design-only document. No code was written to produce this plan; file lists
are best-effort based on the current module layout and must be
re-verified at implementation time (same caveat the frozen Phase A/B
`IMPLEMENTATION_PLAN.md` already carries). **Five separate bounded phases,
five separate commits — do not bundle.**

## Performance / scale model (cross-cutting, applies to all phases)

| Repo size | Expected behavior |
|---|---|
| ~20 modules | Likely stays flat/ungrouped or one shallow level — Phase B's existing `MIN_SECTIONS_FOR_GROUPING` threshold already handles this; nested containers add negligible cost (few nodes total). |
| ~200 modules | Typical case this design targets (both Flask and `topic-similarity-mvp` are in/near this range). 2-level nesting (Layer 1 + Layer 2) with the progressive-disclosure caps from `STATE_1_OVERVIEW.md` (depth-1 default expansion, 6-child collapse threshold) keeps simultaneously-rendered nodes in the low dozens, comparable to or better than Phase B's already-measured 29ms/41ms Overview/drill-down timings. |
| ~2,000 modules | Requires strict enforcement of the collapse caps — nothing beyond depth-1 may auto-expand, and Layer-2 clustering (Phase C2) must itself be capped (e.g. skip clustering a directory above some file-count ceiling, or sample) to avoid O(n²)-shaped relation-density computation on a huge flat directory. This is a real, not-yet-measured risk — Phase C2's own test plan (below) must include a synthetic 2,000-file fixture before this phase is considered complete, not just Flask/`topic-similarity-mvp`-scale fixtures. |

No performance optimization is implemented by this document; this table
only sets the expectation each phase's own test plan must verify against.

---

## Phase C1 — Nested structural containment visualization

**Scope.** Represent Layer-1 containment as real nested ReactFlow parent/
child nodes (multi-level), replacing the current flat-grid-of-group-cards
layout. Progressive disclosure (default depth 1, 6-child collapse
threshold, in-place expand/collapse vs. breadcrumb-push distinction) per
`STATE_1_OVERVIEW.md`. New truthful summary line replacing "N areas · M
links". Right-panel relocation of `RepoOrientationPanel` per
`RIGHT_PANEL_SPEC.md`.

**Likely files.**
- Backend: `structural_fallback.py` (generalize `group_overview_components`
  to expose full ancestor-path chains, not just one flat immediate-
  directory level — extends the existing pure function, no new inference).
- Backend: `projection.py` (thread parent-group-id metadata through
  `ArchitectureMapNode` construction so the frontend can build the
  `parentId` tree).
- Frontend: `mapAdapter.ts` (build a parent-aware node tree instead of a
  flat list), `mapLayout.ts` (new nested layout function using ReactFlow's
  `parentId`/`extent:'parent'`, likely paired with a Dagre/ELK-style
  layout pass for correct nested positioning), `LensNode.tsx` (new
  container-node render path, distinct from the existing leaf card),
  `ArchitectureMapCanvas.tsx` (accessible-table nesting per
  `RIGHT_PANEL_SPEC.md`'s accessibility model), `RepoOrientationPanel.tsx`
  usage site (relocate, not delete).

**Backend contract changes.** `ArchitectureMapNode` likely needs one new
optional field (e.g. `parent_group_id: str | None`) — additive, no schema
break, same low-risk shape as Phase B's own `structural_group` kind
addition.

**Frontend changes.** New container-node type, new nested layout
algorithm, progressive-disclosure state (ephemeral, not navigation state
per `STATE_1_OVERVIEW.md`).

**Provider changes.** None — this phase is pure Layer-1 visualization, zero
LLM involvement.

**Tests.** Backend: ancestor-chain correctness for 2/3/4-level-deep
fixtures, root-file/flat-repo degrade still works. Frontend: nested-node
rendering, expand/collapse state machine, accessible-tree parity, a
synthetic large-fixture render-time check per the performance table above.

**Research-semantic impact:** none.

**Complexity: LARGE** (new layout algorithm, new node-rendering path,
touches the same projection core Phase B already flagged as its own
highest-complexity area).

---

## Phase C2 — Deterministic relation-based clustering

**Scope.** Within any Layer-1 region that stays flat/dense (per
`INFORMATION_MODEL.md`'s cross-repo fallback priority), compute Layer-2
structural clusters from real `imports`/`calls`/`inherits` edges. Formally
define the algorithm (community detection with documented hub-suppression,
per the concrete method validated in the post-P2 diagnosis on
`topic-similarity-mvp`), its stability caveat (not a canonically unique
partition — must be disclosed in UI copy per `AI_INTERPRETATION_SPEC.md`'s
"Why these modules are grouped" wording), and the honest residual/
"ungrouped" bucket for files with no sibling relation edge.

**Likely files.**
- Backend: new module, e.g. `app/architecture_map/relation_clustering.py`
  — pure function(s) over already-recovered `ObservedProgramRelation`
  facts (reuses existing relation data, does not add extraction).
- Backend: `projection.py` (wire cluster nodes into the group-drilldown
  response as a new intermediate level between a Layer-1 group and its
  leaf members).
- Backend: `core/models/architecture_map.py` (new `kind` value, e.g.
  `"structural_cluster"` — same pattern as Phase B's `structural_group`
  addition).

**Backend contract changes.** New node `kind`; cluster membership exposed
through the existing generic `children()` dispatch, no new route (same
minimal-contract discipline Phase B established).

**Frontend changes.** Render Layer-2 clusters nested inside their Layer-1
parent per `INFORMATION_MODEL.md`'s visual spec (distinct card treatment
from both Layer-1 containers and leaf modules); wire real edges into State
2's graph per `STATE_2_GROUP.md`.

**Provider changes.** None — this phase, like C1, is entirely deterministic.

**Tests.** Backend: clustering determinism (same input → same output),
hub-suppression behavior on a synthetic hub-dominated fixture, residual-
bucket correctness (files with no sibling edge never get forced into a
cluster), a direct regression test against the concrete `topic-similarity-
mvp` `services/` result already documented in
`qa-audit/post-p2-architecture-gap-diagnosis/DETERMINISTIC_CAPABILITY.md`
(same 5-cluster/26-connected/24-residual shape should reproduce). Frontend:
Layer-2 card rendering, State 2 real-edge rendering.

**Research-semantic impact:** none — per `STRATEGY_COMPARISON.md`'s
epistemic table, "these modules are graph-adjacent" is graph math over
already-verified relation facts, not a new proposition kind.

**Complexity: MEDIUM–LARGE** (real algorithm-design work — hub suppression
specifically is nontrivial, per the diagnosis's own caveat that it "is not
a drop-in library call").

---

## Phase C3 — AI semantic label/description generation

**Scope.** Layer 3 exactly as specified in `AI_INTERPRETATION_SPEC.md`:
on-demand ("Generate AI interpretation") generation of a name + short
description for a fixed Layer-1 or Layer-2 group, cached by
(`overview_input_hash`, member-id-set), always rendered as a visually and
lexically distinct "AI interpretation" component, never eligible for
SUPPORTED/verified status.

**Likely files.**
- Backend: new route, e.g. `POST /api/architecture-map/nodes/{group_id}/
  interpret` — explicit, user-triggered, never called by ordinary
  navigation (preserves the map routes' existing `NoConfiguredModel()`
  default; this route is the one new, deliberately-gated exception,
  analogous to how Architectural Explanation is already its own
  explicitly-triggered exception).
- Backend: reuses `arch_explanation_llm_*` configuration (boundary 1 from
  `LLM_ROUTING.md`) — this is a natural extension of the surface that
  already does entity-scoped LLM calls, not a new provider boundary.
- Backend: a small, tightly-scoped prompt: input = real member list +
  real relation facts for one fixed group; output = name + description
  only; no membership-changing output accepted or possible by contract.
- Frontend: `AI_INTERPRETATION_SPEC.md`'s Component A, the "Generate AI
  interpretation" action, the no-LLM fallback state.

**Backend contract changes.** New response shape (group id, name,
description, generated_at, model) — a new, additive DTO; does not touch
`ArchitecturalClaim`/`ClaimSupportStatus` in any way.

**Frontend changes.** New Layer-3 UI component (per
`AI_INTERPRETATION_SPEC.md`), Settings copy update (per
`SETTINGS_AI_MODEL.md`) shipped alongside so the new surface is documented
the moment it exists, not retrofitted later.

**Provider changes.** New call site, but reuses existing
`make_arch_explanation_model` machinery — no new provider integration
code, only a new, narrowly-scoped prompt and route.

**Tests.** Backend: contract test proving the route's output cannot alter
group membership (i.e. the response DTO has no membership field at all —
enforced by the type, not just by convention); cache-hit/invalidation
test; a test proving this route is never called by any existing map/
children/evidence route (grep-style "no new call site added to the
generic dispatch chain" assertion, mirroring how Phase B tested "no
automatic legacy LLM traffic"). Frontend: no-LLM fallback rendering,
generate-button flow, cached-result rendering, accessible-name "AI
interpretation:" prefix test (direct analog of Phase B's own
`VoiceRail.test.tsx` confidence-labeling regression tests).

**Research-semantic impact: PRODUCT-ONLY**, per
`qa-audit/post-p2-architecture-gap-diagnosis/REPORT.md`'s §20 — no new
proposition kind, no verifier extension, membership stays 100%
deterministic and fixed before this phase's route is ever called.

**Complexity: MEDIUM** (narrow prompt/route scope, but the epistemic-
separation enforcement — both backend contract and frontend component
isolation from Layer 4 — must be built carefully and tested explicitly,
not just asserted in copy).

---

## Phase C4 — State-aware contextual right panel

**Scope.** `RIGHT_PANEL_SPEC.md` in full: per-state panel content,
`RepoOrientationPanel` relocation, accessible `Origin` column
(deterministic / AI interpretation) in the accessible table.

**Likely files.** `ObservatoryShell.tsx` (panel selection logic),
`RepoOrientationPanel.tsx` (relocate to collapsed sub-section, not
deleted), `VoiceRail.tsx` (State 3 ancestry line extension per
`STATE_3_ENTITY.md`), `ArchitectureMapCanvas.tsx` (accessible table
`Origin` column).

**Backend contract changes.** None expected — this phase is presentation-
only over data C1–C3 already expose.

**Frontend changes.** Panel-selection state machine keyed on current
State 1/2/3/4 + selection, per `RIGHT_PANEL_SPEC.md`'s table.

**Provider changes.** None.

**Tests.** Frontend: per-state panel content assertions (the exact table
in `RIGHT_PANEL_SPEC.md`, one test per row), orientation-content-still-
reachable regression test (proving nothing was deleted, only relocated).

**Research-semantic impact:** none.

**Complexity: SMALL–MEDIUM** (mostly wiring/composition of already-built
C1–C3 data into existing panel infrastructure).

---

## Phase C5 — Settings / AI-surface communication

**Scope.** `SETTINGS_AI_MODEL.md` in full: explicit AI-surface list in
Settings copy, explicit statement of the env-var-only Doc Studio boundary.

**Likely files.** `SettingsPanel.tsx` copy/layout only.

**Backend contract changes.** None.

**Frontend changes.** Copy and layout only — no new state, no new API
calls (this phase adds zero new runtime behavior, purely explanatory UI).

**Provider changes.** None.

**Tests.** Frontend: presence/content of the new explicit surface-list
copy; regression test that Settings still saves/loads exactly as before
(no behavior change, copy-only).

**Research-semantic impact:** none.

**Complexity: SMALL** (copy and layout only; can ship independently of
C1–C4 and in fact should ship early/standalone since it requires no other
phase to be useful — recommended as the first PR merged if the team wants
quick, low-risk progress on the Participant #2 P2-B finding specifically,
even before C1–C3 land).

---

## Suggested sequencing

C5 can ship independently and first (lowest risk, addresses P2-B's
discoverability half immediately). C1 and C2 are independent of each other
technically but C2's UI has nowhere to render without C1's nested-
container work, so C1 should land first or concurrently. C3 depends on C2
(nothing to name without real Layer-2 clusters — though C3 could
technically target Layer-1 groups alone first if the team wants to ship
labels before clustering is ready). C4 depends on C1–C3 all existing since
it composes their output. Recommended order: **C5 → C1 → C2 → C3 → C4**,
five separate commits, each independently revertable.
