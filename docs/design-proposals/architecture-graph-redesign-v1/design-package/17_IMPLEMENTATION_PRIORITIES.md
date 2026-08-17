# 17. Implementation priorities

Revised after the final visual-approval review. Two changes from the previous
version: work is now classified by **what already exists in the snapshot**, and
the C1 nested-containment infrastructure is no longer scheduled as if it were
missing.

## Classification

| Class | Meaning |
|---|---|
| **EXISTS** | Working infrastructure in the current snapshot. Do not rebuild. |
| **RESTYLE** | Recomposition or restyling on top of something that already works. |
| **MISSING** | Genuinely new backend or frontend capability. |

## A. Existing infrastructure — do not rebuild

| Capability | Status | What implementation should do |
|---|---|---|
| **C1 nested deterministic containment** — compound/parent nodes, `parentId` + `extent:'parent'`, ancestor chains, parent-aware layout | **EXISTS** | Use it as-is. The redesigned Overview Map is a *presentation* of this hierarchy, not a new hierarchy. |
| Deterministic analysis pipeline — parse, symbols, imports/calls/inheritance | **EXISTS** | Unchanged. |
| Evidence records with file path and line span | **EXISTS** | Unchanged; the redesign only re-presents them. |
| Verification verdicts (SUPPORTED / INSUFFICIENT EVIDENCE / CONTRADICTED) | **EXISTS** | Unchanged. Never model-produced. |
| Folder picker and run lifecycle | **EXISTS** | Reused behind the new landing screen. |

**Explicitly cancelled from the previous plan:** the previous step 4 ("Overview
containment … needs the backend's ancestor-chain extension") described building
compound-node hierarchy that the snapshot already has. It is replaced by A-1
below.

## B. Restyle / recomposition — no new backend

| # | Step | Contents | Size |
|---|---|---|---|
| A-1 | **Overview Map presentation** | Render the existing C1 containment as visibly nested structural regions; add the Map / Outline switch; the two views read the same tree | M |
| A-2 | Theme foundation | `theme.css` tokens, light/dark/system controller, retire hard-coded colours | M |
| A-3 | Navigation shell | one Back, one breadcrumb, one stack; retire the other Back affordances | M |
| A-4 | Landing screen | new first screen over the existing picker and run lifecycle | S–M |
| A-5 | Contextual panel | state-aware frame; orientation demoted | M |
| A-6 | Statement + evidence restyle | `StatementCard`, numbered chain, permanent source pane, highlight edge | S–M |
| A-7 | Ungrouped bucket | collapsed by default, real count, neutral explanation | S |
| A-8 | Canvas controls + Outline view | floating control cluster; `ArchitectureTree` as the accessible equivalent | M |
| A-9 | Settings | surface map, appearance, technical-details disclosure | S |

## C. Genuinely missing capability

| # | Step | Contents | Size |
|---|---|---|---|
| B-1 | Group-view edges | in-scope relation edges are not currently returned by the children response | M — backend + frontend |
| B-2 | Relation clustering (C2) + residual set | deterministic clustering and the ungrouped remainder | L — backend |
| B-3 | AI interpretation (C3) | explicit, cached generate action per cluster | M |
| B-4 | **Unified AI provider contract** | one provider setting (None / OpenAI / OpenRouter) serving explanation, group interpretation **and Doc Studio** — Doc Studio's separate deployment-level model config is retired | M — backend |
| B-5 | Doc Studio provenance | section picker, per-section attribution in the export | M |

## Sequencing note

A-1 through A-9 are shippable without any backend change and deliver most of
the usability findings. B-4 is the only newly added backend item and exists
because the review rejected a hidden second configuration mechanism.

Deferred, deliberately: the evidence context mini-graph, neighbour
domain-membership chips, the question dock's new home.
