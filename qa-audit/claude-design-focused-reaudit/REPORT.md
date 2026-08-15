# Focused Claude Design Re-Audit — Pre-Human UX Remediation

**Mode**: observation only. No code was edited, no fixes implemented, no new requirements created, no human participant session started. This re-audit does not reopen the general UX audit — it answers exactly one question: *are the six original BLOCKER/MAJOR findings now meaningfully resolved for an unfamiliar developer?*

**Product HEAD reviewed**: `f50ebb9eb479f754af4d1b9afb16a9aaaaf9931b` (the remediation commit).
**Original audit evidence**: `b7daa57a39657b3bb5b9ea818ef65d605a1c2e21`.
**Live frontend**: `http://127.0.0.1:5175`, same pinned `pallets/flask` repository/run used throughout this program.

---

## Verdicts

| Finding | Verdict |
|---|---|
| F01 — confidence vs. verification | **RESOLVED** |
| F02 — source evidence highlight | **RESOLVED** |
| F03 — SUPPORTED / INSUFFICIENT EVIDENCE communication | **RESOLVED** |
| F04 — evidence chain legibility | **RESOLVED** |
| F05 — run context / raw hash | **RESOLVED** |
| F06 — LLM vs. verifier distinction | **RESOLVED** |

**6 RESOLVED, 0 PARTIALLY RESOLVED, 0 NOT RESOLVED.**

Full structured record with evidence per finding: `findings.json`. Screenshots: `screenshots/`.

---

## F01 — Confidence vs. verification

Checked fresh, from scratch, at three depths: pre-map orientation, the `app.py` component, and the `Flask` class / `full_dispatch_request` function.

1. **What does "map confidence" refer to now?** A structural-analysis classification score — the copy states this explicitly wherever it appears.
2. **Visually distinct from claim verification?** Yes — every instance is a dashed, unfilled pill, distinct from the filled "Verified"/"Orientation ready" status pills sitting next to it.
3. **Would a reasonable user still infer SUPPORTED = AI confidence?** Unlikely — no claim-level SUPPORTED/INSUFFICIENT EVIDENCE badge carries a percentage anywhere in this workflow, and the map-confidence badge's own accessible text says outright "not a claim verification status, and not the AI's confidence in a generated explanation."
4. **Does the tooltip clarify?** Yes, and it's reachable without hovering — confirmed via the accessibility tree, not just a mouse-only `title`.
5. **Any remaining unlabeled confidence percentage near claim verification?** None found.

## F02 — Source evidence highlight

Performed SUPPORTED claim → evidence → Open source twice, on two different claims/lines (`app.py:1014` and `app.py:1019`), and waited well past the old 1.5-second auto-clear window each time.

1. **Visually distinguishable?** Yes, on the first (unobstructed) check: a persistent gold background plus a left gutter marker, still present after 5+ seconds.
2. **Immediately identifiable as "the evidence Laura's cited"?** Yes.
3. **Precise, not whole-file?** Yes — only the cited line(s), not the surrounding function or file.
4. **Surrounding context still readable?** Yes.
5. **Could a user explain the connection?** Yes — the highlighted line is the exact statement matching the claim's relation (e.g. `rv = self.preprocess_request(ctx)` for "calls preprocess_request").

One incidental observation, not escalated (see `findings.json` for the full note): on the second claim checked, Monaco's sticky-scroll context header happened to visually overlap the just-revealed target line at that particular scroll position. The decoration itself was independently confirmed present and correctly targeting the right line via the accessibility tree regardless — this reads as a viewport/scroll-timing nuance, not a missing or mistargeted highlight, and does not change the RESOLVED verdict.

## F03 — SUPPORTED / INSUFFICIENT EVIDENCE communication

Inspected Architectural Explanation directly, without visiting Settings first.

1. **Understand SUPPORTED from the UI itself?** Yes — an always-visible legend states it before any claim even loads.
2. **Understand INSUFFICIENT EVIDENCE from the UI itself?** Yes, same legend.
3. **Communicated as evidence status, not model confidence?** Yes — "Laura's found deterministic source-derived evidence establishing this proposition," no confidence language.
4. **Keyboard-reachable?** Yes — confirmed via accessible name on each claim, not just the shared legend.
5. **Does any wording imply INSUFFICIENT EVIDENCE = false?** No — it explicitly states "It does NOT automatically mean the statement is false."
6. **Does any wording imply SUPPORTED = model confidence?** No.

## F04 — Evidence chain legibility

Checked two different claims' evidence chains.

1. **Understandable without opening Technical details?** Yes.
2. **Entity/relation names readable?** Yes — "CALLS" leads, in full (the CSS-truncation bug found during the original remediation's own verification stays fixed).
3. **Relation type understandable?** Yes.
4. **Source location understandable?** Yes, once Open source is used.
5. **Opaque hashes/tool versions still dominant?** No — moved behind a collapsed "Technical details" disclosure, confirmed closed by default.
6. **Technical details preserves provenance without burdening the normal flow?** Yes — expanded and confirmed the raw ids/producer/description are all still present, on demand.

One incidental observation, not escalated: inside the (opt-in, collapsed-by-default) Technical details block, the raw description field wraps awkwardly (near one character per line) in its narrow column at this viewport width. Cosmetic, behind a disclosure most users won't open, does not affect the RESOLVED verdict.

## F05 — Run context / raw hash

1. **Still over-prominent?** No — "active run" is now the primary label.
2. **Reads as secondary/provenance context?** Yes — abbreviated id, smaller/muted styling.
3. **Competes with repo/entity context?** No.
4. **Natural label?** Yes.
5. **Full id hidden from scanning but available when needed?** Yes — via accessible title/aria-label and a dedicated copy button. The literal "Run Run" double-prefix bug is confirmed gone (accessible name now reads correctly as a single "Full run id: run:...").

## F06 — LLM vs. verifier distinction

Settings was not opened before or during this check, by design.

1. **Where do claims come from?** Stated directly: "The model proposes architectural claims."
2. **Who decides SUPPORTED?** Stated directly: "Laura's then independently checks each one against recovered source evidence — the model never decides what is true."
3. **What does evidence represent?** Covered by the SUPPORTED/INSUFFICIENT EVIDENCE definitions immediately following.
4. **Apparent before opening Technical details?** Yes — this is in the always-visible legend, not gated behind any disclosure.
5. **Could a developer still leave believing "the AI generated this and marked it supported"?** Unlikely, given the explicit "the model never decides what is true" sentence sitting directly above the claims.
6. **Does the UI avoid implying the whole generated narrative is independently proven?** The legend correctly scopes verification to "each one" (each claim/proposition), not the narrative prose as a whole; this wasn't stress-tested further (e.g. against a claim with unverified surrounding narrative text) in this focused pass.

---

## Minimum end-to-end check

Performed once, in full, through the real UI only: repository → map → `Flask` class → `full_dispatch_request` → Architectural Explanation → SUPPORTED claim → evidence → Open source → source highlight → return to explanation. Orientation, status comprehension, evidence comprehension, and source connection all read clearly at each step; returning from the source viewer preserved the exact prior evidence-chain scroll/expand state both times.

## New issues

**None classified.** Two incidental, non-blocking observations were made during verification (documented above and in `findings.json`) — neither meets the BLOCKER bar (core workflow cannot be completed / fundamentally misunderstood) or the MAJOR bar (serious epistemic misunderstanding / likely Level 2–3 facilitator help). Per instruction, F07–F12 were not reassessed or promoted.

---

## Final classification

# READY FOR HUMAN DRY RUN

All six original BLOCKER/MAJOR findings are RESOLVED on fresh-eyes re-inspection of the real, running application. No new BLOCKER or MAJOR issue was found. The two minor incidental observations recorded above are reasonable candidates for real human dry-run evidence alongside the already-deferred F07–F12, not blockers to starting.

**STOP FOR REVIEW.** Participant #1 has not been started.
