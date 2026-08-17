# D coverage evaluation: A + B + C + D vs the frozen A+B+C checkpoint (88a3689)

**This is NOT pilot-v1, NOT the frozen D4 comparison, and NOT the ABC
evaluation** -- those artifact sets are untouched. This directory holds a
separate re-evaluation of the same three frozen ground-truth files
(byte-identical, read in place, never modified) through the byte-identical
frozen pilot harness (`evaluate_repository.py`), with the same one
deliberate wiring difference recorded in every `run_manifest.json`: the
`syntax_tree_refurbished` package is pre-imported from THIS repository's
backend, which now carries intervention D on top of the A+B+C state frozen
at commit `88a3689`.

Intervention D, two tightly related corrections, no special-casing of
Tenacity or any frozen claim id:

1. **Nested-definition symbol kind** (`app/parsing/python_symbol_parser.py`):
   a def is `kind="method"` if and only if its IMMEDIATE lexical parent is
   a class body; a def nested inside another def (or at module scope) is
   `kind="function"`. The old rule classified any def with a non-empty
   `parent_name` as a method, mislabeling every function nested inside a
   def. A method of a class that is itself declared inside a function is
   still (correctly) a method.
2. **Guarded closure-`self` binding** (`app/analysis/python_call_extractor.py`,
   version 0.5.0 -> 0.6.0): a bare `self.method()` call in a function
   nested (at any depth) inside a class method resolves to the enclosing
   class's own method -- same plain same-class lookup as inside the method
   body, no `resolution_basis` -- ONLY when `self` is genuinely captured
   from the enclosing method's lexical scope. Refused whenever: the nested
   function has its own parameter named `self` (any slot); `self` is
   rebound locally in any form (assignment/del/global/nonlocal/nested
   def-class-import-except-match binding, over-inclusively); lexical
   ownership is ambiguous (an intervening class body, or the enclosing
   method itself rebinding `self`); or the enclosing scope is not a class
   method with a valid `self` binding (first positional parameter literally
   `self`, no staticmethod/classmethod decorator). Parameter type
   annotations are never consulted as runtime bindings. The captured
   `self` enables ONLY the direct same-class lookup: none of the additive
   fallbacks (`constructor_binding`, `direct_construction`,
   `inherited_self_method`, `static_super`) fire from a nested function --
   in particular `super()` in a nested function stays refused, matching
   Python's own runtime behavior (no `__class__` cell there).

## Actual before / after, per repository and pooled

| | R1 tenacity | | R2 flask | | R3 stevedore | | Pooled | |
|---|---|---|---|---|---|---|---|---|
| | ABC | **D** | ABC | **D** | ABC | **D** | ABC | **D** |
| true_supported | 10 | **11** | 12 | 12 | 12 | 12 | 34 | **35** |
| true_abstained | 0 | **1** | 0 | 0 | 0 | 0 | 0 | **1** |
| false_supported | 0 | **0** | 0 | 0 | 0 | 0 | 0 | **0** |
| false_abstained | 9 | **11** | 12 | 12 | 12 | 12 | 33 | **35** |
| resolution_failures | 4 | **0** | 0 | 0 | 0 | 0 | 4 | **0** |
| claim_support_precision | 1.0 | **1.0** | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | **1.0** |
| conditional recall | 1.000 | **0.917** | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | **0.972** |
| e2e true support rate | 0.833 | **0.917** | 1.000 | 1.000 | 0.857 | 0.857 | 0.944 | **0.972** |
| unsupported-claim acceptance | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | **0.0** |
| claim-resolution coverage | 0.826 | **1.0** | 1.0 | 1.0 | 1.0 | 1.0 | 0.944 | **1.0** |

Pooled headline numbers (all ACTUAL, recounted from
`{r1-clean,r2-medium,r3-challenging}/claims.json` in this directory):

- true supported: **35** (was 34)
- conditional true-support coverage: **35/36 = 0.972** (was 34/34 = 1.000
  -- a DENOMINATOR change, not a regression; see "The conditional
  denominator changed" below)
- end-to-end true-support coverage: **35/36 = 0.972** (was 34/36 = 0.944)
- support precision: **1.0** (35/35)
- false supported: **0** (in every repository, before and after)
- correct abstention: **35/35** evaluable false claims (rate 1.0 in every
  repository; of the 36 frozen false claims, R1-FRC-1 remains out-of-scope
  -- and the two false claims that were previously resolution_failed,
  R1-FDC-5 and R1-FRC-2, are now evaluable and correctly abstained)
- claim-resolution (StableEntityRef) coverage: **1.0 in every repository**
  (was 0.826 on R1) -- zero resolution failures remain anywhere in the
  corpus.

## Every outcome change between the frozen ABC claims.json and this run

Exactly four claims changed, all in R1, all four the nested-def claims D
was aimed at, with no exceptions in either direction:

- `R1-TDC-5` (true): resolution_failed -> **correct_support** /
  `supported`. `BaseRetrying.wraps.wrapped_f` now parses as
  `kind="function"` (matching the frozen ground truth) and the closure-
  captured `self` resolves `copy = self.copy()` to `BaseRetrying.copy`.
- `R1-TRC-2` (true): resolution_failed -> **incorrect_abstention** /
  `insufficient_evidence`. Evaluable for the first time; honestly
  unsupported (see below). NOT supported -- the annotation boundary held.
- `R1-FDC-5` (false): resolution_failed -> **correct_abstention** /
  `insufficient_evidence`. The false claim's subject now resolves, and the
  verifier correctly finds no `wrapped_f -> _run_retry` relation.
- `R1-FRC-2` (false): resolution_failed -> **correct_abstention** /
  `insufficient_evidence`. Same: evaluable, correctly abstained.

No previously supported claim changed outcome, support status, or evidence
count in any repository. No false claim became supported.

## Status of the two frozen focus claims

**R1-TDC-5 (`BaseRetrying.wraps.wrapped_f` calls `BaseRetrying.copy`):
SUPPORTED (correct_support).** Provenance for the newly supported claim
(from `r1-clean/provenance_check.json`, all assertions passing):

- matched relation span: `tenacity/__init__.py:386-386` -- exactly the
  ground truth's own cited call site (`copy = self.copy()`);
- span lies inside the claimed source symbol
  `BaseRetrying.wraps.wrapped_f` (lines 381-395);
- both endpoints resolve through the run's own symbols to the ground-truth
  refs (`wrapped_f`, kind function -> `BaseRetrying.copy`, kind method);
- `resolution_basis` is null with no supporting resolution spans: this is
  the plain same-class `self.method()` resolution (the captured `self` IS
  the method's own binding), not a heuristic fallback -- the call site's
  own span is the complete evidence.

**R1-TRC-2 (`before_log.log_it` -> `RetryCallState.get_fn_name` ->
`get_callback_name`): INCORRECT_ABSTENTION / insufficient_evidence -- the
honest unresolved-evidence outcome, NOT supported.** The symbol-resolution
failure disappeared exactly as intended: the parser fix classifies
`before_log.log_it` as `kind="function"`, so every StableEntityRef in the
proposition now resolves and the claim is evaluated for the first time.
The verifier then reports insufficient evidence because hop 1
(`before.py:35`, `retry_state.get_fn_name()`) is a call through a
parameter whose type is known only from the `RetryCallState` annotation --
and the extractor refuses, by design, to treat a parameter type annotation
as an observed runtime binding. That boundary was deliberately not
weakened; a dedicated regression test
(`test_annotated_parameter_is_never_a_binding`) now pins it.

### The conditional denominator changed -- do not misread the 1.000 -> 0.972

The ABC run's conditional true-support coverage was 34/34 = 1.000 because
R1-TRC-2 (and R1-TDC-5) could not even be evaluated -- resolution_failed
claims sit outside the conditional denominator. D makes both evaluable:
one is supported (numerator +1), one is honestly abstained (denominator
+1 only). 35/36 = 0.972 therefore reflects strictly MORE claims being
evaluated with zero previously-supported claims lost and zero false
supports gained; every end-to-end metric improved (0.944 -> 0.972) or held
(precision 1.0). Classifying the conditional-percentage drop as a support
regression would be a category error: nothing regressed, the denominator
grew.

## Controlled corpus

`research/e2e-evaluation-bridge/experiment_j3.py` re-run against this
backend: unchanged and clean -- supported_correctly 5/5, precision 1.0,
recall 1.0, zero false supports, correct_abstention_rate 1.0, evidence
correctness/completeness 1.0.

## Sanity

Full backend suite passes (618 tests, including 7 new nested-def taxonomy
tests and 18 new closure-`self` tests: positive capture at one and two
nesting depths, every refusal condition -- own `self` parameter,
local/for-loop/nonlocal rebinding, enclosing-method rebinding,
staticmethod, renamed receiver, intervening class body, module-scope
chain, `super()` in a nested function with real inherits supplied -- plus
the annotation boundary and the frozen-false-claim analog). No
proposition/verifier semantics, clustering, UI, JS/TS, annotation-binding,
or dynamic-dispatch code touched; the JS/TS parser is untouched (its
method classification is already class-scoped).

## Classification

**D_COVERAGE_IMPROVEMENT_VALIDATED**
