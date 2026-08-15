# Real OpenAI Confirmatory Mini-Validation — Flask (resolves prior sampling-protocol deviation)

**Date:** 2026-08-13
**Repository:** `pallets/flask`, pinned commit `6a2f545bfd8ed31e19066a299296917e034aca58`
**Relationship to prior evidence:** This is a **separate, additional** run. It does not overwrite or replace the exploratory run (`qa-audit/live-openai-flask-validation/`, frozen at commit `0ce14da`). Its purpose is to run one clean, predeclared confirmatory validation with guaranteed first-response persistence, resolving that run's sampling-protocol deviation.
**Scope:** No production code changed. Backend was not restarted; API key was never read, printed, or persisted.

## 1. Checkout re-verification

`git rev-parse HEAD` on the same pilot checkout → `6a2f545bfd8ed31e19066a299296917e034aca58` — exact match, `git status --short` clean. Flask was not modified.

## 2. Three new preselected targets

Written to `preselected-targets.json` **before any generation** (`2026-08-13T08:57:06Z`), explicitly excluding `R2-TDC-2, R2-TDI-1, R2-TRC-1, R2-TDC-3, R2-TDI-2` (used or matched in the exploratory run):

| Target | Category | Frozen claim | Proposition |
|---|---|---|---|
| A | direct CALLS | R2-TDC-1 | Flask.run calls cli.load_dotenv |
| B | INHERITS | R2-TDI-3 | blueprints.Blueprint inherits sansio.blueprints.Blueprint |
| C | path-specific REACHABILITY/CALLS | R2-TRC-2 | Flask.wsgi_app reaches Flask.dispatch_request via full_dispatch_request |

## 3. First-response capture mechanism (the non-negotiable fix)

A `page.on('response')` listener is registered **before** clicking "Architectural Explanation," so the chronologically-first-to-complete matching response is captured unambiguously. It is written to `raw/target-<x>-first-response.json` via a synchronous `writeFileSync`, **immediately followed by a read-back verification**, before any screenshot or navigation occurs. Had persistence failed, the script was designed to throw a fatal error and halt the entire run (never regenerate) — this path was never exercised, because **persistence succeeded for all three targets** and the run completed with **zero crashes**.

## 4. Proof real OpenAI was used

Runtime reconfirmed beforehand: `enabled=true, configured=true, provider="openai", model="gpt-5.4-mini", credentials_present=true`. All three calls returned HTTP 200 after multi-second latencies (2.5–6.2s).

## 5. All first-sample ClaimProposals

**Target A — Flask.run** (5 proposals, all SUPPORTED): run→get_debug_flag (app.py:714), run→get_load_dotenv (app.py:709), ScriptInfo.\_\_init\_\_→get_load_dotenv (cli.py:322), ScriptInfo.load_app→get_debug_flag (cli.py:369), run_command→get_debug_flag (cli.py:973).

**Target B — blueprints.Blueprint** (2 proposals, both SUPPORTED): blueprints.Blueprint→sansio.blueprints.Blueprint inherits (blueprints.py:18) — **exact match to R2-TDI-3**; sansio.blueprints.Blueprint→Scaffold inherits (sansio/blueprints.py:119).

**Target C — Flask.wsgi_app** (5 proposals, all SUPPORTED): wsgi_app→request_context (app.py:1592), wsgi_app→full_dispatch_request (app.py:1597), wsgi_app→handle_exception (app.py:1600), wsgi_app⇝finalize_request via full_dispatch_request (app.py:1597,1019), wsgi_app⇝from_environ via request_context (app.py:1592,1515).

Full structured payloads: `raw/target-a-first-response.json`, `raw/target-b-first-response.json`, `raw/target-c-first-response.json`.

## 6. Schema validity

**12 / 12.**

## 7. Bounded-reference compliance

**0 violations.** Every entity across all 12 proposals was independently resolved via `GET /api/runs/{run_id}/symbols` to a real symbol with the expected name/file (`Flask.run`, `get_debug_flag` (helpers.py), `get_load_dotenv` (helpers.py), `ScriptInfo.__init__`, `ScriptInfo.load_app`, `run_command`, `blueprints.Blueprint`, `sansio.blueprints.Blueprint`, `Scaffold`, `Flask.wsgi_app`, `Flask.request_context`, `Flask.full_dispatch_request`, `Flask.handle_exception`, `Flask.finalize_request`, `ctx.AppContext.from_environ`). Zero fabricated/out-of-scope ids.

## 8. Proposition-vocabulary compliance

**0 violations.** Every proposal used `(direct_relation, calls)`, `(direct_relation, inherits)`, or `(reachability, calls)` — all within `ALLOWED_PROPOSITION_SHAPES`.

## 9. Deterministic verifier outcomes

All 12: **SUPPORTED**. Computed by `verify_proposition` against real, `resolution_status == "resolved"` relations — the LLM never determines support.

## 10. Independent supported-claim correctness

**12 / 12.** Every SUPPORTED claim's cited evidence source region was independently re-fetched read-only via `GET /api/source-regions/{id}` and matched real, exact file/line/text — see the table in §13. None relied on Laura's own verifier output as its own ground truth.

## 11. Selected-target proposal coverage

**1 / 3.** Only target B's persisted first claim exactly matches its preselected proposition (R2-TDI-3). Target A proposed a real, true, *adjacent* fact (`get_load_dotenv`, a distinct condition-check function one line above the preselected `load_dotenv` call) rather than R2-TDC-1 itself. Target C proposed the correct first hop (wsgi_app→full_dispatch_request) but chose different, also-true second hops (→finalize_request, and via a different first hop →from_environ) rather than R2-TRC-2's exact dispatch_request path. Neither is forced into its nearby frozen claim id — both are reported as real, independently-verified, in-scope facts distinct from the preselected target. This is a targeted generation-coverage observation, not a precision statistic.

## 12. False-support count

**0.**

## 13. Insufficient / contradicted counts (persisted samples)

**Insufficient: 0 · Contradicted: 0.**

**Important, newly-observed caveat:** the browser's *rendered* explanation panel for target B (and therefore screenshots `07`–`10-target-b-*.png` and `15-insufficient-evidence.png`) shows a **different, later real generation** than the persisted first response — 3 claims (2 supported + 1 `insufficient_evidence`: "Blueprint reaches Scaffold through a call path") instead of the persisted 2 (both supported). This is **not** a repeat of the exploratory run's data-loss defect — the genuine first response was captured and durably persisted before this was ever discovered, exactly as designed. It is a distinct, newly-observed phenomenon: React StrictMode's mount/unmount/remount assigns each effect instance its own "cancelled" flag, and which instance's response survives to render is **not** correlated with which response arrived at the browser first over the network. Confirmed **not** to have occurred for targets A or C (their screenshots exactly match their persisted first responses). All structured audit numbers in this report use **only** the persisted `raw/target-*-first-response.json` files, per the predeclared protocol.

## 14. Source-navigation results

| Target | Claim | Region | Text | Result |
|---|---|---|---|---|
| A | run calls get_debug_flag | `app.py:714` | `self.debug = get_debug_flag()` | exact match, independently verified |
| B | Blueprint inherits sansio Blueprint | `blueprints.py:18` | `class Blueprint(SansioBlueprint):` | exact match, independently verified |
| C | wsgi_app calls full_dispatch_request | `app.py:1597` | `response = self.full_dispatch_request(ctx)` | exact match, independently verified |

**3 / 3** checked, all correct — independently confirmed via read-only region re-fetch rather than relying on the (for target B) mismatched screenshots.

## 15. StrictMode duplicate counts (kept separate from samples)

Backend access log confirms exactly 2 POSTs per target (6 total), all 200 OK. None counted as an additional sample; the persisted response is always the first-to-complete. This script's own 4-second post-persistence observation window additionally captured target C's duplicate directly (arrived 19ms after the first); targets A and B's duplicates arrived outside that window but are independently confirmed via the backend log (and, for B, its *effect* was directly observed via the render discrepancy in §13).

## 16. Latencies

A: 4,623 ms · B: 2,548 ms · C: 6,198 ms.

## 17. Token usage

**Not exposed by current runtime.** Not estimated.

## 18. Artifact paths

`preselected-targets.json`, `raw/target-{a,b,c}-first-response.json`, `raw-capture-summary.json`, `screenshots/01–15*.png`, `recording-real-openai-flask-confirmatory.webm`, `result.json`, `REPORT.md`.

## 19. Recording path

`recording-real-openai-flask-confirmatory.webm`.

## 20–21. result.json / REPORT.md paths

`qa-audit/live-openai-flask-confirmatory/result.json`, `qa-audit/live-openai-flask-confirmatory/REPORT.md` (this file).

## 20. Production source changed?

**No.**

---

## CONFIRMATORY PASS / PARTIAL / PROTOCOL INVALID / FAIL

**CONFIRMATORY PASS**

- Exact pinned Flask revision ✓ (§1)
- Three new targets preselected before generation ✓ (§2)
- Genuine first successful response retained for all 3 targets ✓ (§3 — 0 crashes, 0 lost samples)
- Real OpenAI used ✓ (§4)
- All accepted outputs schema-safe ✓ (§6)
- Zero bounded-reference escapes ✓ (§7)
- Deterministic verifier authoritative ✓ (§9)
- Zero false supports ✓ (§12)
- At least one preselected TRUE target proposed and SUPPORTED ✓ (§11 — R2-TDI-3)
- Independently checked supported claims correct ✓ (§10)
- Exact source navigation correct for inspected supported claims ✓ (§14)
- No credential leakage ✓
- No legacy/fake provider substitution ✓ (§0 legacy traffic)

Not PROTOCOL INVALID: no genuine first successful response was lost or replaced by a later generation — the opposite of the exploratory run's failure mode was achieved here by design. The target-B render discrepancy (§13) is a new, distinct, fully-disclosed observation about React StrictMode's render semantics, not a loss of the persisted sample.

## 22. New observation

The React StrictMode duplicate-request behavior (already known from prior validations) can, when the two duplicate LLM samples genuinely differ in content, cause the **browser's rendered UI** to reflect a *different* response than the one that arrived first over the network and was captured as "the sample." This is a dev-server-only rendering nuance, not a data-persistence defect (the actual first-arriving response was never at risk of loss in this run's design) and not a production code issue in scope for remediation here.

---
STOP FOR REVIEW.
