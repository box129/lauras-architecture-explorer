# Data Mapping — Design Elements → Actual Contracts

Classifications: **A** directly supported today · **B** deterministically derivable from
existing data (no new inference) · **C** requires new architectural inference (LLM/heuristic) ·
**D** presentation/interaction only.

Every row cites the actual current model/field it would draw from. Anything with no
trustworthy backing is marked **NOT CURRENTLY SUPPORTED**.

## Overview (State 1)

| Visual element | Data source | Class | Notes |
|---|---|---|---|
| Group/cluster boundary (1A) | New: `structural_fallback._directory_of(path)`-style grouping of existing `ArchitectureMapNode`s, generalized from fallback-only to primary use | B | Pure containment; directory name only, not a synthesized label. |
| Group card title (1A) | Literal directory path segment (e.g. `routes`, `src/flask`) | B | Must render as a path fragment, not Title Case prose, to avoid implying curation. |
| Group card title (1B, "Core Runtime" style) | No existing field | C | Only producible via live LLM `component_hypotheses` or the hardcoded, non-general `_architecture_label` keyword heuristic (`system_overview_generator.py:529-565`). **NOT CURRENTLY SUPPORTED** as ground truth. |
| Group member count | `len(children)` from `GET .../children`, or precomputed count of nodes sharing a directory prefix | A/B | Real count either way. |
| Representative member modules | First N real child node labels | A | No selection heuristic beyond "first N" needed — avoid claiming they are "most important." |
| Group-to-group edge | Not implemented anywhere today | C→B if defined | See "Relationship aggregation" below — safe only under an explicit, documented deterministic rule; otherwise it is an invented claim. |
| Group description prose ("Handles incoming HTTP requests...") | No existing field for directory-level groups | C | This is LLM-authored narrative in the mockups. **NOT CURRENTLY SUPPORTED** for deterministic groups; may exist legitimately for an LLM-lens component's own `summary` field, but that is per-component, not per-directory-group. |
| Entity type icon/kind | `ArchitectureMapNode.kind` (closed union incl. `structural_package`/`structural_module`, kept visually distinct from LLM-classified kinds by design) | A | Already correctly prioritized over a label-substring heuristic since the M2 fix (`mapAdapter.ts:78-89`). |
| Map confidence (%) | `ArchitectureMapNode.confidence` | A | Deterministic/static-analysis value (0.98 file-level, 1.0 resolved symbol, 0.35 anchor-kind fallback, 0.3–0.98 repo-shape heuristic for root). Never a claim-confidence value. |
| "83 areas • 112 links" style stat | `len(projection.nodes)` / `len(projection.edges)`, or `diagnostics.*_node_count` | A | Already computed server-side (`ArchitectureMapDiagnostics`). |

## Area drill-down (State 2)

| Visual element | Data source | Class | Notes |
|---|---|---|---|
| Selected area identity | `ArchitectureMapNode.label`/`id` for the entered group | A | |
| Child nodes | `GET /api/architecture-map/nodes/{id}/children` | A | Existing endpoint, existing test coverage. |
| Child edges | Same endpoint's `edges` field | A | Real `contains`/`imports`/lens-relationship edges only. |
| "What it does" prose | `OverviewComponent.summary` / `LensChildComponent.summary` when the area came from an LLM lens; **absent** for a pure directory-grouped area | A (lens-backed) / **NOT CURRENTLY SUPPORTED** (directory-grouped) | Must not backfill with generated prose for a directory-only group. |
| "Why it matters" bullets | No existing field | C | Purely mockup prose; do not implement without a real source. |
| Key files list | `ArchitectureMapNode.primary_files` | A | Already deduplicated, already capped (5 items) server-side. |
| Related areas | No existing field connecting sibling areas by relevance | C (unless reduced to: "other groups sharing an edge with this one," which is B) | A literal "areas that share a real edge with this one" list is derivable (B); a curated "related" list implying semantic affinity is not. |

## Entity focus (State 3)

| Visual element | Data source | Class | Notes |
|---|---|---|---|
| Selected entity node | `ArchitectureMapNode` for the symbol/module | A | |
| One-hop neighborhood (deps/dependents) | New traversal over existing `ArchitectureMapEdge`s / `ObservedProgramRelation`s | B | Pure graph traversal, no new semantics. |
| "What it does"/description | `ArchitectureMapNode.description` | A | Already exists, already populated (falls back to a generic "needs deeper investigation" string when no responsibilities/evidence exist — an honest gap marker, not a fabricated summary). |
| Architectural Explanation panel | `POST /api/entities/{id}/architectural-explanation` | A | Live L1(propose)/L2(verify)/L3(compose) pipeline, already wired to `ArchitecturalExplanationPanel.tsx`. |
| Relation label on an edge | `ArchitectureMapEdge.kind`/`label`, or `ObservedProgramRelation.relation_kind` (`contains`/`imports`/`calls`/`inherits`) | A | Closed, small vocabulary — safe to render literally. |

## Evidence / source (State 4)

| Visual element | Data source | Class | Notes |
|---|---|---|---|
| Architectural statement text | `ArchitecturalClaim.statement` | A | Never LLM wording used for `support_status` — enforced structurally upstream (`claim_projection.py`/`relation_adapter.claim_from_proposition`). |
| Support status badge | `ArchitecturalClaim.support_status ∈ {supported, insufficient_evidence, contradicted}` | A | All three states are real and reachable via `verify_proposition` (`core/models/provenance.py:779-828`); "contradicted" is genuinely computed here, unlike the older `GroundedClaim` vocabulary. |
| Evidence chain | `ArchitecturalClaim.evidence_chain.items` (`SourceSpanEvidence`/`RelationshipEvidence`) | A | Ordered, each with real `source_region_id`/`content_hash` or `from_symbol_id`/`to_symbol_id`. |
| Source span highlight | `SourceRegion.path/start_line/end_line` via `GET /api/source-regions/{id}` | A | Frontend already resolves and highlights exactly (`EvidenceItemRow.tsx:55-61`). |
| Confidence number on a claim | `ArchitecturalClaim.confidence` (currently always `None` — see `claim_proposer.py`'s producer stamping; verification does not currently assign a numeric confidence) | **NOT CURRENTLY SUPPORTED** | Do not display a percentage here; only the categorical `support_status` is populated today. |
| Reasoning/rationale text | `ArchitecturalClaim.reasoning` (populated from citation failures when present; empty string otherwise) | A (when present) | Do not backfill an empty reasoning field with generated prose. |

## Cross-cutting

| Visual element | Data source | Class | Notes |
|---|---|---|---|
| Breadcrumbs | `ArchitectureLensCrumb[]` (`useArchitectureLens.ts:97-109`) | A | Already exists; extend to the fixed four-segment shape. |
| Back control | `goBack()`/`goBackLens()` (`useArchitectureLens.ts:269-288`) | A (logic) / D (needs one unified visual pattern — currently 4 distinct implementations) | See STATE_MODEL.md's navigation notes. |
| Accessible table | `ArchitectureMapCanvas.tsx:128-212`, driven by the same node/edge fixture the canvas renders | A | Must be preserved and extended per-state, not removed. |
| Node kind icon/shape | `ArchitectureMapNode.kind` | A | Do not reintroduce a label-substring heuristic that can override it (regression class already fixed once, M2). |
| Repository selection via folder browser | `GET /api/fs/browse-directories` (`api/routes/browse.py`) | A | Directories-only, read-only; unrelated to map data but relevant to Observatory entry flow. |

## Explicitly out of scope / not backed by any current data

- Any per-group narrative description for a purely directory-grouped area.
- Any "why it matters" bullet list not sourced from a real `OverviewComponent.responsibilities`
  or `ArchitecturalClaim`.
- Any numeric confidence on an `ArchitecturalClaim` (field exists, is always `None` today).
- Any semantic "domain" name above the directory/file level (`"Request Lifecycle"`, `"Business
  Logic"`, etc.) presented as recovered fact rather than an explicitly-labeled AI suggestion.
- A group-to-group edge with no documented aggregation rule (see FEASIBILITY.md's relationship-
  aggregation risk).
