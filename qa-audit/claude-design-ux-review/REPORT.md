# Independent Pre-Human UX & Epistemic-Comprehension Audit of Laura's

**Scope**: independent product/UX design review performed by acting through the real, running application in Chrome, immediately before Laura's first non-scored human usability dry run. **Observation only** — no production code, tests, prompts, verifier behavior, research semantics, or the human-study protocol were modified. No participant was recruited or run.

**Product HEAD reviewed**: `a350b8f5c54ff3b76d735ac88dfa9b82a1757207` (working tree clean at review start).
**Frozen readiness checkpoint referenced**: `v2-usability-dry-run-ready @ 4bdec8f`.
**Live frontend reviewed**: `http://127.0.0.1:5175` (the actual running `syntax-tree-ui` Vite dev server for this checkout, discovered from the live process list, not assumed).
**Dry-run repository used**: `pallets/flask`, pinned `6a2f545bfd8ed31e19066a299296917e034aca58`, at the checkout path specified in `docs/usability-dry-run/README.md`.

## Overall readiness

# NOT READY — MAJOR UX BLOCKER

Two BLOCKER-level findings were confirmed live, both landing directly on this program's central concern — whether a new user can tell what the LLM proposed from what Laura's deterministic evidence layer actually verified. Neither is an architectural problem: the underlying verifier/evidence system is sound, and the single best piece of LLM-vs-verifier explanatory writing in the whole product already exists (in Settings). The gaps are all in *surfacing* that correct understanding at the screens and moments where a new user actually forms their mental model. Every finding in this report is a bounded, communication/presentation-layer fix (highlighting, tooltip wiring, copy placement, container width) — none require touching parser, verifier, or relation semantics — consistent with the pattern of the four prior bounded UX fixes already shipped in this program (`3011bcf`, `bf40cea`, `16ff43d`, `43608b2`). But as observed live, today, the product is not yet ready to sit a first-time participant down in front of.

## Counts

| Severity | Count |
|---|---|
| BLOCKER | 2 |
| MAJOR | 4 |
| MINOR | 5 |
| POLISH | 1 |
| **Total** | **12** |

Full structured records: `findings.json`. Screenshots: `screenshots/`.

---

## 1. How this review was performed

Entirely through the live browser UI at the URL above, using Claude-in-Chrome — clicking, typing, hovering, scrolling, and reading the actual rendered DOM/accessibility tree — not from source code or from re-reading prior screenshots, except where explicitly noted (the one INSUFFICIENT EVIDENCE gap, §7, and one historical error screenshot, §13). Where source code was consulted, it was only to confirm an already-observed UI behavior (e.g. confirming the live frontend port from the running process list). Reference materials read first: all six files in `docs/usability-dry-run/`, `qa-audit/usability-dry-run-readiness/REPORT.md` and its screenshots/JSON, `docs/START_HERE.md`, `docs/OPENAI_CONFIGURATION.md`.

Live session performed: entered the pinned Flask checkout path on the first-launch screen → built the architecture map → drilled `flask → app.py → Flask → full_dispatch_request` → requested a real Architectural Explanation (5 claims, all SUPPORTED, real OpenAI call, ~8s latency) → expanded a claim's evidence chain → opened the real source file via **Open source** → returned to the explanation → opened the accessible-table alternative and confirmed its auto-collapse fix still holds → made a harmless wrong navigation turn (into `cli.py`) and recovered → opened **Settings** (read-only; API key stayed masked throughout, never revealed) → ran a basic keyboard-Tab focus check.

---

## 2. First-impression comprehension (Pass 1)

**If nobody told me what this was, I'd say**: a tool that scans a local codebase and gives me an explorable, evidence-backed map of its architecture, with the ability to ask for AI explanations of specific pieces that I can then verify against the real source.

That's a genuinely good first impression, and it comes almost entirely from the landing screen's own copy, which is well-written: "Syntax Tree scans a repository and turns it into a calm, source-backed architecture map," plus three feature cards ("Source-backed," "Meaning first," "Guided progress") that correctly preview the product's actual design principles. The primary action (paste a path, click **Build architecture map**) is unambiguous.

Two smaller first-screen issues, not blockers: an unexplained **"API mode"** badge in the corner of the scan card, and an unexplained **"Open legacy workspace"** link in the top nav — both internal-sounding labels with no visible explanation of what they do, though neither sits on the critical path of any participant task.

The much larger gap appears one click later (§3, §5) — the "Guided progress, no raw pipeline jargon" promise made on this very screen is broken almost immediately after the user takes the primary action.

## 3. Architecture map & entity orientation (Pass 3–4)

The map is a card grid (not a force-directed node/edge diagram as `docs/START_HERE.md`'s "node-and-edge diagram" phrasing might suggest) with faint background connector lines between related module cards. Breadcrumbs (`flask → app.py → Flask`) and a **Back to parent** button in the detail panel both correctly track depth, and returning via breadcrumb consistently restored the expected view. At every level, the right-hand detail panel makes reasonably clear what kind of thing is selected (`component`, `code group`, a class, a function with its exact file:line span) — entity-type orientation itself is *not* a blocker.

What *is* a problem at this stage is content, not navigation: the same screens that get navigation right are also where the dual-vocabulary and header-jargon issues (F01, F05) are most visible, because they appear on every single card.

One first-run-only oddity: an "Orientation ready — 50% confidence" panel appears before the full map, quoting `sansio/README.md` as "guidance-only material, not proof" with its own separate `50%` figure repeated underneath. This pre-map screen isn't mentioned at all in `docs/START_HERE.md`, and its confidence percentage is the first of several conflicting numeric-confidence signals a new user sees (§5, F01).

## 4. Architectural Explanation discoverability (Pass 5)

On a real symbol entity (a class or function), the **Architectural Explanation** button is present in the detail panel, clearly labeled with a sparkle icon. It is not the most visually prominent control on the panel (same visual weight as "View source proof" and "Save Lens"), but a reasonably curious user would find it without more than a Level 0–1 nudge. The prior readiness round's fix gating this button to `symbol:`-prefixed entities only (commit `16ff43d`) was reconfirmed live: the button is present on `Flask` and `full_dispatch_request`, and was previously confirmed absent on non-symbol container nodes like `app.py`'s module wrapper.

Clicking it produces a clean, well-labeled loading state ("Architectural Explanation: full_dispatch_request — Loading architectural explanation…") and, ~8 seconds later, a real result. This part of the flow works well.

## 5. Epistemic comprehension: SUPPORTED (Pass 6) — the central finding

See **F01** and **F02** in `findings.json` for full detail. In short:

- The visible claim-card text itself is good: `full_dispatch_request calls preprocess_request.` / **SUPPORTED** / `DIRECT RELATION: CALLS`, with no percentage attached to the claim.
- But the user arrives at that claim having already seen "Verified — 50% confidence" (orientation), "Verified — 98% confidence" (app.py), "Verified — 100% confidence" (the Flask class, and again on `full_dispatch_request` itself, one screen before the claim) — a *different*, numeric, percentage-based vocabulary describing something else entirely (static-extraction classification confidence), styled with the same tan/olive pill badge as SUPPORTED.
- The one documented safety net — `docs/START_HERE.md`'s claim that hovering SUPPORTED/INSUFFICIENT EVIDENCE gives "a one-line explanation of what it means" — did not visibly work in two direct hover tests (screenshot `issue-02`).

**Most likely new-user interpretation of SUPPORTED**, given all of the above: *"the AI/tool is fairly confident about this"* — not *"a deterministic verifier checked this claim against the real source and established it."* This is exactly the failure mode Section 16 of the audit brief asks to check for, and it is the reason for this report's BLOCKER classification.

## 6. Epistemic comprehension: INSUFFICIENT EVIDENCE (Pass 7)

**Could not be observed live.** All 5 claims generated in this session's real Architectural Explanation call were SUPPORTED; 0 were INSUFFICIENT EVIDENCE. The prior readiness round's own captured artifacts (`qa-audit/usability-dry-run-readiness/readiness-walkthrough-summary.json`) show the same — no INSUFFICIENT EVIDENCE example was captured there either. Per the audit brief's explicit instruction, this was **not** forced or manufactured. Recorded instead as an environment limitation (F12) with a direct consequence for the dry-run instrument itself: `PARTICIPANT_TASKS.md` Task E and `DEBRIEF_QUESTIONS.md` Q2 are both conditional on this state occurring naturally, and on the evidence gathered here, it may not.

Assessment based on legend/docs text only: the wording that *does* exist (`docs/START_HERE.md`: "insufficient evidence does not mean the claim is false, just that Laura's couldn't establish it from the code it analyzed"; the area-level legend's "Insufficient" entry: "The backend found this area, but source evidence is incomplete.") is correct and careful. But the area-level legend also has a state called **"Unsupported"** ("The available source evidence does not support this claim") — one word away from "SUPPORTED" and easily confusable with a negative/false verdict — which was never seen paired with any user-facing explanation of how it differs from claim-level INSUFFICIENT EVIDENCE.

## 7. LLM vs. verifier distinction (Pass 8)

The single clearest statement of this distinction anywhere in the product is in Settings: *"Every proposal is independently checked against your codebase by Laura's deterministic verifier before it is ever shown to you — the model never decides what is true."* This is excellent, precise, correct copy.

It is also unreachable from the exact screens where a user forms their SUPPORTED/INSUFFICIENT EVIDENCE mental model: the hamburger menu that opens Settings is present only at the repository-root breadcrumb (`flask` alone) and disappears the instant the user drills into any module, class, or function — confirmed live across three breadcrumb depths (F06). The Architectural Explanation panel's own preamble ("What Laura's could establish: …") gestures at the distinction but never states it outright at the point of use.

## 8. Claim → evidence → source (Pass 9)

Walked the full chain for the SUPPORTED claim `full_dispatch_request calls preprocess_request`:

- **Claim card**: clear atomic proposition, status badge correctly attached, generated wording is minimal and doesn't dominate.
- **Evidence chain**: expands on click (not on the badge itself — clicking the badge did nothing; clicking the claim text expanded it). Content is raw and partly truncated — hex symbol ids, an extractor tool name/version, mid-word truncation (`c..`, `sy..`) — reads as internal metadata, not proof (F03).
- **Open source**: discoverable, clearly labeled, opens the real file with a sticky class/function context header (a genuinely nice touch — you always know which class/function you're inside as you scroll). But the cited line (`app.py:1014`) carries **no highlight whatsoever** (F04) — this is the report's other BLOCKER, and directly answers the audit brief's own test question: yes, a user can click Open source and still fail to understand why that code is evidence.
- **Return**: closing the source viewer returned cleanly to the exact prior evidence-chain state, orientation preserved.

## 9. Source viewer (Pass 10)

Real Flask source, correct file, readable monospace, sticky structural breadcrumb (`class Flask(App):` / `def full_dispatch_request(...)`) pinned above the scrolling code — good context retention as you scroll a long function. The single missing piece is the highlight on the cited span (F04, above); everything else about the viewer supports comprehension.

## 10. Information architecture (Pass 11)

The product does read as one coherent workflow, not disconnected panels — breadcrumbs, back-to-parent, and the detail-panel tab set (**Simple / Technical / Evidence**) are consistent across every entity type tested. The one real IA weak point is the **Simple** vs **Architectural Explanation** pairing (F08): for a leaf function, "Simple" doesn't yet do enough to be distinguishable in purpose from the AI-generated explanation, since it currently just echoes the function signature rather than paraphrasing it.

## 11. Visual hierarchy (Pass 12)

Generally calm and legible (matches the "calm" self-description on the landing page) — good use of whitespace, consistent card treatment, readable type. The specific hierarchy problems found are all captured as their own findings: unexplained jargon competing for attention in the header (F05) and on entity tags (F07), and badge-style overlap between the two status vocabularies (F01).

## 12. Error & recovery UX (Pass 13)

No error was deliberately induced (per instructions). One relevant historical data point was reviewed from the prior readiness round's own screenshots (`qa-audit/usability-dry-run-readiness/screenshots/06-explanation-response.png`, for the same entity, `full_dispatch_request`): a raw `500: Internal Server Error` card with no Retry button and no friendly guidance. That specific class of failure (a bare `ssl.SSLError` escaping unwrapped) was already root-caused and fixed in this program (commit `43608b2`, "Wrap low-level socket/TLS errors as friendly RuntimeError, not raw 500") — this review did not attempt to reproduce it and treats it as resolved per that prior report, cited here only as useful context for what a raw failure state looks like when it does occur: notably, its plain red/pink card styling is visually distinct enough from SUPPORTED/INSUFFICIENT EVIDENCE badges that a technical error is unlikely to be mistaken for an epistemic verification outcome, which is the one relevant reassurance available from this artifact.

## 13. Settings UX (Pass 14)

Reviewed with the API key masked throughout; the key was never revealed, typed, or captured. Enabled ✓, Provider `OpenAI`, Base URL `https://api.openai.com/v1`, Model `gpt-5.4-mini`, API Key shown only as a masked placeholder with clear helper text ("A key is saved... Leave this blank to keep it, or type a new value to replace it. Remove saved key"). **Test connection** and **Save** are visually distinct buttons; no unsaved-changes state was present to evaluate (nothing was edited), but the presence of the dirty-state hint mechanism from the prior bounded fix (`3011bcf`) was not contradicted by anything observed. The panel's own descriptive paragraph is the best LLM-vs-verifier writing in the product (§7) — its main problem is reachability, not content.

## 14. Startup / operator documentation (Pass 15)

`docs/START_HERE.md` was checked claim-by-claim against the live UI: button labels, the 4-step launch sequence, the Architecture-view description, and the Architectural-Explanation description are all accurate to what was observed, **except** that it does not mention the pre-map "Orientation" screen (§3) or its confidence percentage at all, and its label "Open source" matches the evidence-chain button text observed live, while the entity detail panel's separate button is labeled "**View source proof**" — a different label for what a first-time reader of the doc might expect to be the same action (they are, in fact, two different things — a general "view the file" action vs. the evidence-linked "Open source" — but the doc doesn't disambiguate). `docs/OPENAI_CONFIGURATION.md` was already rewritten and verified accurate in the prior readiness round; nothing observed in this session contradicts it.

## 15. Accessibility (Pass 16)

Lightweight, not a formal audit. One concrete observation: 5 sequential Tab presses from the top-level architecture map produced no visible focus indicator in a full-page screenshot (F11) — reported as something to verify with a dedicated pass, not a confirmed defect (a screenshot cannot fully rule out a low-contrast or off-viewport ring). Status is conveyed via badge shape/color/text together (not color alone) throughout the panels reviewed, which is good. The accessible-table alternative (`View architecture as accessible tables`) opened correctly and its background-click auto-collapse fix (`bf40cea`) was reconfirmed working live.

## 16. Laptop-resolution usability (Pass 17)

Reviewed at a 1280×542–1568×733 viewport range (representative of a laptop window, not an oversized external monitor). No panel collisions, hidden actions, or forced horizontal scrolling were observed at this size; the evidence-chain truncation issue (F03) is a content/container-width problem within the existing panel, not a viewport-size problem — it was equally present at the wider viewport tested.

## 17. Wrong-turn recovery (Pass 18)

Made a harmless mistake (clicked into `cli.py`, an unintended module) and recovered via the top-left breadcrumb back to the repository root without difficulty. One minor ambiguity noted but not escalated to a finding: after using "Back to parent" at a top-level module (which has no parent above the repo root), the breadcrumb did not visibly change, though the URL's lens parameter did — behavior consistent with the button being a no-op at that depth, but worth a closer look outside this review's scope.

## 18. Dry-run instrument review (Pass 19)

`FACILITATOR_GUIDE.md`, `PARTICIPANT_TASKS.md`, `OBSERVATION_SHEET.md`, `DEBRIEF_QUESTIONS.md`, `SESSION_CHECKLIST.md` were all read. No click-level coaching, no leading debrief questions, and no dependency on hidden ground truth were found — the instrument is well-designed and appropriately goal-oriented throughout. The one concrete issue found is instrument-level, not wording-level: **F12**, Task E / debrief Q2's dependency on an INSUFFICIENT EVIDENCE claim appearing naturally, which this review's own live run (and the prior readiness round) did not produce. Recommend the facilitator privately pre-identify a Flask entity likely to produce one, without exposing it to the participant.

---

## Top pre-human-dry-run changes

Maximum 5 requested; 5 given, all directly threatening either core task completion or the specific epistemic-comprehension question this dry run exists to answer.

1. **F04 (BLOCKER)** — No highlight on the cited line in the source viewer. Impact: corrupts Task G and the "did you trust it" debrief question. Fix is presentation-only (no research-semantic impact).
2. **F01 (BLOCKER)** — Area-level numeric "confidence %" vocabulary visually/lexically collides with claim-level SUPPORTED/INSUFFICIENT EVIDENCE. Impact: corrupts Task D and debrief Q1, the single most important comprehension check in the whole session. Fix is visual/terminological separation; flagged **POTENTIALLY — REVIEW REQUIRED** only insofar as any wording change to the area-level vocabulary needs its own meaning preserved.
3. **F02 (MAJOR)** — SUPPORTED/INSUFFICIENT EVIDENCE hover tooltip, documented as existing, not visibly working. Impact: removes the one in-context safety net for Task D. No research-semantic impact.
4. **F03 (MAJOR)** — Evidence chain reads as raw, partly-truncated pipeline metadata. Impact: undermines Task F. No research-semantic impact.
5. **F05 (MAJOR)** — Raw run id / version slug in the header immediately after the primary action. Impact: breaks the "guided progress, no jargon" first impression at the worst possible moment (right after the user's first click). No research-semantic impact.

## Post-dry-run candidates

**F06** (Settings' best explanation is unreachable once drilled in), **F07** (`fallback no llm` unexplained tag), **F08** (Simple tab low-value content), **F09** (`How does ROUTE / work?` template bug), **F10** (Syntax Tree vs. Laura's branding mismatch), **F11** (keyboard focus visibility, needs a dedicated pass), **F12** (dry-run instrument's dependency on a natural INSUFFICIENT EVIDENCE occurrence). None of these are likely, on their own, to distort the dry-run result or block a core task; real human behavior should inform whether/how each is worth acting on.

## Findings we flag as semantically sensitive if pursued

Per the audit brief's own guardrail: **F01**'s recommended direction (separating the area-level confidence vocabulary from claim-level status) is the only recommendation in this report marked **POTENTIALLY — REVIEW REQUIRED**, and only because it touches wording adjacent to real, distinct concepts (extraction/classification confidence is not the same thing as claim verification, and both are real and worth keeping — they just need to stop looking like the same thing). No other finding in this report proposes changing what SUPPORTED, INSUFFICIENT EVIDENCE, CONTRADICTED, or "evidence" mean.

---

## Answers to the audit's core questions (§41)

**A. If a new developer sees SUPPORTED, what are they most likely to think it means?**
Most likely: "the AI/tool is fairly confident about this" — because of the surrounding, visually similar, numeric confidence-percentage vocabulary at the area/component level (§5, F01), not because the SUPPORTED label's own wording or the claim card's own text is unclear.

**B. Does the design clearly communicate SUPPORTED comes from deterministic verification, not model confidence?**
Not yet, live. The correct explanation exists (Settings, §7) but is not reachable from where the user is when they see SUPPORTED, and the one documented in-context safety net (hover tooltip) did not visibly work (F02).

**C. Is INSUFFICIENT EVIDENCE likely read correctly?**
Untested live (§6) — none occurred naturally in this session or in prior captured artifacts. Based on wording alone it's reasonably well-written, but sits one word away from a different, area-level "Unsupported" state that risks being read as a negative/false verdict.

**D. Can the user tell which part of the explanation is LLM-originated vs. deterministic evidence?**
Partially. The claim card itself (proposition + status + relation type) reads as structured/verified content, and the evidence chain, once opened, is clearly a separate, more technical block — but its raw/truncated presentation (F03) undercuts rather than reinforces that separation.

**E. Can a user understand why a specific evidence relation and source line support a claim?**
No, as currently rendered — this is F04, the report's other BLOCKER. The mechanism to make this legible (highlighting the cited line) does not exist in the current source viewer.

**F. Can an unfamiliar developer navigate repository → map → entity → Architectural Explanation → claim → evidence → source without developer knowledge?**
Yes, mechanically — every navigation step in this chain was completed live without needing source-code knowledge or facilitator-level shortcuts. The blockers in this report are comprehension/legibility problems once you arrive at each step, not navigation/discoverability problems.

**G. What should change before the first real human dry run?**
The five items listed under **Top pre-human-dry-run changes**, above.

---

## Confirmations

- **No production code changed.** No `.ts`/`.tsx`/`.css`/`.py`/`.ps1`/`.env` file was edited.
- **No research semantics changed.** SUPPORTED/INSUFFICIENT EVIDENCE/CONTRADICTED definitions, the verifier, and relation semantics were not touched; the formal A/B/C protocol and Condition B work were not opened.
- **No participant session occurred.** No one was recruited or run; all interaction in this report was performed by the reviewer acting through the real UI, standing in for a future participant.
- **No credential was exposed.** The OpenAI API key remained masked in Settings throughout (§13) and was never typed, copied, or captured in any screenshot.

## Artifact paths

- `qa-audit/claude-design-ux-review/REPORT.md` (this file)
- `qa-audit/claude-design-ux-review/findings.json`
- `qa-audit/claude-design-ux-review/screenshots/issue-01-orientation-confidence-percentage.jpg`
- `qa-audit/claude-design-ux-review/screenshots/issue-02-supported-badge-no-tooltip.jpg`
- `qa-audit/claude-design-ux-review/screenshots/issue-03-source-viewer-no-highlight.jpg`
- `qa-audit/claude-design-ux-review/screenshots/issue-04-settings-masked-key.jpg`

## Final classification

# NOT READY — MAJOR UX BLOCKER

This is an expert design judgment based on acting through the real product as a stand-in for a first-time participant, not proof of how an actual human would behave. Two BLOCKER-level and four MAJOR-level findings, all bounded and presentation-layer in nature, are recommended for remediation before Participant #1; the next step is for these findings to be reviewed by the team before any implementation or scheduling decision is made.
