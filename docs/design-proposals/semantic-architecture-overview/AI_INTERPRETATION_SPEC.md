# AI Architectural Interpretation — Component Spec, Timing, Fallback

Design-only document. Specifies Layer 3 exactly (`INFORMATION_MODEL.md`).

## Component A — AI Architectural Interpretation (Layer 3)

```
┌──────────────────────────────────────────┐
│ ✦ AI interpretation                       │   <- chip, sparkle icon, distinct
│ Authentication & Sessions                 │      accent color never reused by
│                                            │      StatusBadge/claim-status colors
│ Structural cluster · 5 modules            │   <- neutral Layer-2 ground truth,
│                                            │      always shown, never hidden by
│                                            │      the AI label
│ auth.service.js                           │
│ email.service.js                          │
│ notification.service.js                   │
│ +2 more                                   │
│                                            │
│ AI interpretation:                        │
│ "Handles authentication, token            │
│  validation, and session lifecycle."      │
│                                            │
│ Why these modules are grouped ▸           │   <- disclosure, see Component C
└──────────────────────────────────────────┘
```

**Placement rule:** the AI chip + name sit ABOVE the neutral "Structural
cluster · N modules" line, never replacing it. A user who distrusts or
ignores the AI content still sees the true, deterministic identity of the
group underneath it at all times — this is what makes Layer 3 an overlay,
not a relabeling.

**Accessible name:** `"AI interpretation: Authentication & Sessions.
Structural cluster of 5 modules. Select to explore."` — the "AI
interpretation:" prefix is never dropped from the accessible name, so a
screen-reader user gets the same epistemic signal a sighted user gets from
the chip.

## Component B — Verified Architectural Statement (Layer 4, pre-existing, unchanged)

```
┌──────────────────────────────────────────┐
│ ✓ SUPPORTED                               │   <- existing StatusBadge, existing
│ AuthController calls JwtService           │      claim-status color vocabulary
│                                            │
│ Verified from source evidence             │
└──────────────────────────────────────────┘
```

**Hard rule, enforced by construction, not just convention:** Component A
and Component B must never share a badge component, an icon, or a color
token. `SUPPORTED`/`INSUFFICIENT EVIDENCE`/`CONTRADICTED` are reserved
exclusively for `ArchitecturalClaim.support_status`; the "AI
interpretation" chip is a structurally different React component with its
own icon/color that cannot render any of those three strings. This should
be enforced at the type level in implementation (Phase C3): the AI-label
component's props should not even accept a `ClaimSupportStatus` value.

## Component C — "Why these modules are grouped" disclosure

```
Why these modules are grouped ▾
  5 modules
  6 internal import/call relationships
  0 external-only dependents

  auth.service.js  →  imports  →  email.service.js
  auth.service.js  →  imports  →  notification.service.js
  ... (real edges, capped, "+N more")
```

This shows **structural evidence that the cluster exists** (real counts,
real edges) — it must never be worded as evidence that proves the AI's
chosen name is correct. Required copy discipline: *"Structural evidence
supports the existence of this cluster"* — never *"evidence for
Authentication."* The disclosure content is identical whether or not a
Layer-3 label has ever been generated for this cluster (it is Layer-2
evidence, not Layer-3 evidence) — this is important: it means a user can
inspect *why the cluster exists* even in No-LLM mode, before ever
requesting an AI name.

## Generation timing — recommendation

Compared:

| Option | Cost/latency | Fits user expectation | Reproducibility | Verdict |
|---|---|---|---|---|
| A. Generate all labels immediately after analysis | High — N LLM calls per run, most never viewed | Poor — most repos have far more clusters than a user will ever open | Non-reproducible across re-runs if regenerated | Rejected |
| B. Generate lazily when a group becomes visible (scrolled into view) | Still fires calls for clusters the user glances past without opening | Ambiguous — user didn't ask, so an unexpected provider call fires from mere scrolling | Same non-reproducibility issue | Rejected — repeats exactly the "ordinary navigation fires LLM traffic" incident class the map routes were already hardened against once |
| **C. Generate only on explicit user action ("Generate AI interpretation")** | Lowest — one call per explicit request, cached thereafter | Matches the existing product pattern (Architectural Explanation is already opt-in per entity) | Reproducible: same cached result returned until explicitly regenerated | **Recommended** |
| D. Hybrid cache/lazy | Same risk as B for the "lazy" half | Same ambiguity as B | — | Rejected — inherits B's core problem |

**Recommendation: C.** This is not just the safest choice on cost/latency;
it is required by the project's own established precedent — the map
routes are deliberately hard-gated against automatic LLM traffic
specifically because ordinary navigation once fired unintended calls. A
Layer-3 label appearing automatically the moment a cluster scrolls into
view would reopen exactly that incident class one layer up the stack. An
explicit `[Generate AI interpretation]` button per cluster (visible at
State 1/State 2, see `STATE_1_OVERVIEW.md`/`STATE_2_GROUP.md`) is the only
option consistent with "AI is always an explicit, attributable, opt-in
action."

**Caching:** once generated, cache the label/description keyed by
(`overview_input_hash`, cluster member-id-set) — same pattern the existing
`overview_input_hash`/`PROJECTION_VERSION` caching already uses elsewhere,
so re-opening the same analysis run does not re-fire the model, and a
changed member set (different clustering result on a new run) correctly
invalidates the cached label rather than silently reusing a stale name for
different members.

## No-LLM / provider-off experience

Fully usable without any model configured — this is not a degraded mode,
it is the default and majority mode (per the post-P2 diagnosis, the map
routes are hard-gated off by default regardless of Settings):

```
┌──────────────────────────────────────────┐
│ Structural cluster · 5 modules            │
│                                            │
│ auth.service.js                           │
│ email.service.js                          │
│ notification.service.js                   │
│ +2 more                                   │
│                                            │
│ [ AI interpretation unavailable ]          │  <- disabled affordance if no
│   Configure a provider in Settings          │    provider is configured at all
│                                            │
│ Why these modules are grouped ▸           │  <- always available, no LLM needed
└──────────────────────────────────────────┘
```

If a provider IS configured, the same slot instead shows `[ Generate AI
interpretation ]` as an enabled action (Component A's entry point).
Navigation, drill-down, evidence, and everything else in State 1–4 works
identically in both cases — the AI slot is always a self-contained,
optional addition to an already-complete screen, never a blocking
dependency.

## Doc Studio relationship

- **Should AI group interpretations appear in Doc Studio?** Yes, as an
  explicitly attributed section — if a user has generated Layer-3 labels
  during exploration, Doc Studio should be able to include them, but only
  under a clearly separate heading (e.g. "AI-Interpreted Architecture
  (unverified)") distinct from any deterministic/source-backed section.
- **Can Architectural Explanation be exported/assembled into
  documentation?** Yes in principle — it already carries real
  `support_status`/evidence; exporting it should preserve that status
  per-statement, not flatten it into undifferentiated prose.
- **Must Doc Studio identify deterministic vs. AI-generated sections?**
  Yes, non-negotiably, for the same reason Layer 3 must never look like
  Layer 1/2/4 anywhere else in the product — a documentation export is
  exactly the kind of artifact that gets copy-pasted out of context, so
  the provenance marking must survive the export, not just the live UI.
- **Explicitly not proposed:** bulk unverified generated prose describing
  "what the whole repository does" beyond what real analysis supports.
  Every AI-authored sentence in an export must trace to a specific,
  inspectable Layer-2 cluster or Layer-4 claim it was generated from.
