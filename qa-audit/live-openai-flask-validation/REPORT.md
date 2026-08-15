# Real OpenAI Vertical-Slice Validation — First Realistic Repository (Flask)

**Date:** 2026-08-13
**Repository:** `pallets/flask`, pinned commit `6a2f545bfd8ed31e19066a299296917e034aca58`
**Scope:** Validation only. No production code changed. Backend was not restarted; API key was never read, printed, or persisted.

## 1. Flask checkout path and verified commit

Located the existing pilot checkout (not re-cloned): `C:\Users\LENOVO T14\Development\lauras-gt-r2-flask\research\real-repo-pilot\repos\r2-medium\source`. `git rev-parse HEAD` → `6a2f545bfd8ed31e19066a299296917e034aca58` — exact match, working tree clean, HEAD detached at that commit. (A second identical checkout also exists at `lauras-eval-r2-flask`, same commit, same clean state — either would have worked; this one was used.) Per the frozen pilot's own `run_eval_r2.py`, analysis root is `.../source/src/flask` (ground-truth `file_path` values are relative to `src/flask/`, not the repo root) — the same root was used here.

## 2. Three preselected targets and frozen claim ids

Written to `preselected-targets.json` **before** any generation (timestamp `2026-08-13T07:47:43Z`, using only the frozen `research/real-repo-pilot/repos/r2-medium/ground_truth/claims.json` — Laura's own output was never consulted):

| Target | Category | Frozen claim | Proposition |
|---|---|---|---|
| A | direct CALLS | R2-TDC-2 | Flask.full_dispatch_request calls Flask.dispatch_request |
| B | INHERITS | R2-TDI-1 | Flask inherits App |
| C | path-specific REACHABILITY/CALLS | R2-TRC-1 | Flask.__call__ reaches Flask.full_dispatch_request via Flask.wsgi_app (2 hops) |

All three required categories were present in the frozen ground truth — no nearest-available substitution was needed.

## 3. Proof preselection occurred before generation

`preselected-targets.json` was written at `07:47:43Z`; the first architectural-explanation `POST` for this repository in the backend access log occurs at ~`08:09Z` (over 20 minutes later). The file was never edited afterward.

## 4. Proof real OpenAI was used

Runtime state confirmed immediately beforehand (read-only): `enabled=true, configured=true, provider="openai", model="gpt-5.4-mini", credentials_present=true`. All three explanation calls returned HTTP 200 after multi-second latencies (2.9–3.9s), consistent with genuine external round trips. Same code-path proof as the prior (python_app) validation: `_proposer()` can only resolve to `LLMClaimProposer` given this confirmed state.

**Non-blocking product observation:** the development runtime caused duplicate architectural-explanation requests for one UI action, for all three targets (backend log shows each fired twice). The validation uses the first response only for each target; the duplicate is not counted as another sample. Root cause: React StrictMode double-invoking effects in the Vite dev server (absent in production builds).

**Script defect and recovery (disclosed for full transparency):** the first attempt at the validation script crashed mid-run — a bug in the *script* (clicking a second claim card while a full-page source overlay from an earlier click was still open blocked the click), not a product defect. This happened *after* targets A and B had already returned real, successful responses, but before the script persisted them to disk, so that data was lost and discarded — never used as evidence. The script was fixed (close the overlay before interacting with another claim; write results incrementally) and the complete 3-target flow was re-run once, cleanly. All retained evidence is from that single clean run. Total real OpenAI calls actually made, per the backend log: 4 (crashed attempt, discarded) + 6 (clean run, 2× StrictMode duplicate per target) = 10; exactly 3 of those 10 responses (first-per-target from the clean run) are this validation's evidence.

## 4a. Protocol-deviation audit (added on methodology review, no new requests made)

The predeclared protocol states: *"The FIRST successfully returned explanation for each target is the validation sample."* Auditing the existing artifacts only (backend access log, `raw-capture.json`, the crashed run's own script log, and a search for any surviving screenshot/video/HAR from the crashed attempt — none exist):

| Target | First response recoverable? | Classification |
|---|---|---|
| A | **No** | Backend log confirms a genuine 200 OK for entity `symbol:edc2af952e127c3226a855a3` (target A in the crashed run's own fresh analysis) — but that body lived only in the crashed script's in-memory variable and was never written anywhere before the crash. **Retained A is a later-generation exploratory sample**, not the first sample. |
| B | **No** | Same situation: a genuine 200 OK for entity `symbol:3cb0a1da299bb69faa8a9fdc`, crash occurred immediately afterward before persistence. **Retained B is a later-generation exploratory sample.** |
| C | **Yes** | The backend log contains no explanation POST for any target-C-equivalent entity before the retained run's — the crashed attempt never reached target C's navigation at all. **Retained C is genuinely its first successful generation**, fully satisfying the original protocol. |

No missing response content was inferred — where recovery was impossible, that is stated plainly, not filled in with a guess. This is a validation-tooling/process deviation, not a Laura's product defect. The underlying safety/correctness findings for the retained A/B samples (zero bounded-evidence escapes, zero false supports) still stand as a description of *this exploratory run*, but the run as a whole no longer satisfies the original first-response protocol for 2 of 3 targets — see the revised verdict at the end of this report.

## 5. All real ClaimProposals per target

**Target A — Flask.full_dispatch_request** (4 proposals, all SUPPORTED):
- calls preprocess_request (app.py:1014)
- calls dispatch_request (app.py:1016) — **R2-TDC-2**
- calls handle_user_exception (app.py:1018)
- calls finalize_request (app.py:1019) — matches frozen claim **R2-TDC-3** exactly (additional)

**Target B — Flask (class)** (3 proposals: 2 SUPPORTED, 1 INSUFFICIENT_EVIDENCE):
- Flask inherits from App (app.py:109) — **R2-TDI-1**
- App inherits from Scaffold (sansio/app.py:59) — matches frozen claim **R2-TDI-2** exactly (additional)
- Flask reaches Scaffold through a call path — **INSUFFICIENT_EVIDENCE** (see §Q5 below — occurred naturally)

**Target C — Flask.__call__** (4 proposals, all SUPPORTED):
- calls wsgi_app (app.py:1625)
- reaches request_context via wsgi_app (app.py:1625, 1592)
- reaches full_dispatch_request via wsgi_app (app.py:1625, 1597) — **R2-TRC-1**
- reaches handle_exception via wsgi_app (app.py:1625, 1600)

Full structured payloads: `raw-capture.json`.

## 6. Schema-valid count

**11 / 11.**

## 7. Bounded-evidence violation count

**0.** Every one of the 11 proposals' subject/object/path entity ids was independently resolved via `GET /api/runs/{run_id}/symbols` to a real symbol with the expected name/file (`Flask.full_dispatch_request`, `Flask.preprocess_request`, `Flask.dispatch_request`, `Flask.handle_user_exception`, `Flask.finalize_request`, `Flask`, `App`, `Scaffold`, `Flask.__call__`, `Flask.wsgi_app`, `Flask.request_context`, `Flask.handle_exception`). Zero fabricated/out-of-scope ids.

## 8. Deterministic verifier outcome per proposal

All 11 support statuses were computed by `verify_proposition` against real, `resolution_status == "resolved"` relations. The LLM never determines support — structurally impossible per `ClaimProposal`'s contract. 10 supported, 1 insufficient_evidence, 0 contradicted.

## 9. Mapping to frozen ground truth / additional true propositions

| Real claim | Classification |
|---|---|
| full_dispatch_request calls dispatch_request | **A — matches R2-TDC-2** |
| Flask inherits App | **A — matches R2-TDI-1** |
| __call__ reaches full_dispatch_request via wsgi_app | **A — matches R2-TRC-1** |
| full_dispatch_request calls finalize_request | **B — additional; matches frozen claim R2-TDC-3 exactly** |
| App inherits Scaffold | **B — additional; matches frozen claim R2-TDI-2 exactly** |
| full_dispatch_request calls preprocess_request | **B — additional true in-scope proposition** (independently confirmed against ground truth's own quoted method-body evidence; not itself a separately-scored frozen claim) |
| full_dispatch_request calls handle_user_exception | **B — additional true in-scope proposition** (same basis) |
| __call__ calls wsgi_app | **B — additional true in-scope proposition** (direct-relation hop underlying R2-TRC-1) |
| __call__ reaches request_context via wsgi_app | **B — additional true in-scope proposition** (independently confirmed against ground truth's quoted wsgi_app body) |
| __call__ reaches handle_exception via wsgi_app | **B — additional true in-scope proposition** (same basis) |
| Flask reaches Scaffold through a call path | **C — insufficient evidence** (correctly abstained; see §Q5) |

None of these were forced into an unrelated frozen claim id; each additional proposition was independently source/evidence-checked on its own merits.

## 10. Selected-target proposal coverage

**3 / 3** preselected true target propositions (R2-TDC-2, R2-TDI-1, R2-TRC-1) were proposed and deterministically SUPPORTED. This is a targeted generation-coverage observation, **not** a precision statistic, and is not combined with the frozen pilot's aggregate metrics.

**Supported-claim correctness in this exploratory run: 10 / 10.** All 10 SUPPORTED propositions were independently checked against either the frozen Flask ground truth (`claims.json`) directly, or directly-inspectable source evidence independent of Laura's own generated prose (read-only `GET /api/source-regions/{id}` re-fetches, cross-referenced against the ground truth's own human-authored full-method-body evidence quotes) — Laura's own verifier output was never used as its own ground truth. This wording is preferred over a broad "precision = 1.0" claim and is not generalized beyond this targeted 3-target sample. (A secondary, identically-scoped figure — proposal support precision 10/10 = 1.0 — is recorded in `result.json` for reference.)

## 11. False-support count

**0.**

## 12. Insufficient / contradicted counts

**Insufficient: 1 · Contradicted: 0.**

## 13. Source-navigation results

All 3 "Open source" screenshots were captured while Monaco was still mounting (app.py is much larger than the prior validation's fixture, so the load spinner outlasted the fixed post-click wait — tab headers nonetheless confirm the correct file was opened in every case). Independently, all 3 evidence source regions were re-fetched read-only via `GET /api/source-regions/{id}` and matched the frozen ground truth exactly:

| Target | Region | Result |
|---|---|---|
| A | `app.py:1016` — `rv = self.dispatch_request(ctx)` | exact match to R2-TDC-2 |
| B | `app.py:109` — `class Flask(App):` | exact match to R2-TDI-1 |
| C | `app.py:1625` — `return self.wsgi_app(environ, start_response)` | exact match to R2-TRC-1 hop 1 |

**Result: correct (3/3), verified independently of the screenshots.**

## 14. UI reachability results

All three targets reached entirely through the real UI: `root (flask) → app.py → Flask → [target]`. **3 / 3.**

## 15. Legacy-provider traffic result

**Zero.** Despite the legacy provider being genuinely configured with real credentials on this backend (as in the prior validation), the backend access log for the full session contains zero ERROR/WARN/Exception lines and zero openrouter/blackbox references; `metadata.llm_used` stayed `false` throughout normal navigation.

## 16. Latency per target

A: 3,908 ms · B: 2,855 ms · C: 3,807 ms.

## 17. Actual token usage

**Not exposed by current runtime** (same as the prior validation — `LLMClaimProposer` discards `ModelReply.tokens_in`/`tokens_out`). Not estimated.

## 18. Screenshot paths

`screenshots/01-runtime-config.png`, `02-flask-repository-analyzed.png`, `03–06-target-a-*.png`, `07–10-target-b-*.png`, `11–14-target-c-*.png`, `15-insufficient-evidence.png` (occurred naturally — not manipulated).

## 19. Recording path

`recording-real-openai-flask-provenance.webm` — covers the full 3-target session; Target A (first, uninterrupted) is the representative flow: Flask repository → map → target → Architectural Explanation → SUPPORTED claim → evidence → source.

## 20. result.json path

`qa-audit/live-openai-flask-validation/result.json`

## 21. REPORT.md path

`qa-audit/live-openai-flask-validation/REPORT.md` (this file)

## 22. Production source changed?

**No.**

---

## Primary Flask questions

**Q1 — Proposal validity:** 11/11 (100%) schema-valid.

**Q2 — Boundedness:** No proposal escaped the supplied evidence packet — 0 violations (§7).

**Q3 — Verification safety:** No false/unsupported proposition became SUPPORTED — 0 false supports (§11), independently confirmed against ground truth's own quoted method-body evidence.

**Q4 — Useful support:** All 3 of the 3 preselected known-TRUE targets were actually proposed and reached SUPPORTED.

**Q5 — Abstention:** Yes, and audited in full below (added on methodology review). For Target B, the model speculatively proposed:

- **kind:** `reachability`
- **subject:** `Flask` (`symbol:38770df7bc221315e658b0f1`)
- **relation:** `calls`
- **object:** `Scaffold` (`symbol:00d326da538edb3e953838c6`)
- **ordered path:** `Flask → App → Scaffold`
- **rendered statement:** "Flask reaches Scaffold through a call path."

Four distinct checks, not collapsed into one "boundedness" figure:

| Check | Result |
|---|---|
| **A. Bounded reference compliance** | **PASS** — Flask, App, and Scaffold are all real entities within the bounded evidence packet (Flask is the target itself; App is 1 hop away via the real Flask-inherits-App relation; Scaffold is exactly 2 hops away via the real App-inherits-Scaffold relation — `gather_bounded_evidence` expands over relations of *any* kind, not calls-only, out to `hop_limit=2`). |
| **B. Proposition vocabulary compliance** | **PASS** — `(reachability, calls)` is one of the three explicitly supported shapes. |
| **C. Positive structural support** | **ABSENT** — the packet contains real INHERITS relations for both hops but no CALLS relation for either, because none exists in the actual codebase (Flask/App/Scaffold are related purely by class inheritance). |
| **D. Verifier result** | **INSUFFICIENT_EVIDENCE** — verbatim reason: *"no resolved 'calls' relation found for hop 'symbol:38770df7bc221315e658b0f1' -> 'symbol:4122044054ea7eb61cd04922'; 0/2 preceding hop(s) were matched before this gap."* |

This is **not** an invented entity and **not** a bounded-evidence escape — every referenced entity is real and in-packet, under a supported vocabulary shape. It is a plausible-sounding proposal for which the required positive evidence simply doesn't exist, and the deterministic verifier correctly abstained rather than fabricating support.

**Q6 — Source navigation:** Yes, on the exact supporting span in all 3 checked cases (independently confirmed via read-only region fetch; screenshots caught mid-load due to file size, noted honestly in §13).

**Q7 — Usability:** Yes, all three targets were reached and inspected entirely through the actual UI.

---

## PASS / PARTIAL / FAIL — REVISED on methodology audit

**EXPLORATORY PASS WITH PROTOCOL DEVIATION** *(revised from an earlier unqualified "PASS" — see §4a)*

Not **CONFIRMATORY PASS**: the genuine first A/B response bodies are unrecoverable (§4a), so the predeclared "first successful response" protocol was not satisfied for 2 of 3 targets.

Not **FAIL**: no substantive safety/correctness failure was found anywhere in the retained samples:

- Exact pinned Flask revision ✓ (§1)
- All three targets selected before generation ✓ (§2, §3)
- Real OpenAI used ✓ (§4)
- Valid ClaimProposal structures ✓ (§6)
- Zero bounded-evidence escapes ✓ (§7)
- Deterministic verifier authoritative throughout ✓ (§8)
- Zero false supports ✓ (§11)
- At least one of the three preselected known-TRUE facts proposed and SUPPORTED ✓ — in fact all three (§10)
- Correct source navigation for inspected supported claims ✓ (§13)
- No credential leakage ✓
- No fake/mock/legacy external provider involvement ✓ (§15)

The validation-script crash that caused the deviation is a tooling defect, not a Laura's product failure — but the deviation itself means this run cannot be classified as a clean confirmatory pass against the original protocol.

## 23. New blocker or non-blocking observation

**No new blocker.** Non-blocking observations: (1) React StrictMode duplicate-request behavior in the dev server, consistent with the prior validation (§4); (2) a validation-script bug (not a product defect) caused a discarded, incomplete first attempt, disclosed in full in §4/§4a; (3) as a direct consequence of (2), 2 of 3 targets' retained samples are later-generation exploratory samples rather than genuine first samples (§4a) — the reason for this report's revised verdict.

---
STOP FOR REVIEW.
