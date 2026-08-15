# Usability Dry-Run Readiness Report

**Scope**: product/usability preparation for 1-2 non-scored human dry runs. This is **not** a research validation and contains **no participant data** — no one was recruited or run.

**Verdict: READY FOR NON-SCORED HUMAN DRY RUN**

---

## 1. Frozen-state confirmation

- Product HEAD at the start of this round: `314c298` (the cross-repository real-OpenAI validation synthesis, already frozen and accepted).
- Working tree was clean at the start of this round.
- Request-dedup fix confirmed present in current source (`explanationCache`/`invalidateArchitecturalExplanationCache` in `syntax-tree-ui/src/features/architectural-explanation/api.ts`).

## 2. Full end-user workflow review (real UI, no developer shortcuts)

Walked the complete flow through the real browser: first launch → Settings → repository selection → analyze → progress → map inspection → entity navigation → Architectural Explanation → evidence expansion → Open source → return navigation → a harmless-mistake recovery → close. See §7 for the specific run and its screenshots.

## 3. Re-audit of the two previously known UX observations

### A. Accessible-table overlay intercepting canvas clicks

- **Prior status**: documented, not changed.
- **Current finding**: **STILL REPRODUCIBLE.** `.obs-graph-alternative` is still a `position: absolute` overlay sitting on top of the canvas, unchanged since the prior audit.
- **Action**: bounded fix — a click landing on the panel's own background/whitespace (not the summary toggle, not a row-navigation button) now auto-collapses the panel, so a click intended for a canvas node underneath it recovers on the next attempt instead of silently doing nothing. Commit `bf40cea`. 2 new tests added and passing; live-verified in the readiness walkthrough (`11-accessible-table-open.png` → `12-accessible-table-auto-collapsed.png`).

### B. Module-id 404 noise

- **Prior status**: documented, not changed.
- **Current finding**: **STILL REPRODUCIBLE.** The "Architectural Explanation" button/panel were shown and auto-fetched for *any* selected node, including non-symbol module/package/component-group container ids — `api/routes/architectural_explanation.py` always 404s ("Entity not found") for these, since it only ever resolves against a real `ParsedSymbol`.
- **Action**: bounded fix — both the button and the panel are now gated to entity ids starting with `symbol:` (the only ids that route can ever resolve). Commit `16ff43d`. 3 new tests added and passing; live-verified — after navigating back to `app.py` (a genuine non-symbol container), the button is confirmed absent and no fetch occurs (`10-module-node-selected-no-explanation-button.png`).
- **New, related, non-defect observation**: navigating through an *intermediate* node that IS a real symbol (e.g. the `Flask` class itself — classes are `ParsedSymbol`s too) while the panel is left open still auto-fetches for it. This is correct behavior (a real, explainable entity got a real explanation), not 404 noise, but it does mean an open panel can trigger extra real generations during navigation the user didn't explicitly request. Documented here as a separate, lower-priority observation, not fixed in this bounded round (out of the scope given — "do not touch parser/verifier/relation semantics" and this would require a larger navigation/panel-lifecycle design decision).

## 4. Settings usability

**Gap found**: a successful "Test connection" showed only *"Connected successfully."* with no indication that the configuration was still unsaved (or that Enabled was still off) — a reasonable user could believe the feature was now active.

**Fix**: `SettingsPanel.tsx` now tracks an `isDirty` comparison (current form vs. last-saved values). A successful test while dirty appends: *"This only checked the connection — it did not save or enable anything. Click Save to apply these settings."* Any unsaved edit shows a persistent *"Configuration has unsaved changes"* hint until Save is clicked. Commit `3011bcf`. 2 new tests added and passing (one for the post-test hint, one for the general dirty-state hint clearing on save).

No credentials are ever persisted to disk to achieve this — it is purely a client-side comparison against the already-fetched saved state.

## 5. Startup / operator documentation status

- `docs/START_HERE.md`: reviewed against the real UI (button text, labels, navigation paths) — accurate, no changes needed.
- `docs/OPENAI_CONFIGURATION.md`: **was stale** and has been rewritten:
  - Documented only 3 Provider values (off/OpenRouter/Blackbox); the product now has an explicit, first-class **OpenAI** provider option (`app/investigation/providers.py`, `SUPPORTED_PROVIDERS`) that this doc didn't mention, instead recommending the old OpenRouter-plus-base-URL-override workaround.
  - Example model was `gpt-5.6-luna` (never verified live); replaced with `gpt-5.4-mini`, the model actually used and verified across every real-OpenAI validation round in this program (`qa-audit/live-openai-*-validation/`).
  - Did not document the automatic `max_completion_tokens`/`reasoning_effort` request-shape switch for OpenAI (commit `b2849e8`, already in product).
  - Did not document TLS verification behavior (`SYNTAX_TREE_LLM_SSL_VERIFY`) or the Save-vs-Test-connection distinction.
  - All corrected, each claim re-verified directly against current backend source, not carried over from the old doc.
- `.\doctor.ps1` run: result **READY**. Confirmed `provider=openai` live via `GET /api/health`, matching the corrected doc.

## 6. Dry-run session policy

Laura's is launched via `.\start-lauras.ps1` (Vite dev server for the frontend + a `uvicorn --reload` dev server for the backend) — this **is** the actual accepted launcher; Laura's is **not** a packaged desktop application, and `docs/usability-dry-run/README.md` states this honestly. The facilitator starts Laura's before the participant arrives (`SESSION_CHECKLIST.md`). The participant never needs git worktrees, Python virtual environments, backend logs, internal entity ids, environment variables, or developer tools at any point in the task script.

## 7. Dry-run repository

**pallets/flask**, pinned at `6a2f545bfd8ed31e19066a299296917e034aca58` — the same revision already validated in this program's Flask research rounds. Checkout: `C:\Users\LENOVO T14\Development\lauras-gt-r2-flask\research\real-repo-pilot\repos\r2-medium\source\src\flask`. Chosen over the controlled `python_app` fixture (too synthetic) for exactly the reasons given in the task: public, already validated, relatively strong deterministic coverage, multiple navigable entities/supported claims known. The frozen ground-truth claims file is never shown to the participant.

## 8. Non-scored dry-run script

`docs/usability-dry-run/PARTICIPANT_TASKS.md` — 9 goal-oriented tasks (A–I: orientation, entity discovery, Architectural Explanation, interpreting SUPPORTED, interpreting INSUFFICIENT EVIDENCE if naturally shown, evidence expansion, Open source, return navigation, harmless-mistake recovery). No click-by-click instructions except as a recorded Level 3 intervention if the participant is genuinely stuck.

## 9. Facilitator intervention policy

Defined in `docs/usability-dry-run/FACILITATOR_GUIDE.md`: Level 0 (no help) / Level 1 (generic prompt) / Level 2 (directional help) / Level 3 (explicit instruction). Every Level 2/3 must be recorded; a Level 3 on a core workflow is flagged as a candidate blocker for review before the formal study.

## 10. Observation categories

`docs/usability-dry-run/OBSERVATION_SHEET.md` covers: hesitation points, wrong navigation attempts, misunderstood labels, legend/tooltip noticing, correct-in-own-words explanation of SUPPORTED, the "SUPPORTED means the AI is confident" misconception check, INSUFFICIENT EVIDENCE understanding, ability to find the source span, intervention tally by level, major blockers, accessibility issues, and spontaneous comments. Timing, if recorded, is explicitly framed as diagnostic only — no significance testing, no study-outcome framing.

## 11. Debrief questions

`docs/usability-dry-run/DEBRIEF_QUESTIONS.md` — 9 questions (what did SUPPORTED/INSUFFICIENT EVIDENCE mean to you, trust, source-vs-AI distinction, difficulty, one thing to change, would-you-use-this-on-an-unfamiliar-codebase, expectation gaps, open-ended). Kept explicitly separate from the formal A/B/C study questionnaire.

## 12. Recording / privacy procedure

`docs/usability-dry-run/FACILITATOR_GUIDE.md` and `SESSION_CHECKLIST.md`: screen recording, participant audio only with consent, facilitator intervention notes taken live. The API key is configured **before** recording starts and is never typed or shown on camera — confirmed structurally (masked field, never returned by `GET`/`PUT /api/settings/architectural-explanation`) and confirmed live in this round's own walkthrough (`settingsKeyNeverShownInDom: true`, checked via DOM text-content inspection after opening Settings).

## 13. Readiness walkthrough result

Ran the complete task flow myself, through the real browser, no developer shortcuts (`qa-audit/usability-dry-run-readiness/readiness-walkthrough-summary.json`):

- First launch, Settings, analyze, map render, entity navigation, evidence expansion, Open source, return navigation, and harmless-mistake recovery all completed successfully.
- Accessible-table auto-collapse: confirmed working live.
- Module-id 404 gating: confirmed working live (button absent, zero extra request on the genuine container node).
- Request-dedup: held for every entity touched (exactly 1 backend POST per entity id).
- Legacy provider traffic: none (only the architectural-explanation OpenAI path made external requests).

**One real, unplanned finding**: the first Architectural Explanation request hit a genuine transient network condition — `ssl.SSLError: [SSL: SSLV3_ALERT_BAD_RECORD_MAC]` (a corrupted/dropped TLS record mid-response). It surfaced as a raw, unhandled HTTP 500 with no Retry/Settings guidance, instead of the friendly "Architectural explanation unavailable" UX every other network-failure class already gets. Root-caused to `OpenAICompatibleInvestigationModel.complete_json` only wrapping `HTTPError`/`URLError` into the `RuntimeError` that `_verify_claims_or_503` converts to a friendly 503 — a bare `ssl.SSLError` is not a `URLError` subclass and escaped unwrapped. Fixed by also catching `OSError` (commit `43608b2`), verified with 2 new targeted unit tests plus the full backend suite (528 passed). The *second* entity requested in the same run (`wsgi_app`) succeeded normally (HTTP 200), confirming this was a one-off transient condition, not a systemic outage.

Live re-capture of a clean success after the fix was not performed: the exact transient TLS condition isn't reliably reproducible on demand, and applying the fix required a backend restart (the dev `--reload` watcher had already left the backend process down mid-request when I edited the file), which cleared the runtime-only OpenAI credential — expected, already-documented behavior (`docs/OPENAI_CONFIGURATION.md`, "Credential handling"), not something authorized to work around by re-entering a credential myself. Re-entering the key and confirming Test Connection is now `SESSION_CHECKLIST.md`'s first pre-session step.

## 14. Screenshots

15 screenshots in `qa-audit/usability-dry-run-readiness/screenshots/`: `01-first-launch.png` through `14-ready-state.png` (see `result.json` for the full list), covering first launch, Settings' clean baseline state, analysis progress and completion, entity selection, the explanation response (including the transient-error state described above), evidence chain, Open source, return navigation, the container-node gating check, the accessible-table open/auto-collapsed pair, and the recovered-selection state.

## 15. `docs/usability-dry-run/` artifact paths

`README.md`, `FACILITATOR_GUIDE.md`, `PARTICIPANT_TASKS.md`, `OBSERVATION_SHEET.md`, `DEBRIEF_QUESTIONS.md`, `SESSION_CHECKLIST.md`.

## 16. `qa-audit/usability-dry-run-readiness/` artifact paths

`REPORT.md` (this file), `result.json`, `readiness-walkthrough-summary.json`, `screenshots/`.

## 17. Product commits from bounded UX fixes

| Commit | Summary |
|---|---|
| `3011bcf` | Distinguish a successful connection test from a saved/enabled configuration |
| `bf40cea` | Auto-collapse the accessible-table overlay on a background click |
| `16ff43d` | Gate Architectural Explanation to symbol entities only |
| `43608b2` | Wrap low-level socket/TLS errors as friendly RuntimeError, not raw 500 |

All four ship real tests (2 + 2 + 3 + 2 = 9 new tests) and the full suites pass: frontend 36/36, backend 528/528. None touch parser/verifier/relation semantics.

## 18. Research mechanism changed

**No.** Nothing in the formal A/B/C human-evaluation protocol, Condition B source-context/citation-length normalization work, or any research branch was touched.

## 19. Participant recruited or run

**No.** No one was recruited, no session was run, no usability findings were fabricated. This report is entirely about product readiness, verified by me acting through the real UI, standing in for a future participant.

## 20. Verdict

# READY FOR NON-SCORED HUMAN DRY RUN

The one outstanding action before a real session is re-entering the OpenAI API key in Settings and confirming Test Connection succeeds — a normal, already-documented pre-session step (now `SESSION_CHECKLIST.md` step 4), not a product blocker.
