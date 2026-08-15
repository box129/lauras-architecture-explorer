# Bounded Pre-Human UX Remediation

**Scope**: implement only the 2 BLOCKER and 4 MAJOR findings from the frozen Claude Design independent UX audit (`qa-audit/claude-design-ux-review/`, commit `b7daa57`). Presentation/interaction layer only. No parser, relation-extraction, verifier, proposition-vocabulary, evidence-construction/persistence, D4, source-region-truth, LLM-prompt, or provider-behavior changes. No backend changes at all were needed or made. The formal A/B/C study protocol was not touched.

---

## 1. Claude Design audit evidence commit

`b7daa57a39657b3bb5b9ea818ef65d605a1c2e21` — "Freeze independent pre-human UX audit" (`qa-audit/claude-design-ux-review/REPORT.md`, `findings.json`, `screenshots/`, unmodified by this round).

## 2. Finding IDs implemented

**F01** (BLOCKER), **F04** (BLOCKER), **F02** (MAJOR), **F03** (MAJOR), **F05** (MAJOR), **F06** (MAJOR) — the exact six IDs from `findings.json`. The 5 MINOR (F07–F11) and 1 POLISH (F09 is POLISH-severity but numbered inline with MINORs in findings.json — see the exact severity field for each) findings were **not** implemented; see §17.

## 3. Exact semantic meaning of the pre-existing confidence percentage

Traced to source before touching anything, per instruction not to invent a label:

- `syntax-tree-refurbished-backend/.../app/architecture_map/projection.py`: for a symbol node, `confidence = 1.0 if region else 0.6` — literally "did a source region resolve for this symbol." For components/areas, `confidence = component.confidence`, itself sourced from `app/overview/system_overview_generator.py`'s heuristic repo-shape/area scores (e.g. `0.98` for a populated static module graph, `0.7` for an inferred repo shape, `0.3` for an unknown one). For relationships, `0.8 if verified else 0.45`.
- **Conclusion**: this is a deterministic, structural/classification confidence produced entirely by local static-analysis heuristics — never by the Architectural Explanation LLM, never a claim-verification score. It answers "how confident is the map-building pipeline that this area/relationship was correctly identified/resolved," not "how sure is the AI" and not "is this claim supported."
- **Label applied**: "map confidence" (per the brief's own suggested example), everywhere this number is rendered: `VoiceRail.tsx` (entity detail panel), `RepoOrientationPanel.tsx` (pre-map orientation + area/reading lists), `ArchitectureMapCanvas.tsx` (accessible-table relationship column). Backend field itself (`confidence`) is unchanged — this is a presentation-layer relabeling only.

## 4. How confidence vs. verification is now distinguished

Two independent signals, applied everywhere the number appears:

1. **Wording**: every instance now reads "NN% map confidence" (never bare "NN% confidence"), with a `title`/`aria-label` explanation: *"How confident Laura's structural analysis is that this area/relationship was correctly identified and classified. This is a static-analysis classification score, not a claim verification status, and not the AI's confidence in a generated explanation."* (`src/design/mapConfidence.ts`, the single shared source of this copy).
2. **Visual style**: the map-confidence badge is now rendered with a **dashed, unfilled border** (`.obs-voice__map-confidence`, `.repo-orientation__confidence`), visually distinct from the filled "Verified"/status pills sitting right next to it, so it can't be mistaken for the same kind of badge at a glance.

No percentage was added to SUPPORTED/INSUFFICIENT EVIDENCE, and no confidence-flavored language was added to those labels (explicitly prohibited).

## 5. SUPPORTED communication change

- `StatusBadge.tsx`: `aria-label` now carries the full description (`"Verified: Laura's found deterministic source-derived evidence establishing this proposition."`) instead of just the bare status word — the one thing a screen-reader user previously got on focus was "Verified," with no way to learn what that meant without a mouse-hover `title` (never keyboard-reachable).
- `ClaimCard.tsx`: the claim badge chip now also carries this full text as its own `aria-label`, which becomes part of the containing claim button's accessible name — so the meaning is reachable by keyboard/screen-reader focus alone, not hover-only.
- `ArchitecturalExplanationPanel.tsx`: a new, **always-visible** (present in every state — loading, error, and loaded) "How to read these claims" block states the SUPPORTED definition in plain text, reusing the exact existing copy from `claimStatus.ts` (no new wording invented).

## 6. INSUFFICIENT EVIDENCE communication change

Same always-visible legend states the existing, already-correct copy: *"Laura's does not currently have enough deterministic evidence to establish this proposition. It does NOT automatically mean the statement is false."* Same accessible-name fix applies to INSUFFICIENT EVIDENCE badges as SUPPORTED ones. No wording changed — only visibility/reachability.

## 7. LLM-vs-verifier communication change

The same new legend block opens with: *"The model proposes architectural claims. Laura's then independently checks each one against recovered source evidence — the model never decides what is true."* This is a deliberate, labeled duplication of the equivalent Settings-panel sentence (`features/settings/SettingsPanel.tsx`, untouched), now also present in the Architectural Explanation panel itself — the screen a user is actually looking at when they need this — so it no longer requires opening Settings, which (per the frozen audit) becomes unreachable once a user has drilled into any entity.

## 8. Evidence-chain presentation change

`EvidenceItemRow.tsx` restructured: the relation (e.g. "CALLS") now leads, followed by the "Open source" button; the raw symbol ids, the backend's freeform provenance sentence, and the producer tool/version are moved into a collapsed-by-default `<details>` "Technical details" disclosure — present in full, never destroyed, just no longer the primary reading path. During live verification, a **pre-existing** shared CSS rule (`.obs-evidence-list__item strong`, reused by an unrelated VoiceRail list) was found to be clipping the new leading "CALLS" heading down to a single letter; fixed with a scoped, higher-specificity override (`index.css`) rather than touching the shared rule, so the unrelated VoiceRail usage is unaffected.

## 9. Source-highlight implementation

`MonacoWrapper.tsx`: the evidence-citation highlight was previously a `setTimeout(..., 1500)`-cleared flash — confirmed live in the original audit to have already faded by the time a real user found the cited line in a real function. It is now a **persistent** decoration (background tint + left gutter marker + overview-ruler mark) that stays until the target changes or the viewer unmounts, and correctly represents a full multi-line span (`store.ts` gained `openFileLineEnd`; `goToCode` takes an optional `endLine`; `EvidenceItemRow.tsx`'s "Open source" now passes the resolved region's real `end_line`). Never fabricated: the effect bails out entirely with no decoration when there is no real `targetLine`. Confirmed live: `app.py:1014` stayed highlighted 5+ seconds after opening, well past the old 1.5s window.

## 10. Run-context/hash presentation change

`RunPicker.tsx` redesigned: `lastScanned` ("active run") is now the primary visible label; the run id is abbreviated (first 8 hex chars + ellipsis) with the full value available via `title`/`aria-label` and a dedicated copy button. Also fixed the literal double-"Run" rendering bug at its root cause (`mapAdapter.ts` was baking a `"Run "` prefix into the `runId` value itself, on top of the picker's own `"Run "` prefix) — the underlying `analysis_run_id` value/contract is untouched; only the frontend display string changed. Confirmed live: header now reads "active run · 1f7f34f0…" instead of "Run Run / run:1f7f34f034dc4674a8f395f29adb58ee."

## 11. Test totals

| | Before | After |
|---|---|---|
| Test files | 5 | 7 |
| Tests | 36 | 48 |

12 new tests added across 2 new files (`MonacoWrapper.test.tsx`, `RunPicker.test.tsx`) and 2 extended files (`ArchitecturalExplanationPanel.test.tsx`, `VoiceRail.test.tsx`), covering all 10 items requested: confidence/status distinguishability in accessible text; status explanation visible without hover; evidence chain leading with human-readable content while keeping raw ids available; run hash not primary; persistent multi-line highlight after content loads; highlight following a changed span across rerenders; no fabricated highlight when there's no valid span; and (via the untouched, still-passing original 36 tests) unchanged SUPPORTED/INSUFFICIENT EVIDENCE semantics. **All 48 pass.** `tsc --noEmit`, `eslint .`, and `npm run build` are all clean.

## 12. Chromium/E2E result

The repo's Playwright `test:e2e:*` scripts require the full backend+frontend harness and were not run as a separate step this round. Equivalent, arguably stronger evidence was gathered instead: a live walkthrough through the actual running application via Claude-in-Chrome (§13), which exercises real backend responses (including one real transient provider-unavailable state and its Retry recovery) rather than a scripted/mocked flow.

## 13. Live Flask walkthrough result

Performed against the pinned `pallets/flask` repository at `http://127.0.0.1:5175`, the same checkout used by the original audit and by `docs/usability-dry-run/`. Full path: repository → map → `Flask` class → `full_dispatch_request` → Architectural Explanation → a real SUPPORTED claim → its evidence chain → Open source → return. All 7 acceptance criteria (A–G) verified PASS; see `result.json` for the itemized results and `screenshots/` for visual evidence (`before-*` from the original audit, `after-*` from this round, same entity/claim where possible). One real transient "Architectural explanation unavailable" state occurred naturally during this round's own verification (an actual provider hiccup, not induced); Retry recovered it successfully on the next attempt — useful incidental confirmation that error recovery still works and reads distinctly from an epistemic (SUPPORTED/INSUFFICIENT EVIDENCE) outcome.

## 14. One explanation request still equals one provider call?

Not independently re-instrumented this round. No code path related to the existing request-dedup mechanism (`features/architectural-explanation/api.ts`, `explanationCache`/`invalidateArchitecturalExplanationCache`) was touched by any of the six fixes, so there is no mechanical reason for it to have regressed; it was not re-measured with a network-request-count harness this round the way the original readiness round did.

## 15. QA artifact paths

- `qa-audit/pre-human-ux-remediation/REPORT.md` (this file)
- `qa-audit/pre-human-ux-remediation/result.json`
- `qa-audit/pre-human-ux-remediation/screenshots/` (3 before, 3 after)

## 16. Production implementation commit(s)

See the final chat response for the commit hash (committed after this report was written, per the step ordering in the instructions).

## 17. MINOR/POLISH findings deliberately deferred

Per instruction, not implemented automatically — left as candidates for real human dry-run evidence:

- **F07** (MINOR) — unexplained `"fallback no llm"` tag on entity panels.
- **F08** (MINOR) — "Simple" explanation tab restates the function signature rather than paraphrasing it.
- **F09** (POLISH) — `"How does ROUTE / work?"` unfilled-looking template placeholder in suggested questions.
- **F10** (MINOR) — "Syntax Tree" (shipped UI brand) vs. "Laura's" (docs/generated-prose name) inconsistency.
- **F11** (MINOR) — no visible keyboard focus indicator observed in a lightweight check; needs a dedicated accessibility pass.
- **F12** (MINOR) — the dry-run instrument's Task E / debrief Q2 depend on an INSUFFICIENT EVIDENCE claim appearing naturally, which hasn't been observed yet in this repository/entity sample.

None were touched incidentally by the six approved fixes.

## 18. Research semantics changed?

**No.** SUPPORTED, INSUFFICIENT EVIDENCE, and CONTRADICTED retain their exact original meanings and wording (`claimStatus.ts` was read from but not edited for its status/label/help-copy content). The confidence-badge relabeling only changes what the *map/component* number is called and how it looks — it does not touch the verifier, evidence construction, or any proposition vocabulary. No backend file was edited.

## 19. Formal-study materials changed?

**No.** Nothing under `docs/usability-dry-run/`, the frozen `v2-usability-dry-run-ready` tag, or any A/B/C study material was opened or modified this round.

## 20. Participant session occurred?

**No.** All verification in this round was performed by acting through the real UI directly, standing in for a future participant, exactly as in the original audit.

## 21. Final classification

# READY FOR FOCUSED CLAUDE DESIGN RE-AUDIT

All six approved BLOCKER/MAJOR findings were implemented, verified live against the real running application and the pinned Flask repository, and covered by 12 new passing tests (48/48 total). One additional, closely-related legibility bug (a pre-existing CSS rule clipping the new evidence-chain heading) was discovered during live verification of F03 and fixed as part of making that same approved fix coherent, per the instruction's own carve-out for changes "strictly necessary to make an approved blocker/major fix coherent." No backend, research-semantic, or formal-study changes were made. The 5 MINOR + 1 POLISH findings remain deliberately deferred for real human dry-run evidence. Recommend a focused Claude Design re-audit of specifically the six changed areas (confidence labeling, claim-status accessibility/legend, evidence-chain legibility, source highlighting, header, and the LLM-vs-verifier legend) before scheduling Participant #1.

**STOP FOR REVIEW.** Participant #1 has not been started.
