# Real OpenAI Vertical-Slice Validation — Tenacity (harder deterministic coverage)

**Date:** 2026-08-13
**Repository:** `jd/tenacity`, pinned commit `26f719dc73d3c5612b9c1b8d18a7883837790ad8`
**Scope:** Validation only. No production code changed. No Tenacity source modified. No parser/D4/prompt changes.

## 1. Exact checkout and verified commit

`C:\Users\LENOVO T14\Development\lauras-gt-r1-tenacity\research\real-repo-pilot\repos\r1-clean\source` — `git rev-parse HEAD` → `26f719dc73d3c5612b9c1b8d18a7883837790ad8`, exact match, clean working tree.

## 2. Exact analysis root

Same path as the checkout itself (`.../r1-clean/source`) — matching the frozen R1 pilot's own `run_eval_r1.py`: `ANALYSIS_ROOT = repos/r1-clean/source` (the full repo root, unlike Flask's `src/flask` subdirectory; ground-truth `file_path` values are `tenacity/__init__.py` etc., relative to the repo root).

## 3. Three preselected frozen claim IDs and categories

Written to `preselected-targets.json` **before any generation** (`2026-08-13T11:15:40Z`):

| Target | Category | Frozen claim | Entity |
|---|---|---|---|
| A | **baseline-supported** | R1-TDC-2 | BaseRetrying.iter → calls → BaseRetrying._begin_iter |
| B | **D4-recovered** | R1-TDC-1 | Retrying.__call__ → calls → BaseRetrying.begin (inherited self.method()) |
| C | **additional representative** | R1-TDI-2 | wait_random_exponential → inherits → wait_exponential |

## 4. Category confirmation

- **A (baseline-supported):** pre-D4 `results.json`: `analyzer_support_status=supported, outcome=correct_support` — one of R1's original 7 true-supported claims, unaffected by D4.
- **B (D4-recovered):** pre-D4 `results.json`: `analyzer_support_status=insufficient_evidence, outcome=incorrect_abstention, failure_category=call_resolution` — `begin` is inherited from BaseRetrying, not defined on Retrying; one of the 3 claims (with R1-TRC-1, R1-TRC-3) whose recovery moved true_supported from 7 to 10 after D4.
- **C (additional representative):** pre-D4 `results.json`: `analyzer_support_status=supported, outcome=correct_support` — deliberately chosen from `tenacity/wait.py` (not `tenacity/__init__.py`, where A and B live) and of a different proposition kind (inherits) for genuine structural diversity.

## 5. Preselection proof

`preselected-targets.json` timestamped `11:15:40Z`; the first real explanation request in this validation occurred at `~11:20:46Z` (over 5 minutes later, per `raw/target-a-first-response.json`'s `produced_at`). All three target entities' UI-reachability was independently confirmed via a deterministic (no-OpenAI) reconnaissance analysis **before** the file was written. Never edited afterward.

## 6. Known nested-function limitation audit (no OpenAI call)

Selected `R1-TDC-5` (`BaseRetrying.wraps.wrapped_f` calls `BaseRetrying.copy`), one of R1's four frozen `parser_coverage`/`resolution_failed` claims. **Finding, independently verified via read-only region re-fetch (zero LLM calls):** `wrapped_f` **is now** represented as a real, well-formed, UI-addressable `ParsedSymbol` in the current deterministic analyzed symbol graph — `tenacity/__init__.py:381-395`, an exact match to the frozen ground truth's own cited span, directly reachable via `root → tenacity/__init__.py → BaseRetrying → wraps → wrapped_f`. A second historical case from the same failure family (`before_log.log_it`, underlying R1-TRC-2/R1-FRC-2) was also spot-checked and is likewise now represented. This is a genuinely new, **non-blocking observation** — not investigated further (no parser source reading, no fix attempted) and does not alter any frozen R1/D4 metric. Full record: `known-coverage-limitation.json`.

## 7. First-response persistence proof (A/B/C)

All three targets' genuine first successful responses were captured (response listener armed before click) and durably persisted immediately, with read-back verification, before any further navigation. **Zero crashes.** `raw/target-{a,b,c}-first-response.json`.

## 8. Request-dedup proof (A/B/C) — accepted fix holds

| Target | Requests observed (in-script, 6s grace window) | Backend log cross-check |
|---|---|---|
| A | **1** | exactly 1 `POST .../symbol:4540c4ace2a085e1886c8f2f/architectural-explanation` |
| B | **1** | exactly 1 `POST .../symbol:6ffa88a1fa0992a7bec63667/architectural-explanation` |
| C | **1** | exactly 1 `POST .../symbol:2b8f9bd7828e1845e2dbd358/architectural-explanation` |

**No regression.** One semantic UI load → one backend POST → one provider generation, for all three targets, independently confirmed two ways.

## 9. Proof real OpenAI was used

Runtime reconfirmed beforehand (`enabled=true, configured=true, provider="openai", model="gpt-5.4-mini", credentials_present=true`). All three calls HTTP 200 at 2.4–7.3s latency.

## 10. Every first-sample ClaimProposal

**Target A — BaseRetrying.iter** (3 proposals): calls→_begin_iter (SUPPORTED, `:435`); reaches→_add_action_func via _begin_iter (SUPPORTED, 2-hop); reaches→prepare_for_next_attempt (**INSUFFICIENT_EVIDENCE**, 4-hop, occurred naturally).

**Target B — Retrying.__call__** (3 proposals, all SUPPORTED): calls→begin (`:544`, the D4-recovery target); calls→RetryCallState (`:546`); calls→iter (`:548`).

**Target C — wait_random_exponential** (2 proposals, both SUPPORTED): wait_exponential→inherits→wait_base (`wait.py:201`); wait_random_exponential→inherits→wait_exponential (`wait.py:247`, the preselected target).

Full payloads: `raw/target-{a,b,c}-first-response.json`.

## 11. Schema-valid count

**8 / 8.**

## 12. Bounded-reference violation count

**0.** Every entity across all 8 proposals independently resolved via `GET /api/runs/{run_id}/symbols` to a real symbol with the expected name/file. Zero fabricated/out-of-scope ids.

## 13. Vocabulary violation count

**0.** All 8 proposals used `(direct_relation, calls)`, `(direct_relation, inherits)`, or `(reachability, calls)`.

## 14. Verifier outcome for every proposal

All computed deterministically by `verify_proposition`: **7 SUPPORTED, 1 INSUFFICIENT_EVIDENCE, 0 CONTRADICTED.** The one insufficient-evidence proposal (target A) used entirely real, in-packet entities under a legal vocabulary shape — rejected only because the required 3rd-hop `calls` relation does not exist in the deterministic evidence. **Not** a bounded-reference escape; B and D are kept explicitly distinct per instructions.

## 15. Frozen-ground-truth / additional-truth mapping

| Real claim | Classification |
|---|---|
| iter calls _begin_iter | **matches preselected R1-TDC-2** |
| __call__ calls begin | **matches preselected R1-TDC-1 (D4-recovery)** |
| wait_random_exponential inherits wait_exponential | **matches preselected R1-TDI-2** |
| iter reaches _add_action_func via _begin_iter | additional independently source-verified TRUE in-scope proposition |
| __call__ calls RetryCallState | additional independently source-verified TRUE in-scope proposition |
| __call__ calls iter | additional independently source-verified TRUE in-scope proposition |
| wait_exponential inherits wait_base | additional independently source-verified TRUE in-scope proposition |
| iter reaches prepare_for_next_attempt | insufficient evidence (correct abstention) |

No additional claim was forced into an unrelated frozen claim id; absence was never treated as contradiction.

## 16. D4 target result — Target B

**Real gpt-5.4-mini proposed the inherited `self.method()` fact** (`Retrying.__call__ calls begin`), **and D4-resolved deterministic evidence supported it**: independently confirmed that `begin` resolves to `python:tenacity/__init__.py::BaseRetrying.begin` (Retrying does not define its own `begin`), and the verifier found a real, resolved `calls` relation for exactly this cross-class pair — a relation the frozen pre-D4 R1 pilot documented as unresolved for this precise claim (`incorrect_abstention`, `call_resolution`). Correct interpretation, per instructions: this is **live external-model utilization of a D4-recovered deterministic fact** — D4 itself was already deterministically evaluated separately and is **not** "validated by the LLM" here.

## 17. Selected-target proposal coverage

**3 / 3** — all three preselected true target propositions (R1-TDC-2, R1-TDC-1, R1-TDI-2) were proposed and deterministically SUPPORTED. Targeted generation-coverage observation, not a precision statistic; not combined with the frozen pilot or Flask validation metrics.

## 18. Supported-claim correctness

**7 / 7** — every SUPPORTED proposition independently checked against real, re-fetched source text and/or the frozen ground truth directly (§20 table). Laura's own verifier output was never used as its own ground truth.

## 19. False-support count

**0.**

## 20. Insufficient / contradicted counts

**Insufficient: 1** (occurred naturally, not manipulated) **· Contradicted: 0.**

Independent source-region verification:

| Target | Region | Text | Result |
|---|---|---|---|
| A | `tenacity/__init__.py:435` | `self._begin_iter(retry_state)` | exact match |
| A | `tenacity/__init__.py:447` | `self._add_action_func(self.before)` | exact match |
| B | `tenacity/__init__.py:544` | `self.begin()` | exact match |
| B | `tenacity/__init__.py:546` | `retry_state = RetryCallState(...)` | exact match |
| B | `tenacity/__init__.py:548` | `do = self.iter(retry_state=retry_state)` | exact match |
| C | `tenacity/wait.py:201` | `class wait_exponential(wait_base):` | exact match |
| C | `tenacity/wait.py:247` | `class wait_random_exponential(wait_exponential):` | exact match |

## 21. Source-navigation results

**3 / 3** checked, all correct — one supported claim per target exercised via the real UI (`claim → evidence → Open source`) and independently re-verified via read-only region re-fetch (table above).

## 22. UI reachability

All three targets reached entirely through the real UI: `root (source) → tenacity/__init__.py → [BaseRetrying → iter | Retrying → __call__]` and `root (source) → tenacity/wait.py → wait_random_exponential`. **3 / 3.**

## 23. Legacy-provider traffic

**Zero.** Backend access log for the full session contains zero ERROR/WARN/Exception lines and zero openrouter/blackbox references; `metadata.llm_used` stayed `false` throughout normal navigation, despite the legacy provider being genuinely credentialed on this backend.

## 24. Latency

A: 7,251 ms · B: 4,065 ms · C: 2,401 ms.

## 25. Token usage

**Not exposed by current runtime.** Not estimated.

## 26. Screenshot paths

`screenshots/01-runtime-config.png`, `02-tenacity-analyzed.png`, `03–06-target-a-*.png`, `07–10-target-b-*.png`, `11–14-target-c-*.png`, `15-insufficient-evidence.png` (occurred naturally on target A — not manipulated).

## 27. Recording path

`recording-real-openai-tenacity-provenance.webm` — full 3-target session; Target B (the D4-recovery demonstration) is included and clearly identifiable in its own segment.

## 28. result.json / REPORT.md paths

`qa-audit/live-openai-tenacity-validation/result.json`, `qa-audit/live-openai-tenacity-validation/REPORT.md` (this file).

## 29. Production source changed?

**No.**

---

## PASS / PARTIAL / FAIL

**PASS**

- Exact pinned Tenacity revision ✓ (§1)
- Three targets preselected before generation ✓ (§3, §5)
- All three genuine first responses durably retained ✓ (§7)
- Exactly one provider generation per semantic target load ✓ (§8 — dedup fix holds, zero regression)
- Real OpenAI used ✓ (§9)
- Schema-safe proposals ✓ (§11)
- Zero bounded-reference escapes ✓ (§12)
- Deterministic verifier authoritative ✓ (§14)
- Zero false supports ✓ (§19)
- At least one preselected known-TRUE fact proposed and SUPPORTED ✓ — in fact all three (§17)
- Independently verified supported-claim correctness ✓ (§18)
- Correct source navigation ✓ (§21)
- Zero credential leakage ✓
- Zero fake/mock/legacy provider substitution ✓ (§23)

## 30. New blocker or non-blocking observation

**No new blocker.** One non-blocking observation: the nested-function parser-coverage gap R1's frozen evaluation documented (§6) does not reproduce as originally characterized against the current backend for the two cases spot-checked — reported plainly, not investigated or fixed.

---
STOP FOR REVIEW.
