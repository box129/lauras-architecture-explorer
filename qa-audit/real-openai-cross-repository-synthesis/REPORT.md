# Real-OpenAI Cross-Repository Validation Synthesis

**Type**: reporting only. No new OpenAI requests were made. No frozen raw evidence was modified. No production source was changed.

This synthesizes five already-frozen real-OpenAI validation runs, conducted over the course of this validation program:

1. Controlled `python_app` fixture — `qa-audit/live-openai-validation/`
2. Flask exploratory — `qa-audit/live-openai-flask-validation/`
3. Flask confirmatory — `qa-audit/live-openai-flask-confirmatory/`
4. Tenacity — `qa-audit/live-openai-tenacity-validation/`
5. Stevedore — `qa-audit/live-openai-stevedore-validation/`

Historical, deterministic-only (no LLM) pilot data — the frozen R1/R2/R3 pilot (`system_checkpoint=0eee4a9`, tag `feasibility-deterministic-provenance-j3`) and its post-D4 comparison — is consulted **only** for qualitative context in §6. It is never mixed numerically with the live-OpenAI metrics below.

## 1. Experiment classification (preserved exactly)

| Run | Verdict |
|---|---|
| Controlled python_app | **PASS** |
| Flask exploratory | **EXPLORATORY PASS WITH PROTOCOL DEVIATION** |
| Flask confirmatory | **CONFIRMATORY PASS** |
| Tenacity | **PASS** |
| Stevedore | **PASS** |

The exploratory Flask run is not pooled as though it were another confirmatory sample — 2 of its 3 samples (targets A, B) are disclosed, non-recoverable later-generation exploratory samples due to a validation-tooling crash, not genuine first responses.

## 2. Per-run metric table

| Run | Repo / fixture | Pinned commit | Model | Targets | Proposals | Schema-valid | Bounded-ref violations | Vocab violations | Supported | Insufficient | Contradicted | Supported-claim correctness | False-support | Selected-target coverage | Source-nav |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| python_app | controlled fixture | n/a | gpt-5.4-mini | 1 | 4 | 4 | 0 | 0 | 4 | 0 | 0 | 4/4 | 0 | n/a (see below) | 1/1 |
| Flask exploratory | pallets/flask | `6a2f545b...` | gpt-5.4-mini | 3 | 11 | 11 | 0 | 0 | 10 | 1 | 0 | 10/10 | 0 | 3/3 (2 of 3 samples not first-response) | 3/3 |
| Flask confirmatory | pallets/flask | `6a2f545b...` | gpt-5.4-mini | 3 | 12 | 12 | 0 | 0 | 12 | 0 | 0 | 12/12 | 0 | 1/3 | 3/3 |
| Tenacity | jd/tenacity | `26f719dc...` | gpt-5.4-mini | 3 | 8 | 8 | 0 | 0 | 7 | 1 | 0 | 7/7 | 0 | 3/3 | 3/3 |
| Stevedore | openstack/stevedore | `d3a55f33...` | gpt-5.4-mini | 3 | 6 | 6 | 0 | 0 | 4 | 2 | 0 | 4/4 | 0 | 1/3 (0/2 on hard targets) | 4/4 |

**Descriptive counts across targeted validation runs** (not a pooled population-level statistic — see §8): 13 real generations, 41 total proposals, 41 schema-valid, 0 bounded-reference violations, 0 vocabulary violations, 37 SUPPORTED, 4 INSUFFICIENT_EVIDENCE, 0 CONTRADICTED, 37/37 independently checked supported-claim correctness. No false supports were observed among the 37 claims presented as SUPPORTED; all 37 were independently verified true.

## 3. Three separated dimensions

**A. Proposal validity / boundedness** — did the model return schema-valid propositions using entities and vocabulary within the supplied bounded context? **Yes, in every single one of the 41 proposals across all 5 runs.** Zero bounded-reference violations, zero vocabulary violations — including in Stevedore, where the model's actual output was semantically degenerate or factually wrong; it still stayed within the structural contract (real entity IDs, legal proposition shape) even when substantively wrong about the relationship between them.

**B. Proposal usefulness / coverage** — did the model actually propose the specific architectural fact hoped for? **Highly variable, and this is where the runs differ most.** Controlled fixture and Tenacity: the model reliably proposed the intended facts (3/3 selected-target coverage for Tenacity). Flask confirmatory: only 1/3 — the model frequently proposed different, still-true, in-scope facts instead of the exact preselected one. Stevedore: 1/3 overall and **0/2 on the two deliberately hard targets** — the model did not propose either intended difficult fact at all.

**C. Verification safety** — when the model proposes an unsupported or false relation, does the deterministic verifier prevent it from becoming a supported claim? **No false supports were observed among the 37 claims presented as SUPPORTED across all 5 runs; all 37 were independently verified true.** This includes cases where the model's raw proposal was itself wrong or ungrounded — a proposition using the wrong relation kind (Flask exploratory), a self-referential proposition (Stevedore B), and an independently-confirmed-false proposition (Stevedore C) — all three resulted in INSUFFICIENT_EVIDENCE, never a false SUPPORTED.

These three dimensions are reported separately and are **not** combined into one "accuracy" number.

## 4. Notable observed cases

1. **Controlled fixture** — real OpenAI → real structured propositions → deterministic support → evidence → exact source navigation, clean end to end.
2. **Flask exploratory** — the model composed a CALLS reachability proposition (`Flask reaches Scaffold through a call path`) over real bounded entities (Flask, App, Scaffold) whose actual available relations were INHERITS, not CALLS. The verifier returned INSUFFICIENT_EVIDENCE — real entities, legal shape, no positive structural support.
3. **Flask confirmatory** — all 12 supported claims across all 3 targets were independently correct, while selected-target proposal coverage was only 1/3. This is the clearest demonstration in the whole program that correctness/safety and proposal coverage are separate properties.
4. **Tenacity** — the live proposer successfully utilized a D4-recovered inherited-`self` relation (`Retrying.__call__` calls `begin`, resolvable only because of D4's inheritance-aware `self.method()` resolution); separately in the same run, an unrelated 4-hop reachability proposition was safely abstained from when a required hop was missing.
5. **Stevedore** — the model failed to propose either deliberately difficult selected fact (generic-inheritance INHERITS; `super()` CALLS) and instead produced different ungrounded/false propositions (a self-referential inherits claim; a same-class calls claim independently confirmed false against real source). Both were withheld as INSUFFICIENT_EVIDENCE. The baseline supported path (target A, 4 claims) remained fully correct in the same run.

## 5. Contradiction semantics

Laura's verifier distinguishes three outcomes precisely:

- **SUPPORTED** — positive evidence establishes the proposition.
- **INSUFFICIENT_EVIDENCE** — available evidence does not establish it.
- **CONTRADICTED** — positive, incompatible evidence exists.

A source-level false proposition does **not** automatically receive CONTRADICTED. Stevedore's target-C proposal (`_load_one_plugin calls __init__`) is independently confirmed false by direct source inspection, yet correctly received INSUFFICIENT_EVIDENCE, because no relation of any kind (resolved or unresolved) connects those two symbols in the extracted evidence — there is no positive, incompatible evidence to contradict it with, only an absence. This is not a verifier error. Absence is not contradiction, and converting absence into CONTRADICTED would itself be a defect this system deliberately avoids.

## 6. Deterministic-pilot difficulty progression (qualitative, historical comparison only)

From the frozen J3 pilot (`system_checkpoint=0eee4a9`) and its D4 comparison:

| Repo | Pre-D4 conditional recall | Post-D4 conditional recall |
|---|---|---|
| Flask (R2) | 0.917 (11/12) | 0.917 (unaffected — D4 targets inherited-`self` calls, not Flask's gap) |
| Tenacity (R1) | 0.700 (7/10) | **1.000 (10/10)** — D4 fully recovered Tenacity's true-positive gap |
| Stevedore (R3) | 0.333 (4/12) | 0.333 (unchanged — D4's fallback needs an already-resolved `inherits` relation to walk, and Stevedore's base relations never resolve, due to generic parameterization and `super()`) |

**Flask**: comparatively strong deterministic coverage. **Tenacity**: intermediate difficulty pre-D4, fully closed post-D4. **Stevedore**: weakest deterministic coverage, with generic-inheritance and `super()` limitations that D4 does not address.

**Did real-model verification safety degrade as deterministic coverage became harder?** No — not in these three repositories. Stevedore, despite having the weakest deterministic coverage and despite the live model producing its least useful/most hallucinated proposals of any run in this program, still had no false supports observed among its 4 SUPPORTED claims (independently verified true). This is consistent with (but not proof of) the idea that the verifier's safety property is structurally independent of how much of the codebase it can currently resolve: harder repositories make the system say "I don't know" more often, not "wrong" more often. This observation is drawn from three repositories and no causal claim is made from it.

## 7. Research-safe conclusion

> Across these five targeted real-model validation runs (13 real gpt-5.4-mini generations, 41 proposals, 3 public repositories plus one controlled fixture), proposal usefulness varied considerably, particularly on structurally difficult cases (Stevedore's two hard targets: 0/2 proposed), but deterministic verification consistently prevented every observed unsupported or false proposition from being presented as a supported architectural fact. No false supports were observed among 37 claims presented as SUPPORTED; all 37 were independently verified true. This pattern held even when the live model's raw output for a target was itself factually wrong or structurally degenerate.

This is explicitly qualified as: targeted samples, three public repositories, one model (gpt-5.4-mini), no population-level generalizability claimed, and not a substitute for human evaluation.

This report does **not** say, and does not support saying: "Laura's eliminates hallucination," "Laura's is 100% accurate," "Laura's guarantees correctness," or "LLM hallucinations are solved."

## 8. Explicit limitations

- All 5 runs are targeted, human-preselected samples (1–3 targets each), not random or exhaustive sampling.
- Only three public repositories (Flask, Tenacity, Stevedore) plus one controlled fixture were tested; no generalization to other codebases or languages is claimed.
- Only one model (gpt-5.4-mini) and one provider (OpenAI) were tested.
- Flask exploratory's targets A and B are not genuine first-response samples (a validation-tooling defect, not a product defect); this qualification is preserved, not silently pooled with confirmatory data.
- Token usage was not exposed by the runtime in any run and was not estimated.
- No false supports being observed among the 37 claims presented as SUPPORTED (all 37 independently verified true) is a strong result for this program's scope, but is not evidence that hallucination is eliminated or that correctness is guaranteed in general — it specifically reflects that the deterministic verifier, when it lacks positive resolved evidence, abstains rather than fabricates, in every case observed so far.

## 9. Product findings (separate from the research outcome)

Engineering defects and clarifications discovered and fixed during this initiative's validation work, each backed by a real product commit:

| Finding | Commit(s) | Description |
|---|---|---|
| Modern OpenAI token-parameter compatibility | `b2849e8` | OpenAI's Chat Completions endpoint rejects the legacy `max_tokens` field for current model families (HTTP 400 for gpt-5.4-mini); requires `max_completion_tokens`. OpenAI-compatible proxies (OpenRouter/Blackbox) still expect `max_tokens`. Fixed via a shared, provider-aware request-body builder. |
| TLS configuration diagnosis | `f5cccab` | Investigated a reported TLS-verification concern; found no code defect (single SSL-context source of truth, used identically by the real generation path and Settings "Test connection"). Hardened self-diagnosis/warning rather than changing any TLS logic. |
| Settings Save/Enabled clarity | `dfd06ca`, `6acc64b` | Corrected documentation of where the Settings entry point lives (differs by screen); shipped the Settings UI, LLM-failure fallback, and claim-status help copy that make Enabled/Provider/Model/Key state legible. |
| Small-repository architecture-map navigation | `d4ab177` | Fixed a structural-fallback gap and a legacy-explanation error leak affecting small-repository navigation. |
| SystemOverview cache-mode isolation | `788c234` | Isolated the architecture-map overview cache by generation mode. |
| Legacy explanation-provider isolation | `788c234` | Removed legacy live-model resolution from architecture-map routes; independently reverified as zero legacy traffic across all 5 live-OpenAI validation runs in this synthesis. |
| React StrictMode external-request deduplication | `a3fdd8d`, `875e00f` | StrictMode's double effect-invocation was causing two real backend POSTs and two real provider generations per single user action in development. Fixed via a promise-keyed request cache; verified fail-before/pass-after and independently reverified holding under real OpenAI load in both the Tenacity and Stevedore runs. |

## 10. Static-analysis limitation taxonomy (corrected terminology)

- **Call resolution**
  - Inherited `self.method()` — recovered by D4.
  - Nested-function call-context resolution — still unresolved (the Tenacity nested-function symbol-representation gap is **not** a parser-coverage issue; symbols are correctly represented, but the extractor resets `current_class=None` for nested functions, losing enclosing-class context needed to resolve their calls).
  - `super().method()` — still unresolved (explicitly out of scope; would require MRO resolution).
- **Inheritance resolution**
  - Parameterized generic bases (e.g. `ExtensionManager[T]`) — unresolved (`_resolve_base` only handles `ast.Name`/`ast.Attribute`, not `ast.Subscript`).
- **Import resolution**
  - Package re-exports — unresolved.

## 11. Artifacts

- `qa-audit/real-openai-cross-repository-synthesis/REPORT.md` (this file)
- `qa-audit/real-openai-cross-repository-synthesis/result.json`

Not committed — pending review, per instruction.

## 12. Confirmations

- No OpenAI request was made in the course of producing this synthesis.
- No production source was changed in the course of producing this synthesis.
- No frozen raw evidence artifact (any `result.json`, `raw/*.json`, screenshot, or recording under any `qa-audit/live-openai-*` directory) was modified.

---

**STOP FOR REVIEW.**
