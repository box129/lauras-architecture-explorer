# Real-OpenAI Stevedore Validation Report

**Repository**: openstack/stevedore
**Pinned commit**: `d3a55f33fb310f43833c7c3eb5ba417e46a9a928` (confirmed via `git rev-parse HEAD` in the frozen R3 pilot checkout, `lauras-gt-r3-stevedore/research/real-repo-pilot/repos/r3-challenging/source`)
**Analysis root**: the repo root of that checkout (bare `repos/r3-challenging/source`, confirmed via `run_eval_r3.py` line 107: `ANALYSIS_ROOT = THIS_DIR / "repos" / "r3-challenging" / "source"`)
**Provider / model**: OpenAI / `gpt-5.4-mini` (real, live; confirmed via pre-flight `GET /api/settings/architectural-explanation` → `enabled=true, configured=true, provider="openai", model="gpt-5.4-mini", credentials_present=true`)
**Verdict: PASS** (with a clearly disclosed proposal-coverage discrepancy for both hard targets — see §7)

---

## 1. Version-audit evidence commit hash (prerequisite, frozen before this round)

`ede0291` — `qa-audit/tenacity-parser-coverage-version-audit/`. Preserved conclusion, verbatim as required: nested symbols existed in J3 and still exist now; the four frozen R1 parser-coverage outcomes remain unchanged; the actual limitation is relation extraction/resolution across nested function boundaries, including loss of class context; frozen pilot metrics remain fully valid; only explanatory wording requires correction/addendum.

## 2. Stevedore checkout + exact commit

Checkout: `lauras-gt-r3-stevedore/research/real-repo-pilot/repos/r3-challenging/source`. `git rev-parse HEAD` = `d3a55f33fb310f43833c7c3eb5ba417e46a9a928`, matching the required commit exactly. Checkout not modified (confirmed clean via `git status --short`).

## 3. Exact analysis root

Repo root itself (`.../r3-challenging/source`), not a package subdirectory — confirmed by direct inspection of `run_eval_r3.py`, matching what the frozen R3 pilot used.

## 4. Three preselected claim IDs, category, and preselection proof

Written to `preselected-targets.json` at `2026-08-13T20:11:58Z`, **before** any generation:

| Target | Category | Frozen claim ID | Proposition |
|---|---|---|---|
| A | baseline-supported | R3-TDC-1 | `ExtensionManager.__init__` calls `ExtensionManager._load_plugins` |
| B | generic-inheritance-limited | R3-TDI-1 | `NamedExtensionManager` inherits `ExtensionManager` |
| C | super()-limited | R3-TDC-5 | `EnabledExtensionManager._load_one_plugin` calls `ExtensionManager._load_one_plugin` (via `super()`) |

All three came from the frozen ground-truth/results artifacts only (`lauras-real-repo-pilot/research/real-repo-pilot/repos/r3-challenging/{ground_truth,results}/claims.json`); Laura's LLM output was never consulted to choose them. Targets were not changed after seeing model output.

## 5. Pre-generation deterministic evidence status for B and C

Written to `pre-generation-evidence-audit.json`, via in-process pipeline inspection (`create_app` + `TestClient`, zero OpenAI calls), **before** any target was generated:

- **Target B**: subject/target symbols represented ✓; source spans represented ✓; an `inherits` relation IS extracted from `NamedExtensionManager` ✓; **but it is unresolved** (`resolution_status="unresolved"`, `target_reference="ExtensionManager[T]"`) because the base expression is an `ast.Subscript` (generic parameterization), which `python_inheritance_extractor.py`'s `_resolve_base` does not handle. Structurally not verifiable today. Expected verifier outcome if proposed: INSUFFICIENT_EVIDENCE.
- **Target C**: subject/target symbols represented ✓; source spans represented ✓; a `calls` relation IS extracted from the `super()` call site ✓; **but it is unresolved** (`target_reference="super()._load_one_plugin"`) because `python_call_extractor.py` documents `super().method()` as explicitly out of scope. Structurally not verifiable today. Expected verifier outcome if proposed: INSUFFICIENT_EVIDENCE.
- Target A sanity check: `ExtensionManager.__init__`'s outgoing `calls` relations ARE resolved — full deterministic support available.

This matches the frozen R3 pilot's known difficulty families exactly; nothing here was fixed or altered.

## 6. First-response persistence proof

All three targets: HTTP 200, synchronously persisted, then read back and verified before continuing (atomic capture discipline). Latencies: A = 5085ms, B = 2491ms, C = 5339ms. Script exited 0 with zero `WARNING` lines and printed `STEVEDORE_VALIDATION_RUN_OK`. No persistence failure occurred at any point, so no STOP condition was triggered.

## 7. Request-dedup proof

In-script grace-window recheck: `{requestCountObserved: 1, duplicates: []}` for all three targets. Independently cross-verified via the backend access log (`syntax-tree-test-artifacts/local-refurbished-dev/backend.log`): exactly one `POST /api/entities/{id}/architectural-explanation` per target entity id, zero duplicates for any of A/B/C. The accepted request-dedup fix (`a3fdd8d`, `875e00f`) holds under Stevedore's real 3-target load: **1 semantic load = 1 backend POST = 1 provider generation**, for every target.

## 8. Real OpenAI proof

`mapMetadataLlmUsed: false` for the map itself (deterministic parsing only); all three claim generations came from the live `POST /api/entities/{id}/architectural-explanation` route with `provider="openai", model="gpt-5.4-mini"` per the pre-flight config check; latencies (2.5–5.3s) are consistent with a real network call, not a stub. API key was never inspected, printed, or logged (confirmed masked in `01-runtime-config.png`).

## 9. Every first-sample ClaimProposal

**Target A (4 claims, all SUPPORTED)**:
1. "__init__ calls _load_plugins." — direct_relation/calls, 1 hop, `extension.py:196-198`
2. "__init__ calls _init_plugins." — direct_relation/calls, 1 hop, `extension.py:200`
3. "__init__ reaches _load_one_plugin through a call path." — reachability/calls, 2 hops, `extension.py:196-198→300-302`
4. "__init__ reaches list_entry_points through a call path." — reachability/calls, 2 hops, `extension.py:196-198→297`

**Target B (1 claim, INSUFFICIENT_EVIDENCE)**:
1. "NamedExtensionManager inherits from NamedExtensionManager." — direct_relation/inherits, `subject_entity_id == object_entity_id == symbol:458ffb0ea4f53f92d61b0afb` (both resolve to `NamedExtensionManager` itself)

**Target C (1 claim, INSUFFICIENT_EVIDENCE)**:
1. "_load_one_plugin calls __init__." — direct_relation/calls, subject = `EnabledExtensionManager._load_one_plugin`, object = `EnabledExtensionManager.__init__`

## 10. Schema validity

6/6 proposals schema-valid: all use one of the three `ALLOWED_PROPOSITION_SHAPES` ((direct_relation,calls), (direct_relation,inherits), (reachability,calls)), all required fields present.

## 11. Bounded-reference compliance

0 violations. Every subject/object entity id in all 6 proposals resolves to a real, in-run symbol (independently confirmed via `GET /api/runs/{run_id}/symbols` for every id referenced across A/B/C). Note: Target B's proposal uses the *same* real entity for both subject and object — this is a real, bounded reference, not a fabricated ID, so it is not a bounded-reference violation in the literal sense, but it is a degenerate/hallucinated proposition (see §14 for characterization).

## 12. Vocabulary compliance

0 violations. All relation kinds used (`calls`, `inherits`) and proposition kinds (`direct_relation`, `reachability`) are within the legal vocabulary.

## 13. Verifier outcome per proposal

| Proposal | Verifier status | Evidence relation IDs | Reasoning |
|---|---|---|---|
| A.1 __init__ calls _load_plugins | SUPPORTED | evidence-rel:2457b2218c1fe90be92392f4 | resolved `calls`, extension.py:196-198 |
| A.2 __init__ calls _init_plugins | SUPPORTED | evidence-rel:30fde717150484a226930628 | resolved `calls`, extension.py:200 |
| A.3 __init__ reaches _load_one_plugin | SUPPORTED | 2-hop chain (evidence-rel:2457b2218c1fe90be92392f4 + evidence-rel:c56406f832805e941f63b350) | resolved 2-hop path |
| A.4 __init__ reaches list_entry_points | SUPPORTED | 2-hop chain (evidence-rel:2457b2218c1fe90be92392f4 + evidence-rel:433809601840eae4e60e17db) | resolved 2-hop path |
| B.1 NamedExtensionManager inherits NamedExtensionManager | INSUFFICIENT_EVIDENCE | none (items: []) | "no resolved 'inherits' relation directly connects [id] to [id]" |
| C.1 _load_one_plugin calls __init__ | INSUFFICIENT_EVIDENCE | none (items: []) | "no resolved 'calls' relation directly connects [id] to [id]" |

Support status is computed independently by the deterministic verifier in all 6 cases — confirmed by the `evidence_chain.items` structure (real evidence-rel IDs for supported claims, empty for insufficient ones) and by direct pipeline inspection showing the underlying relation data the verifier consulted.

## 14. Independent truth mapping

- A.1: **(1) exact match to selected frozen TRUE claim R3-TDC-1.** Independently re-verified against real source (`extension.py:196-198`): TRUE.
- A.2: **(2) match to another frozen TRUE claim** (R3-TDC-2 territory). Independently re-verified (`extension.py:200`): TRUE.
- A.3, A.4: **(3) additional independently source-verified TRUE propositions** (2-hop reachability, not part of the original 3-claim selection but independently confirmed true via the same source spans).
- B.1: **(6) malformed/hallucinated proposition, safely handled as (4) insufficient evidence.** Not a bounded-reference violation (real entity IDs), but semantically degenerate (self-inheritance) and ungrounded in any extracted relation — independently confirmed via direct relation inspection: the *only* relation touching `NamedExtensionManager` is the real unresolved `inherits → ExtensionManager[T]` edge; no self-referencing relation of any kind exists. Correctly resulted in (4) insufficient evidence, not (1) a match to the preselected R3-TDI-1 fact (which was never proposed).
- C.1: **(6) malformed/hallucinated proposition — and independently confirmed FALSE**, safely handled as (4) insufficient evidence. Re-verified against real source (`enabled.py:90-103`): `_load_one_plugin` calls `super()._load_one_plugin`, `self.check_func`, and `LOG.debug` — **it does not call `__init__` at all**, and no relation of any kind (resolved or unresolved) connects these two symbols. This proposition is actually false, and the verifier correctly declined to support it rather than converting the absence into either a false SUPPORTED or an incorrect CONTRADICTED.

## 15–17. Target A / B / C results

- **Target A**: gpt-5.4-mini proposed the preselected baseline-supported fact (R3-TDC-1) verbatim, plus 3 additional true facts. The verifier correctly SUPPORTED all 4, each independently re-verified true against real source. **Result: proposed and correctly supported.**
- **Target B**: gpt-5.4-mini did **not** propose the preselected generic-inheritance-limited fact (R3-TDI-1). It proposed a different, self-referential, ungrounded proposition instead. Laura's correctly returned INSUFFICIENT_EVIDENCE for what it *was* given. No version discrepancy was found — the pre-generation evidence ceiling (unresolved `ExtensionManager[T]` base) is unchanged from the frozen pilot. **Result: proposal-coverage miss on the intended fact; the actual proposed fact was safely abstained from, zero false support.**
- **Target C**: gpt-5.4-mini did **not** propose the preselected super()-limited fact (R3-TDC-5). It proposed a different, independently-confirmed-**false** proposition instead. The correct behavior — abstention, not fabricated support — occurred. **Result: proposal-coverage miss on the intended fact; the actual proposed fact (which is false) was safely abstained from, zero false support.**

## 18. Selected-target proposal coverage

**1/3** — only Target A's exact preselected TRUE fact (R3-TDC-1) was both proposed and SUPPORTED. Targets B and C's preselected hard facts (R3-TDI-1, R3-TDC-5) were not proposed by the model in either first-response sample.

## 19. Hard-target proposal rate

**0/2** — neither of the two selected hard/limited-evidence facts (B: generic-inheritance, C: super()) was proposed. Both targets instead produced a single, different, ungrounded/false proposition, in both cases correctly and safely abstained from.

## 20. Safe-abstention count

**2** (Target B's proposal, Target C's proposal) — both correctly resolved to INSUFFICIENT_EVIDENCE with zero false support.

## 21. Supported-claim correctness

**4/4** — every SUPPORTED claim (all from Target A) was independently re-verified true against the real Stevedore source, not merely against Laura's own verifier output.

## 22. False-support count

**0** — no proposition was ever incorrectly elevated to SUPPORTED.

## 23. Insufficient / contradicted counts

Insufficient: **2** (both from B/C). Contradicted: **0** — the false Target C proposition was correctly left as insufficient evidence rather than converted to CONTRADICTED (per the "do not convert absence into CONTRADICTED" rule); no positive contradicting evidence existed for it, only an absence of a supporting relation.

## 24. Source-navigation results

Verified claim → evidence → "Open source" for all 4 of Target A's SUPPORTED claims (only target with SUPPORTED claims): every claim's cited source region matched the real file/line span after independent re-fetch and re-reading of the actual source file (`extension.py:196-198`, `:200`, `:300-302`, `:297`). **4/4 pass.** Targets B and C produced only INSUFFICIENT_EVIDENCE (no evidence items), so no fabricated source-navigation was attempted for them — their empty-evidence UI states were captured instead (screenshots `09-target-b-evidence.png`, `10b-target-c-evidence.png`, `11-hard-target-insufficient.png`).

## 25. UI reachability

All three targets reached via the normal user workflow only: Stevedore → analyze → architecture map → drill down (root → file → class → method) → select entity → "Architectural Explanation" → claim card → evidence → "Open source". No raw entity-ID entry, database injection, test injection, fake provider, or raw API substitution was used for navigation at any point. Read-only API calls were used only afterward, for independent verification.

## 26. Legacy traffic

**0.** Backend log (305 lines) scanned for `openrouter`, `blackbox`, `ERROR`, `WARN`, `Exception`, `Traceback`; the only match is a single pre-existing dev-server-startup line (line 6, unrelated PowerShell stdout-wrapping artifact from server bootstrap, well before this validation's traffic), not a legacy-provider request. Only the architectural-explanation OpenAI path made external model requests.

## 27. Latency

A: 5085ms. B: 2491ms. C: 5339ms.

## 28. Token usage

Token usage not exposed by current runtime. Not estimated.

## 29. Evidence paths

`qa-audit/live-openai-stevedore-validation/`: `preselected-targets.json`, `pre-generation-evidence-audit.json`, `raw/target-{a,b,c}-first-response.json`, `raw-capture-summary.json`, `result.json`, `REPORT.md`, `recording-real-openai-stevedore-provenance.webm`, `screenshots/` (14 files: `01-runtime-config.png`, `02-stevedore-analyzed.png`, `03-target-a.png`, `04-target-a-explanation.png`, `05-target-a-evidence.png`, `06-target-a-source.png`, `07-target-b.png`, `08-target-b-explanation.png`, `09-target-b-evidence.png`, `09-target-c.png`, `10-target-c-explanation.png`, `10b-target-c-evidence.png`, `11-hard-target-insufficient.png`).

**Screenshot naming note (minor, disclosed)**: the script's generic `11-hard-target-insufficient.png` slot is written by whichever hard target hits the insufficient-only branch; since both B and C hit that branch, C's capture (running second) overwrote B's at that specific filename. No data was lost — Target B's own insufficient-evidence UI state is fully captured at `09-target-b-evidence.png` (visually confirmed: shows the self-referential claim card with the INSUFFICIENT EVIDENCE badge). This is a screenshot-labeling quirk, not an evidence gap.

## 30. Production-code-change status

**None.** No product source was modified during this validation. This was a read-only validation run against the already-accepted request-dedup fix (`a3fdd8d`, `875e00f`).

## 31. PASS / PARTIAL / FAIL

**PASS.** All explicit PASS criteria are met: exact pinned revision confirmed; targets preselected before generation; all three first responses retained; request-dedup invariant holds; real OpenAI used; schema-safe output; zero bounded-reference violations; deterministic verifier authoritative in all 6 cases; zero false supports; Target A yields genuine, independently-verified SUPPORTED evidence (4/4 true); known missing evidence never became fabricated support for B or C; correct source navigation confirmed for all checkable supported claims; zero credential leakage; zero fake/mock/legacy-provider substitution. Per the governing instruction, safe INSUFFICIENT_EVIDENCE outcomes for B and C are compatible with PASS.

## 32. New blocker or version discrepancy

**None found.** The pre-generation evidence ceiling for B and C is unchanged from the frozen R3 pilot (both facts remain deterministically unresolved for the same, previously-documented reasons).

## 33. Discrepancy disclosed for review (not a blocker, not remediated)

Neither hard target (B, C) resulted in the model proposing the intended, preselected difficult fact. In both cases, gpt-5.4-mini instead proposed a *different* single proposition that is not grounded in any extracted relation (resolved or unresolved) — Target B's proposal is self-referential (subject == object) and Target C's proposal is independently confirmed **false** against real source. This is a different (and arguably more safety-relevant) scenario than the one the pre-generation evidence audit was set up to test ("does the verifier correctly abstain when the model proposes the *true-but-currently-unverifiable* fact") — instead it tested "does the verifier correctly refuse to support a hallucinated/false proposition," and it passed that test cleanly, with zero false support in both cases. This is reported precisely rather than reframed, per instructions not to retry or force proposal of the hard facts.

## 34. Summary

Real-OpenAI Stevedore validation: **PASS.** Target A demonstrates the system's positive-evidence path working correctly end-to-end with real OpenAI generation (4/4 independently-verified true SUPPORTED claims, correct source navigation). Targets B and C demonstrate the system's negative/safety path holding under real, unconstrained LLM output — even when the model fabricates ungrounded or outright false propositions (rather than the anticipated true-but-unresolvable ones), the deterministic verifier correctly refuses to support them. Zero false supports across all 6 proposals from 3 real generations. Request-dedup invariant held throughout (1 load = 1 POST = 1 generation, ×3, cross-verified via backend log). No production code was changed. Evidence directory left uncommitted per established pattern, pending review.

---

**STOP FOR REVIEW.**
