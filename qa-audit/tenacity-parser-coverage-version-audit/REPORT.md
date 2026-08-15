# Version/Provenance Audit — Tenacity Nested-Function Parser-Coverage Observation

**Date:** 2026-08-13
**Scope:** Read-only version-difference analysis. Zero OpenAI requests. No production code changed. No Tenacity or frozen-pilot artifacts modified. No metric recomputation.

## 1. The three system versions

| | Commit | Notes |
|---|---|---|
| **A. Frozen pilot (J3)** | `0eee4a9` | Confirmed via R1's own `run_manifest.json`: `"system_checkpoint": "0eee4a9"`, `"system_tag": "feasibility-deterministic-provenance-j3"` |
| **B. D4 checkpoint** | `edf11ba` (+ `6d7068c`, post-pilot D4 comparison) | |
| **C. Current product** | `ac0126a45254394ec31bc9d97afffe5e2f6fe064` | `product/end-user-acceptance` HEAD at the start of this audit |

## 2. Commit 87c0fb3 (isolated parser-recursion work) — inspected, not merged

**What it actually changed:** added recursion into `ast.If` (body+orelse), `ast.Try`/`TryStar` (body+handlers+orelse+finalbody), and `ast.With`/`AsyncWith` (body) inside `python_symbol_parser.py`'s `visit_body` — so a class/function declared **inside a conditional/try/with block** (e.g. `try: from cjson import loads except ImportError: def loads(s): ...`) now gets a real `ParsedSymbol`.

- **Did it recurse into nested function definitions?** No new effect there — the recursive call that discovers a function nested directly inside another function's body (`visit_body(node.body, ...)` in the `FunctionDef`/`AsyncFunctionDef` branch) was **already present**, unchanged, in the code this commit is based on.
- **Did it create `ParsedSymbol` entries for nested functions?** Not as a new effect — see above.
- **Did it affect relation extraction from nested bodies?** No — this commit touches `python_symbol_parser.py` only, never `python_call_extractor.py`.
- **Did it affect entity IDs/resolution?** No direct effect observed; not investigated further (no remediation performed).

**Is it an ancestor of current product HEAD?** **No.** `git merge-base --is-ancestor 87c0fb3 ac0126a...` → exit code 1. Only reachable via the isolated `research/parser-recursion` branch, exactly as historically documented.

## 3. What actually causes current product's nested-function representation

**No commit does.** `python_symbol_parser.py` is **byte-identical** between the J3 frozen checkpoint (`0eee4a9`) and current product HEAD (`ac0126a...`) — verified via direct `diff`, zero output. The recursive call responsible for discovering `wrapped_f`/`log_it` (`visit_body(node.body, _join_name(parent_name, node.name), symbol.id)` in the `FunctionDef` branch) has existed since the very first commit that added this file (`1934727`) and was never modified on the path to current HEAD — confirmed via `git log -- .../python_symbol_parser.py` scoped to current HEAD, which shows only `1934727` and `1e2d1fa` (an unrelated `stable_entity_key` field addition), never `008e423`, `3852860`, or `87c0fb3`.

**Before or after J3/D4/V2?** This recursion predates all three — it has never changed at any point relevant to this audit.

**Conclusion:** the frozen R1 pilot's own evaluator notes for R1-TDC-5/R1-FDC-5 ("Laura's real python_symbol_parser does not descend into a function/method body to discover nested function definitions, so no ParsedSymbol was ever produced for wrapped_f") describe behavior that does not match the actual parser code **at the exact J3 checkpoint R1 was run against**. This looks like a ground-truth-authoring inaccuracy about *which stage* was responsible — not a later product improvement. See §4/§5 for the corrected, complete picture, which shows the *practical* outcome is unchanged.

## 4/5. Symbol coverage vs. relation coverage — the complete, corrected picture

Checked via the real, unmodified analysis pipeline run in-process (`FastAPI TestClient`, `environment=test`, **zero OpenAI/LLM calls**) against the exact pinned Tenacity checkout, reading `run_store.get_symbols()`/`get_relations()` directly.

### `BaseRetrying.wraps.wrapped_f` (R1-TDC-5 / R1-FDC-5)

| Property | Status |
|---|---|
| Symbol representation | **PRESENT** — `tenacity/__init__.py:381-395`, exact match to the frozen ground truth's own cited span |
| Source-span representation | **PRESENT** |
| Required relation extraction (`wrapped_f` → `self.copy()`) | **ABSENT** — emitted with `resolution_status="unresolved"`, `target_reference="self.copy"` (all 5 of `wrapped_f`'s outgoing calls are unresolved) |
| Relation resolution | N/A — never reaches resolved |
| StableEntityRef resolution | N/A — moot, no relation exists to resolve a reference for |
| Proposition verification capability | **NOT structurally expressible today** |

**Root cause (confirmed from source):** `python_call_extractor.py`'s `_process_module`/`_process_class` dispatch explicitly passes `current_class=None` whenever it encounters a nested `FunctionDef` inside another function's body:

```python
elif isinstance(node, _FUNC_TYPES):
    # Nested function: its own source entity, not a method of the
    # enclosing class even if the enclosing scope is a method.
    relations.extend(_process_function(node, module_idx, None, globals_ctx, run_id))
```

Since `ctx.current_class` is `None` inside `wrapped_f`, the ordinary same-class `self.method()` check (which would otherwise resolve `self.copy()` → `BaseRetrying.copy`, since `copy` **is** defined directly on `BaseRetrying`) never fires — and D4's own `inherited_self_method` fallback (`_resolve_via_inheritance`) also immediately returns `None` for the identical reason (its own first line: `if ctx.current_class is None: return None`). This is a **documented, deliberate design boundary**, not an accidental regression, and it is **unchanged** between J3 and current product (the only diff in `python_call_extractor.py` between the two is D4's own additive `inherited_self_method` fallback, which this case never reaches).

### `before_log.log_it` (R1-TRC-2 / R1-FRC-2)

| Property | Status |
|---|---|
| Symbol representation | **PRESENT** — and independently spot-checked to also hold for `after_log.log_it` and `before_sleep_log.log_it` |
| Source-span representation | **PRESENT** |
| Required relation extraction (`log_it` → `retry_state.get_fn_name()`) | **ABSENT** — `resolution_status="unresolved"` |
| Relation resolution | N/A |
| StableEntityRef resolution | N/A |
| Proposition verification capability | **NOT structurally expressible today** |

**Root cause — a DIFFERENT one than `wrapped_f`'s**, despite `log_it` also being nested: `retry_state.get_fn_name()` is not a `self.method()` call at all — `retry_state` is an ordinary, typed function **parameter** (`RetryCallState`), not `self`. Resolving it would require parameter-type-annotation-based resolution, which `_infer_var_types` does not provide (it only tracks local variables assigned from a constructor call within the same scope, never typed parameters). This limitation is independent of the nested-function `current_class` issue and is likewise unchanged since J3.

## 6. Capability-delta table

| Capability | J3 frozen pilot | D4 | Current product |
|---|---|---|---|
| inherited `self.method()` (same-name method on a resolved base) | NOT resolved (documented out of scope) | **RESOLVED** (new `inherited_self_method` fallback) | Same as D4 — unchanged since; empirically reconfirmed live in the Tenacity real-OpenAI validation (R1-TDC-1) |
| nested-function `ParsedSymbol` representation | PRESENT in the actual code (verified byte-identical), though the frozen pilot's own notes describe it as absent | unchanged | PRESENT — empirically confirmed (`wrapped_f`, `log_it`, `after_log.log_it`, `before_sleep_log.log_it`) |
| calls relations from inside a nested-function closure (incl. `self.method()` referring to the enclosing method's `self`) | NOT resolved — `current_class` reset to `None` by design | unchanged — D4's fallback never reached | **STILL NOT resolved** — reconfirmed empirically |
| `super().method()` | NOT resolved (documented out of scope) | unchanged | unchanged, still out of scope |
| generic parameterized inheritance (`class Foo(Generic[T])`) | not explicitly documented; presumed unresolved under the general dotted-name-only base rule | unchanged (inheritance extractor byte-identical J3→current) | **not empirically tested in this audit** — presumed unchanged, not asserted as fact |
| package re-export import resolution (bare `from . import name`, relative level ≥ 2) | NOT resolved (documented out of scope) | unchanged | unchanged, still out of scope |

## 7. Research reporting consequence

**Principle:** the frozen R1 pilot's per-claim resolution outcomes *and* aggregate metrics **remain valid and correct today** for these four claims — not because the system is frozen, but because empirical re-testing shows the actual functional limitation (deterministic evidence unavailable for these specific propositions) is genuinely unchanged, even though the *symbol* layer looks different from what the frozen evaluator notes described.

**Required correction:** only the *explanatory text* for R1-TDC-5/R1-FDC-5 needs a documented addendum (not a silent edit) — the frozen note's claim that no `ParsedSymbol` was produced does not match actual parser behavior at the J3 checkpoint or now. The correct explanation is the `current_class=None` nested-function boundary in `python_call_extractor.py`. The **scoring** (`resolution_failed`, not counted toward `true_supported`) does not change.

**Recommended wording for future citations:**

> "The J3/R1 pilot (system checkpoint `0eee4a9`) documented four Tenacity claim-resolution failures as `parser_coverage`/nested-function gaps. A later version-provenance audit (2026-08-13) found the underlying parser code unchanged since J3 and determined the four claims remain non-verifiable today for a more precisely characterized reason: `python_call_extractor.py` deliberately does not track enclosing-class context across a nested-function boundary (R1-TDC-5/R1-FDC-5), and does not perform parameter-type-based call resolution (R1-TRC-2/R1-FRC-2). The frozen pilot's scored outcomes for these four claims remain valid; only the originally recorded explanation for two of them (a missing-symbol claim that does not match the actual code) has been corrected."

**General going-forward principle** for future validations (e.g. Stevedore) that surface an apparent capability difference between a frozen pilot and current product:

1. Diff the exact relevant source file(s) between the frozen checkpoint and current HEAD first.
2. If unchanged, do not conclude "nothing to explain" — re-derive the frozen evaluator's *original* reasoning against the unchanged code to check whether the original note was itself accurate.
3. Test symbol representation, relation extraction, and relation resolution **separately** rather than inferring one from another.
4. Never combine a corrected historical explanation with a change to the frozen claim's scored outcome unless the underlying code has *actually* changed and been re-run.

## Four frozen R1 parser-coverage failures — final table

| Claim | Entity | Symbol in J3 | Symbol now | Relation now | Structurally expressible now |
|---|---|---|---|---|---|
| R1-TDC-5 | `wrapped_f` calls `BaseRetrying.copy` | Yes (per unchanged code) | Yes | **No** | **No** |
| R1-FDC-5 | same root cause as R1-TDC-5 | Yes | Yes | **No** | **No** |
| R1-TRC-2 | `log_it` reaches `get_callback_name` via `RetryCallState.get_fn_name` | Yes (per unchanged code) | Yes | **No** | **No** |
| R1-FRC-2 | same root cause as R1-TRC-2 | Yes | Yes | **No** | **No** |

---
STOP FOR REVIEW.
