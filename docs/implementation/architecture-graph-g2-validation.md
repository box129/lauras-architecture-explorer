# G2B real-repository clustering validation

## Scope and configuration

Validation began at `486597a` and ran the unchanged
`bridge-separated-affinity-components/v1` implementation. Analyses were fresh
normal-pipeline runs using `Settings(environment="test")`; no LLM,
embeddings, README content, or filename semantics participated. Every run
re-projected identically from the same in-memory analysis data.

Checked-out local candidates were limited to the refurbished backend,
`qa-audit/phase-2/fixtures/mixed-moderate`, and the frozen provenance fixture
(`research/provenance-evaluation/fixtures/python_app`). There was no local
checked-out source for topic-similarity-mvp, Flask, Tenacity, or Stevedore.
The frozen fixture was read only. Consequently, this is a negative-data
validation: it can validate abstention and analyzer coverage limits, but cannot
establish usefulness on the historical relation-rich ~50-module services area.

## Eligible-region inventory

`syntax-tree-refurbished-backend` had 17 eligible leaves, all with zero
internal resolved cross-module records/pairs and therefore zero bridges,
clusters, and relation participation. Their direct-module counts were:

| Structural path | Modules |
|---|---:|
| `src/syntax_tree_refurbished/api` | 3 |
| `app/analysis` | 9 |
| `infra/filesystem` | 5 |
| `app/parsing` | 5 |
| `api/dto` | 15 |
| `app/evidence` | 3 |
| `app/investigation` | 6 |
| `src/syntax_tree_refurbished` | 4 |
| `core/models` | 19 |
| `app/architectural_explanation` | 7 |
| `app/indexing` | 3 |
| `api/routes` | 20 |
| `app/docs` | 3 |
| `app/query` | 4 |
| `tests` | 46 |
| `app/provenance` | 3 |
| `app/architecture_map` | 4 |

All 159 listed modules were residual with `no_internal_resolved_relation`.
The connected-components baseline was likewise entirely singleton components.

The realistic mixed fixture had four eligible leaves:

| Path | Modules | Participating | Resolved records / pairs | Kinds | CC sizes | Bridges | Clusters | Residual |
|---|---:|---:|---:|---|---|---:|---:|---:|
| `backend` | 3 | 0 | 0 / 0 | – | 1,1,1 | 0 | 0 | 3 |
| `backend/services` | 4 | 3 | 2 / 2 | calls: 2 | 3,1 | 2 | 0 | 4 |
| `frontend/src` | 5 | 0 | 0 / 0 | – | 1,1,1,1,1 | 0 | 0 | 5 |
| `backend/domain` | 3 | 0 | 0 / 0 | – | 1,1,1 | 0 | 0 | 3 |

The frozen provenance fixture had two eligible leaves:

| Path | Modules | Participating | Resolved records / pairs | Kinds | CC sizes | Bridges | Clusters | Residual |
|---|---:|---:|---:|---|---|---:|---:|---:|
| `repositories` | 3 | 2 | 1 / 1 | inherits: 1 | 2,1 | 1 | 0 | 3 |
| `services` | 3 | 2 | 1 / 1 | calls: 1 | 2,1 | 1 | 0 | 3 |

## Current algorithm, diagnostics, and comparison

No recovered cluster exists in the available real/realistic inventory, so no
cluster density, boundary ratio, cross-cluster relation, or cluster display-ID
row can truthfully be reported. Clustered-module coverage and
relation-participation coverage are both 0% in every listed region.

This is mechanically explained. In `backend/services`, the two resolved calls
form a three-module star/path with two graph bridges; removing bridges leaves
four singleton components. The provenance regions have one bridge each. The
remaining regions lack internal resolved relations altogether. The residual
distribution is: backend 159 `no_internal_resolved_relation`; mixed fixture 11
`no_internal_resolved_relation` and 4 `no_useful_non_bridge_relation_core`;
provenance fixture 6 `no_useful_non_bridge_relation_core`.

Plain connected components would cover the mixed service's 3 connected modules
and each provenance pair. That is higher coverage, but it groups solely through
bridges and does not meet the selected non-bridge-core rule. It is deterministic
but more hub-sensitive. A second deterministic community baseline was not run:
the installed production dependencies contain no graph/community package, and
adding one solely for this validation would violate the dependency constraint.

## Structural sanity review

The only relation-rich available leaf was `backend/services`. The recovered
facts are two calls from `task_service.py::TaskService.create`: one to
`validator.py::validate_title` (line 13), one to `repository.py::TaskRepository.save`
(line 14). These facts genuinely connect the three modules, but there is no
alternate module-level path between any pair. The bridge analysis is therefore
not an ordering artifact: both edges are bridges and no membership boundary is
misclassified. This is a star/hub-spoke case, not evidence of two or more
non-bridge groups.

## Decision and limitations

No algorithm semantics are changed. The available evidence is insufficient to
classify the method as accepted/tuned/reconsidered for product use: no local
relation-rich eligible region tests its intended positive case. The correct
task decision is **G2B_BLOCKED_DATA**. This result distinguishes analyzer
coverage (no internal resolved relations in 159 backend modules) from algorithm
conservatism (the small star and pairs are correctly abstained).

Product readiness is **NO — ALGORITHM NEEDS REVISION** only in the narrow G3
readiness sense: rendering this inventory would add no clusters beyond G1. It
does *not* establish that the algorithm needs a semantic change; it establishes
that G3 must wait for validation on a real relation-rich repository.

The reusable command is:

```text
uv run --isolated --with fastapi --with httpx python scripts/validate_g2_clusters.py PATH [...]
```
