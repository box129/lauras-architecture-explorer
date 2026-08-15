# State 4 — Evidence / Source (preserve, no claim-verification redesign)

Design-only document. Per the design brief: do not redesign claim
verification semantics. This document confirms what is preserved and
specifies the one context-continuity addition needed.

## Preserved unchanged

```
Architectural statement  →  evidence  →  source  →  persistent exact highlight
```

`ArchitecturalClaim.support_status ∈ {supported, insufficient_evidence,
contradicted}`, the ordered `EvidenceChain`, `EvidenceItemRow` →
`GET /api/source-regions/{id}` → `goToCode` exact line-range highlighting —
none of this is touched. This is Layer 4 (`INFORMATION_MODEL.md`) and
remains completely outside this design's three-layer addition.

## Context continuity addition

Returning from Evidence to the originating entity must still land the user
back with the correct Layer-1/Layer-2 ancestry visible in the breadcrumb —
identical requirement to `STATE_3_ENTITY.md`, extended one level further.
No new mechanism: State 4's existing "Back returns to State 3, same entity
still selected" contract already carries breadcrumb state; it only needs
to keep carrying a Layer-2 crumb segment when one exists, exactly as State
3 does.

## Mockup element explicitly deferred, not rejected

`concept-04`'s left-hand "Architecture map (context)" mini-graph panel
(showing the claim's file in its surrounding dependency context) has no
current implementation anywhere in the product (confirmed: not part of
Phase A or Phase B scope). It is a genuinely useful idea and is **not**
epistemically problematic (it would show real containment/relation edges,
same facts as State 2/3), but building it is net-new UI surface, not a
byproduct of the Layer 1–3 model this document specifies. Recommendation:
defer to a later phase; do not bundle into Phase C1–C5 (see
`IMPLEMENTATION_PLAN.md`).

## Fidelity target: **80%**

Restored: nothing new needed — the core claim→evidence→source→highlight
flow already matches `concept-04`'s intent closely. Modified: none.
Rejected: none. The 20-point gap is entirely the deferred context
mini-graph panel, a real but non-blocking visual omission, not a
truthfulness correction.
