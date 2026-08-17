# Architecture graph G0

`GET /api/architecture-graph` is a new, unused, versioned (`architecture-graph/v1`) deterministic contract. It does not alter `/api/architecture-map`.

Groups expose compact explicit membership: leaves contain `direct_member_module_ids`; containers contain `direct_child_group_ids`; recursive membership is recovered by walking containment and is not duplicated. Root files use `root_file_bucket`.

Aggregate edges are directed and per relation kind. Only persisted `resolved` relations with concrete source and target entities contribute. Each relation record counts once; distinct pairs ignore source span while relation count does not. Same-group relations are internal counts, never visible self-loops. A bounded sorted relation-id preview preserves drill-down provenance.

`visible_representative` is the pure collapsed-state helper: a group resolves to its nearest collapsed ancestor. G0 does not wire it into UI.

The isolated ELK proof converts neutral graph DTOs into compound ELK hierarchy, receives parent sizing and routed edges, then emits ReactFlow-relative child coordinates. G1 may reuse this wrapper, not the dormant V2 semantic contract.

The wrapper is required because ELK works in absolute hierarchy coordinates while ReactFlow compound children require coordinates relative to `parentId`. It owns DTO-to-ELK conversion, deterministic sorting, parent sizing, routed-edge extraction, and that coordinate handoff.

Cross-container aggregate edges are routed at the nearest common root-container level while preserving their original aggregate-edge IDs. Intra-container edges retain their leaf endpoints. This is an ELK limitation handled by the wrapper, not a change to graph facts or relation direction.

Structural scale smoke on this workspace produced 20 groups and zero relations/aggregate edges in 1.20 ms (20 modules), 1.69 ms (200), and 4.18 ms (2,000). This intentionally exercises collapsed structural representation only; G0 does not claim a 2,000-node ReactFlow render result.

Deferred: production canvas, filters, semantic zoom, clustering, AI interpretation, and relation drill-down UI/API.
