# Design Principles — Semantic Architecture Overview

Design-only document. Non-authoritative until implemented; supersedes
nothing in `docs/design-proposals/architecture-navigation/` (that proposal
remains the frozen record of Phase A/B's own design process — this is a
new, additive proposal for Phase C, informed by Participant #1, Participant
#2, and the post-P2 technical diagnosis at
`qa-audit/post-p2-architecture-gap-diagnosis/`).

## The one rule everything else follows

**Three different kinds of fact must never collapse into one visual
concept, one badge, or one sentence:**

1. **Structural containment** — "this file is inside this directory." A
   plain, observed fact.
2. **Structural cluster** — "these modules are graph-adjacent under a
   formally defined deterministic rule (e.g. import density)." A derived,
   checkable fact — checkable in the sense that re-running the same rule
   on the same repository yields the same membership, not in the sense of
   being submitted to `verify_proposition`.
3. **AI architectural interpretation** — "a model's guess at what to call
   this cluster and what it does." An inference, never a fact, and never
   eligible for SUPPORTED/verified status under the current proposition
   vocabulary (`PropositionKind = Literal["direct_relation",
   "reachability"]`, `core/models/provenance.py`).

A fourth kind already exists and must stay untouched: **verified
architectural statements** — `ArchitecturalClaim`/`ClaimSupportStatus`,
produced by the existing L1(propose)/L2(verify)/L3(compose) pipeline,
displayed via `SUPPORTED`/`INSUFFICIENT EVIDENCE`/`CONTRADICTED`. This
vocabulary is reserved for genuine proposition verification and must never
be reused for an AI-authored group name or description, per the explicit
correction in the design brief this document responds to.

## Why this rule exists (traceable to real findings)

- **Participant #1** (`02e1904`): node kinds were indistinguishable — "a
  bunch of boxes with the same icons." The fix was making `kind` a
  visible, honest, non-overridable signal. This document extends the same
  discipline to a new axis: not just *what kind of entity is this* but
  *what kind of fact is this claim about this entity*.
- **Participant #2, finding P2-A**: directory-only grouping doesn't read as
  architecture. The fix is **not** to make directory groups *look* more
  architectural (e.g. Title-Casing a path) — that would silently blur
  layers 1 and 3. The fix is to add a real Layer 2 (relation clustering)
  and a real, clearly-marked Layer 3 (AI interpretation) *on top of*
  Layer 1, never replacing it.
- **Participant #2, finding P2-B**: AI contribution was invisible. The fix
  is not "turn on more AI" — it's making the one place AI legitimately
  belongs (naming an already-fixed cluster) visible, present, and
  unmistakably labeled, exactly where the user is already looking
  (the Overview), instead of buried in an entity-only panel several clicks
  away.
- **Post-P2 diagnosis** (`qa-audit/post-p2-architecture-gap-diagnosis/`):
  deterministic clustering measurably improves on directory grouping
  (concrete result on `topic-similarity-mvp`'s `services/` directory:
  5 real sub-clusters found among 26/50 files with sibling import edges);
  deterministic *naming* does not and structurally cannot, by design of
  the current verifier. Strategy B was recommended there; this document is
  its interaction-design specification.

## Non-negotiables carried forward unchanged

- No new architectural inference is added to the deterministic layers.
  Layer 1/Layer 2 membership must remain reproducible from the same
  analysis run with no model call.
- Layer 3 never changes Layer 1/2 membership, never invents an edge, never
  marks itself SUPPORTED, and never silently reuses claim-verification
  vocabulary or visual language.
- The map route's LLM lockout (`NoConfiguredModel()` by default,
  documented incident-driven decision) is not weakened — Layer 3
  generation is always an explicit, attributable, opt-in-visible action,
  never automatic traffic fired by ordinary navigation.
- Phase A's navigation stack (breadcrumb/Back/browser history/Entity
  Focus/Evidence) is preserved, not re-architected.
- The accessible table equivalent must represent all three layers with the
  same fidelity as the canvas, per the project's standing accessibility
  requirement.

## What "restore mockup fidelity" means and doesn't mean

It means: recover the mockups' **spatial/containment intent** — regions
that visually contain their members, at more than one level, with a
materially lower top-level object count than a flat file list.

It does **not** mean: reproducing the mockups' **invented semantic
content** (domain names like "Core Runtime," narrative "why it matters"
prose, fabricated relationship lines) as if it were recovered fact. Where
mockup content was semantic invention, this design either (a) restores it
honestly via a clearly-marked Layer 3, or (b) explicitly rejects it — see
`MOCKUP_FIDELITY_AUDIT.md`'s "Reason for deviation"/"Should next design
restore it?" columns for the specific call on every element.
