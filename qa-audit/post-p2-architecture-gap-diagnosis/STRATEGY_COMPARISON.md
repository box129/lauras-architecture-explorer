# Strategy Comparison — Deterministic Structure vs. Semantic Architecture

Read-only design analysis. No source was changed to produce this document.

## Epistemic ground truth: what can actually be verified today

Laura's verification vocabulary (`core/models/provenance.py`) is
deliberately narrow by construction:

- `PropositionKind = Literal["direct_relation", "reachability"]` — a
  `ClaimProposition` is built **entirely from entity ids and a
  `ProgramRelationKind`** (`contains`/`imports`/`calls`/`inherits`), never
  from free text. `direct_relation` = "subject —relation_kind→ object" as
  one edge; `reachability` = an ordered multi-hop chain of one relation
  kind.
- The module's own docstring states the boundary explicitly: *"it is
  structurally impossible for `verify_proposition` to mark a behavioral
  claim 'supported' from structural relation evidence, because there is no
  way to construct a `ClaimProposition` asserting it in the first place."*
  This is a **deliberate safety property**, not a gap.

Applying this to the architecture-grouping question, precisely:

| Claim | Verifiable today? | Why |
|---|---|---|
| "Module A imports Module B" | **YES** | Literally a `direct_relation` proposition over a real `imports` edge. |
| "A, B, C form a densely-connected structural cluster" | **POSSIBLY YES** | Not yet a proposition kind, but *could* be formalized as a new deterministic derivation (e.g. "every pair in {A,B,C} is `reachability`-connected within N hops via `calls`/`imports`") — this is graph math over facts already recovered, not new inference. |
| "This cluster should be called 'Authentication'" | **NO, not directly** | There is no `ProgramRelationKind` for "is-an-instance-of-concept-X". No proposition can even be *phrased* for this under the current vocabulary. |
| "AuthController belongs to 'Authentication'" | **only if a new semantic proposition/verifier is formally defined** | Same reason — membership-in-a-named-concept is not a structural relation between two recovered entities; it requires a new, deliberately-scoped proposition kind (e.g. `concept_membership`) with its own evidence/verification rule, which does not exist today. |

This table is the load-bearing fact behind every strategy below: **cluster
existence is a graph-math question the deterministic layer can, in
principle, answer and verify; cluster naming is a different kind of claim
that no existing verifier can check, by deliberate design.**

## Strategy A — Deterministic only

Improve grouping using graph/static-analysis methods only (dependency
clustering, SCC, community detection, fan-in/fan-out roles) — see
DETERMINISTIC_CAPABILITY.md for what Laura's relation-extraction layer
actually supports today and the concrete topic-similarity-mvp exercise.

- **Architecture usefulness:** can genuinely improve on directory-only
  grouping *when* real cross-file relation density exists beyond what
  directory boundaries already capture (see DETERMINISTIC_CAPABILITY.md for
  whether that held on the concrete test repository).
- **Naming quality:** bounded by the epistemic table above — any label
  would have to be a path-fragment, an entity list, or a lexical
  heuristic-labelled-as-heuristic. It structurally cannot produce a
  trustworthy "Authentication"-style name.
- **Explainability:** highest — every boundary traces to a concrete,
  inspectable relation edge.
- **Cross-repo generality:** depends entirely on the clustering method
  chosen; simple ones (SCC, import-density) generalize better than
  anything resembling keyword/lexical inference.
- **Research safety:** highest — zero new epistemic categories, zero new
  verifier surface.
- **Participant evidence fit:** addresses part of P2-A (denser,
  non-directory-shaped groups) but **cannot** address the literal ask —
  Participant #2 wanted labelled *functional/architectural* boxes
  ("Authentication", not "Group 7"). A is silent on P2-B entirely (no LLM
  contribution to point to at all).

## Strategy B — Deterministic groups + LLM labels

Deterministic system decides membership (directory- or graph-clustering-
derived); LLM proposes only a name + short description for an
already-fixed group, UI marks both as "AI interpretation."

- **Risk:** low-moderate. The LLM never decides *what belongs to what* —
  only how to describe a boundary someone else already drew. A wrong label
  cannot silently reassign a module's membership.
- **Usefulness:** directly answers P2-A's literal wording (a labelled box)
  and P2-B (a visible, attributable AI contribution) simultaneously.
- **Evidence requirements:** the label/description would need to cite the
  real member list and (ideally) the real relation facts that justified
  the deterministic boundary — i.e. the LLM's output must be *about*
  already-verified facts, not asserting new unverifiable ones.
- **Can a name be "verified"?** No — per the epistemic table, a name is
  not a `direct_relation`/`reachability` proposition. It can only ever be
  **labelled as inferred**, never marked SUPPORTED/verified. This must be
  visually and lexically distinct from the SUPPORTED/INSUFFICIENT
  EVIDENCE/CONTRADICTED claim vocabulary already established for
  Architectural Explanation (same non-negotiable the project has already
  enforced once, per the Phase B design docs' map-confidence-vs-claim-
  status convention).
  - Should the system let a user inspect *why* a label was chosen? Yes —
    at minimum show the member list + relation facts the boundary was
    drawn from underneath the AI label, so the user can judge the label
    against real evidence themselves rather than trusting it blindly.

## Strategy C — LLM-proposed groups + deterministic evidence

LLM proposes name, membership, and explanation; Laura's attaches structural
facts supporting/weakening the proposal; unsupported membership is
rejected/flagged.

- This requires genuinely new verifier semantics: a mechanism to check
  "does real relation evidence support member X being asserted as part of
  proposed group G" — which needs its own defined threshold/rule (unlike
  B, where membership is never in dispute because it was never LLM-
  proposed in the first place).
- **Risk:** materially higher than B. The LLM is now proposing the
  *boundary*, not just narrating an existing one — a wrong/hallucinated
  membership claim, even if later "flagged," was still generated and
  briefly presented as a candidate fact, reopening exactly the class of
  risk the project's design docs warn against (`_architecture_label`/
  live-LLM `component_hypotheses` precedent, already flagged as unsafe to
  present as ground truth).
- **Verifier extension required:** yes, materially — a new proposition
  kind and a new acceptance/rejection rule, plus UX for a "partially
  rejected" group (some members kept, some dropped) which has no current
  analog anywhere in the product.

## Strategy D — Two-layer map

Layer 1 = deterministic structure (today's Phase B, possibly enhanced per
Strategy A). Layer 2 = AI architectural interpretation, explicitly labelled
inferred/evidence-backed, user-toggleable.

- **Epistemic honesty:** highest of the three LLM-involving strategies —
  the deterministic layer is never mutated or reinterpreted by the AI
  layer; a user who distrusts the AI layer can always fall back to Layer 1
  and lose nothing.
- **Satisfies both P2 findings:** P2-A is answered by Layer 2 (labelled
  functional boxes); P2-B is answered by Layer 2 being visibly, explicitly
  "the AI's interpretation" — solving the discoverability problem at its
  root rather than patching Settings copy.
- **Implementation cost:** highest of the four — two renderable
  states, an explicit switch, and (if Layer 2 groups differ from Layer 1
  groups, which it likely should to be worth building) it inherits
  everything Strategy C needs (an `ArchitecturalGroupProposal`-shaped
  object) OR everything Strategy B needs if Layer 2 keeps Layer-1
  membership and only adds names/descriptions.
- In practice, D is not really a fourth independent strategy — it is
  Strategy B or Strategy C **plus a mandatory, explicit UI-layer toggle**.
  The honesty and risk profile of "D built on B" is identical to B; "D
  built on C" is identical to C, with an added navigation/UI cost either
  way.

## Recommendation

**B — Deterministic groups + LLM labels**, with **Strategy D's toggle
requirement folded in** (make it clearly presented as a separate,
opt-in-visible "AI interpretation" affordance rather than silently
replacing the deterministic label) rather than treated as a fifth option.

Why not the others:
- **A** does not solve P2-B at all and only partially addresses P2-A's
  literal request (a labelled category), so it under-delivers relative to
  what was actually asked for by both findings.
- **C** requires a materially new, higher-risk verifier extension
  (LLM-proposed *membership*, not just LLM-described *labels*) for a
  benefit over B that is not evidenced as necessary — nothing in the P2
  findings asked for AI-decided membership, only AI-visible/legible
  documentation and clearer category labels.
- **Pure D** is not a separate mechanism, just B (or C) plus a toggle;
  recommending "B done honestly, with the toggle" captures its benefit
  without inheriting C's risk.

See REPORT.md §17/§21–23 for the exact allowed/disallowed role of the model
under this recommendation and the retained deterministic role.
