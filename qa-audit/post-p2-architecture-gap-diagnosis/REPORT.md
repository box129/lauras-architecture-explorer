# Post-Participant-2 Root-Cause Diagnosis — Deterministic Structure vs. Semantic Architecture / LLM Contribution

Status: READ-ONLY DIAGNOSIS. No product source, research semantics, prompts,
settings, or formal-study materials were changed to produce this document.

Current product state confirmed: branch `product/end-user-acceptance`, HEAD
`fdd77aa` (Phase B, contains `b311b16` Phase A and `3bb49ed`/`02e1904` as
ancestors), working tree clean, `qa-audit/architecture-navigation-phase-b/`
committed, Phase B final classification unchanged at `READY FOR PHASE C
REVIEW`, no participant data tracked in git, `research/`/formal-study paths
untouched by any commit in this investigation.

De-identified findings driving this investigation:
- **P2-A** — the deterministic, directory-based "repository section"
  grouping shipped in Phase B still did not read as "architecture" to the
  participant; they expected labelled functional/architectural boxes.
- **P2-B** — the participant configured a live model in Settings expecting
  richer AI-generated documentation, and could not identify anywhere the
  model had contributed.

## 1–2. Current product state

Confirmed above; see also `qa-audit/architecture-navigation-phase-b/
REPORT.md` for the full Phase B record.

## 3–4. Pipeline / grouping algorithm

Full trace: `CURRENT_PIPELINE.md`. Summary: the Overview is built entirely
by `app/analysis/static_structure.py` (deterministic file components +
import edges) → `SystemOverviewGenerator._degraded_overview()` (always
taken on the map routes, regardless of any Settings-UI configuration — see
§11–14) → `ArchitectureMapProjector.project()`, where Phase B's
`structural_fallback.group_overview_components()` groups the flat,
file-shaped component list purely by real immediate-parent-directory
containment. No LLM involvement exists anywhere in this path today. Every
field shown on a group card traces to a real, inspectable deterministic
fact or a fixed template string — see `CURRENT_PIPELINE.md`'s
field-by-field table.

## 5–8. Does the deterministic layer already have information Phase B ignores?

**Yes, partially.** Full inventory: `DETERMINISTIC_CAPABILITY.md`. Phase
B's grouping function consumes exactly one signal — `OverviewComponent
.label`'s directory path. It does not consume the already-recovered
relation layer (`imports`, and, Python-only, `calls`/`inherits`) as a
grouping signal at all, even though that layer already exists elsewhere in
the pipeline (it backs Entity Focus's neighborhood query).

**Concrete exercise on `topic-similarity-mvp`** (the repository Participant
#2 actually used — real analysis performed, not a hypothetical): directory
grouping produces 6 sections, one of which (`services/`, 50 files, no
subdirectories) stays an undifferentiated wall. Building the real
`require()` import graph over all 51 files found 88 edges, 86% of which
cross directory boundaries; naive whole-repo clustering collapses to one
48-file blob dominated by two shared-infrastructure hub files and needs
hub-suppression to be usable; but isolating the `services/` subgraph and
running community detection on it found **5 real, defensible sub-clusters**
among the 26/50 files with any sibling edge (e.g. `{auth, email,
notification, notificationEvent, submission}.service.js`), concretely
improving on the flat directory listing for exactly the section Phase B
could not otherwise subdivide. Full numbers, method, and generality
caveats: `DETERMINISTIC_CAPABILITY.md` §3.

**Structural clustering vs. semantic naming, kept explicit throughout:**
finding that 5 files are graph-adjacent is a checkable structural fact;
concluding that cluster "is Authentication" is not — see the epistemic
table in `STRATEGY_COMPARISON.md`, grounded directly in `core/models/
provenance.py`'s `PropositionKind = Literal["direct_relation",
"reachability"]`, whose own docstring states plainly that a claim outside
this closed, relation-edge-based vocabulary — e.g. any concept/behavior
label — cannot even be *phrased* as a `ClaimProposition`, let alone
verified. No deterministic naming mechanism inspected (lexical majority
vote, path fragment, alphabetical member) produces a trustworthy semantic
name; every one either returns nothing useful or is a keyword heuristic
wearing a "deterministic" label, the exact class of risk the project has
already flagged once (`_architecture_label`).

## 9. Hybrid architecture — what can actually be verified

Evaluated, not implemented. The precise, current verifiability boundary
(re-derived directly from `provenance.py`, not assumed):

| Claim | Verifiable today? |
|---|---|
| "Module A imports Module B" | **YES** — a real `direct_relation` proposition |
| "A, B, C form a densely-connected structural cluster" | **POSSIBLY YES**, if formally defined as a new deterministic derivation (multi-hop `reachability` over the existing relation graph) — graph math over existing facts, not new inference |
| "This cluster should be called 'Authentication'" | **NO**, not directly — no `ProgramRelationKind` exists for concept membership |
| "AuthController belongs to 'Authentication'" | **only if a new semantic proposition/verifier is formally defined** — does not exist today |

This is the load-bearing distinction for every strategy in
`STRATEGY_COMPARISON.md`: cluster *existence* is (in principle) a
deterministic, verifiable graph-math question; cluster *naming* is a
categorically different kind of claim current verifier semantics were
deliberately scoped to exclude.

## 10. Possible new epistemic object — research implications (not implemented)

An `ArchitecturalGroupProposal`/`ArchitecturalGroupMembershipProposal`
object (`group_id`, `proposed_name`, `member_entity_ids`, `description`,
`supporting_structural_facts`, `epistemic_type=INFERRED`) would require:

- **New proposition vocabulary** — yes, if membership itself is ever
  LLM-proposed (Strategy C) rather than deterministically fixed (Strategy
  B). A pure "attach an AI label to an already-deterministic group"
  design (Strategy B) needs **no** new proposition kind at all — the label
  is presentation content, not a claim submitted for verification.
- **New verifier semantics** — only under Strategy C (checking whether
  real relation evidence supports an LLM-proposed *membership* claim); not
  required under Strategy B.
- **New evidence semantics** — a label/description under Strategy B still
  benefits from citing real supporting facts (member list, relation
  counts) for user inspection, but this is presentation-layer evidence
  display, not a new `EvidenceChain`/verification primitive.
- **New evaluation methodology** — only if the thesis's evaluation
  methodology currently claims "every architectural assertion in the
  product is machine-verified"; a Strategy-B label would need to be
  evaluated (if at all) as a UX/usefulness question, not folded into the
  existing SUPPORTED/INSUFFICIENT EVIDENCE/CONTRADICTED accuracy
  methodology, since it is never submitted to `verify_proposition` at all.
- **Thesis contribution change** — Strategy B does not touch the
  thesis's core "LLM proposes, deterministic verifier checks" contribution
  claim, because it does not ask the verifier to check anything new; it
  only adds an explicitly-unverified, explicitly-labelled interpretive
  layer alongside it. Strategy C would touch the contribution claim,
  because it would require extending what "verified" means.

## 11–14. LLM configuration / routing trace

Full trace: `LLM_ROUTING.md`. Two non-overlapping configuration
boundaries exist: (1) the Settings-UI-controlled `arch_explanation_llm_*`
config, read only by the Architectural Explanation panel's route, and (2)
the env-var-only `llm_provider` ("investigation model"), which gates
Overview/children/Doc Studio and has **no UI control at all**. A read-only
live check on the running instance confirmed the participant's described
configuration (`Provider=OpenAI, Model=gpt-5.4-mini, Enabled=true`) really
was saved and is genuinely active right now (`configured: true,
credentials_present: true`) — ruling out a save/credential failure.

## 15. Product-mental-model audit

The current UI does **not** clearly state "this Overview is deterministic"
anywhere on the Overview screen itself, nor "AI is used here" /
"AI is not used here" per-surface. The Settings panel's own copy ("works
fully without this configured") is honest but passive — it says AI is
*optional*, not *where it does or doesn't apply*. Given that, a user
enabling the only AI control the product exposes and then expecting richer
output on the main Overview/groups screen they were just looking at is a
**reasonable** inference from the current copy and settings presentation,
not user error — this is a genuine product-mental-model gap, not merely a
participant misunderstanding.

## 16. Strategy comparison

Full comparison of Strategies A–D: `STRATEGY_COMPARISON.md`.

## 17. Recommendation

**B — Deterministic groups + LLM labels**, with Strategy D's
explicit-toggle/labelling discipline folded in rather than treated as a
separate strategy. Full justification in `STRATEGY_COMPARISON.md`'s
"Recommendation" section.

## 18. Is deterministic structure enough?

**PARTIALLY.** Deterministic facts can identify useful structural clusters
beyond directory grouping (concretely demonstrated on `services/` in
`topic-similarity-mvp`), but cannot supply meaningful semantic
architectural names/explanations — not as an implementation gap, but as a
direct consequence of the verifier's deliberately closed proposition
vocabulary (§9–10). Phase B's specific shortfall was using *only* directory
containment when a richer deterministic *membership* signal (import
density, computed per-directory) was available and unused — that part was
"too conservative." The *naming* gap, by contrast, is not a conservatism
problem; it is a real, structural boundary of what deterministic analysis
can honestly claim.

## 19. Do we need the LLM?

**YES, FOR SEMANTIC LABELING ONLY.** Under the recommended Strategy B, the
model is allowed to decide: a human-readable name and a short description
for a group whose **membership was already fixed by deterministic
analysis**. The model is explicitly **not** allowed to decide: which
modules belong to a group, whether a group should exist at all, or
anything presented as a verified/SUPPORTED architectural fact. Its output
is always visually and lexically marked as inferred/AI-interpreted,
distinct from the existing SUPPORTED/INSUFFICIENT EVIDENCE/CONTRADICTED
claim vocabulary, per the project's already-established map-confidence-
vs-claim-status convention.

## 20. Research-semantic impact

**PRODUCT-ONLY**, for the recommended Strategy B specifically — it adds no
new proposition kind, no new verifier rule, and does not change what
"verified" means anywhere in the system, because group membership stays
100% deterministic and the LLM's output (a label) is never submitted for
verification at all, only displayed as clearly-marked interpretation.

Strategy C, by contrast, **would require a research-semantic extension**
(a new proposition kind + verifier rule for LLM-proposed *membership*) —
explicitly not recommended here, and not implemented.

## 21. Not implemented

No parser, grouping, frontend, prompt, provider, verifier, proposition,
settings, Doc Studio, or map code was changed by this investigation. This
report, `result.json`, and the four supporting `.md` files listed below are
the only artifacts produced.

## Artifacts

- `qa-audit/post-p2-architecture-gap-diagnosis/REPORT.md` (this file)
- `qa-audit/post-p2-architecture-gap-diagnosis/result.json`
- `qa-audit/post-p2-architecture-gap-diagnosis/CURRENT_PIPELINE.md`
- `qa-audit/post-p2-architecture-gap-diagnosis/DETERMINISTIC_CAPABILITY.md`
- `qa-audit/post-p2-architecture-gap-diagnosis/LLM_ROUTING.md`
- `qa-audit/post-p2-architecture-gap-diagnosis/STRATEGY_COMPARISON.md`

## Final decision statement

Phase B's grouping is directionally correct but incomplete: it should use
the already-recovered relation-density signal (not just directory
containment) to form deterministic group *membership*, and should add a
clearly-labelled, LLM-generated *name and description* layer on top of
that fixed membership — never LLM-decided membership, never an unmarked
label. This is a product-only extension of the existing "LLM proposes,
Laura's verifies" pattern applied to a new content type (a label, not a
claim), not a change to verifier semantics or the thesis's core
contribution. No implementation was performed; this is a recommendation
for the next design/implementation pass, pending explicit approval.
