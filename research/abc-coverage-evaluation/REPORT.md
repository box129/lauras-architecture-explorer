# ABC coverage evaluation: A + B + C vs the frozen post-D4 baseline

**This is NOT pilot-v1 and NOT the frozen D4 comparison.** Those artifact
sets (`research/real-repo-pilot/repos/r*/results/` and
`research/real-repo-pilot-d4-comparison/` in the `lauras-d4-comparison`
worktree) are untouched. This directory holds a separate re-evaluation of
the same three frozen ground-truth files (byte-identical, read in place,
never modified) through the byte-identical frozen pilot harness
(`evaluate_repository.py`), with one deliberate wiring difference recorded
in every `run_manifest.json`: the `syntax_tree_refurbished` package is
pre-imported from THIS repository's backend, which carries interventions
A, B, and C on top of the J3+D4 state.

System under evaluation: branch `feature/evidence-coverage-expansion`,
commits `ddc8bf5` (A: subscripted generic inheritance bases), `23d8ed5`
(B: bare `from . import X` submodule binding), `d1af3cb` (C: guarded
static `super()` resolution, `resolution_basis="static_super"`).

## Actual before / after, per repository and pooled

| | R1 tenacity | | R2 flask | | R3 stevedore | | Pooled | |
|---|---|---|---|---|---|---|---|---|
| | D4 | **ABC** | D4 | **ABC** | D4 | **ABC** | D4 | **ABC** |
| true_supported | 10 | **10** | 11 | **12** | 4 | **12** | 25 | **34** |
| true_abstained | 0 | **0** | 1 | **0** | 8 | **0** | 9 | **0** |
| false_supported | 0 | **0** | 0 | **0** | 0 | **0** | 0 | **0** |
| false_abstained | 9 | 9 | 12 | 12 | 12 | 12 | 33 | 33 |
| claim_support_precision | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | **1.0** |
| conditional recall | 1.000 | **1.000** | 0.917 | **1.000** | 0.333 | **1.000** | 0.735 | **1.000** |
| e2e true support rate | 0.833 | 0.833 | 0.917 | **1.000** | 0.333 | **0.857** | 0.694 | **0.944** |
| unsupported-claim acceptance | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | **0.0** |
| claim-resolution coverage | 0.826 | 0.826 | 1.0 | 1.0 | 1.0 | 1.0 | 0.944 | 0.944 |

Pooled headline numbers (all ACTUAL, recounted from
`{r1-clean,r2-medium,r3-challenging}/claims.json` in this directory):

- true supported: **34** (was 25)
- conditional true-support coverage: **34/34 = 1.000** (was 0.735)
- end-to-end true-support coverage: **34/36 = 0.944** (was 0.694)
- support precision: **1.0** (34/34)
- false supported: **0** (in every repository, before and after)
- correct abstention: **33/33** evaluable false claims (rate 1.0 in every
  repository; of the 36 frozen false claims, R1-FRC-1 is out-of-scope and
  R1-FDC-5/R1-FRC-2 remain resolution_failed, exactly as before)

## Previously blocked claims now SUPPORTED (9)

Every outcome change between the frozen D4 claims.json and this run, with
no exceptions in either direction:

- `R2-TDC-1` (B): `Flask.run -> load_dotenv` -- `from . import cli` now
  binds the analyzed submodule; evidence span app.py:710 equals the ground
  truth's cited call site.
- `R3-TDI-1`, `R3-TDI-2`, `R3-TDI-3` (A): the three generic-parameterized
  `inherits` claims; evidence spans equal the cited base declarations.
- `R3-TRC-1`, `R3-TRC-3` (A, transitively): the D4
  `inherited_self_method` walk now succeeds because the subscript bases
  resolve.
- `R3-TDC-5`, `R3-TDC-6`, `R3-TRC-2` (C, on top of A): `super()` call
  sites resolved with `resolution_basis="static_super"`, each carrying the
  walked inherits declaration as a supporting resolution span.

## Still blocked (unchanged, as predicted)

- `R1-TDC-5`, `R1-TRC-2` (true) and `R1-FDC-5`, `R1-FRC-2` (false):
  resolution_failed. Root cause now precisely diagnosed: the parser emits
  the nested-function symbols but classifies any def nested inside another
  def as `kind="method"`, while the frozen ground truth correctly says
  `kind="function"` -- intervention D scope, deliberately not implemented
  in this round.
- `R3-OOS-1`, `R3-OOS-2` (true, out of scope): runtime entry-point /
  callback dispatch, statically unrecoverable; excluded from the e2e
  denominator as always.

## Provenance verification

`provenance_check.json` per repository, produced by
`finalize_abc_evaluation.py`, asserts for every one of the 34 supported
claims: matched evidence non-empty; every matched relation exists in the
run, is fully `resolved`, and its endpoints resolve through the run's own
symbols to the ground-truth proposition's refs; and its primary span lies
inside the claimed source symbol's own range. All 34 pass. Additionally,
every matched evidence span for all 9 NEWLY supported claims coincides
exactly with the ground truth's own cited source location. The single
span not coinciding with a citation anywhere in the corpus is the
pre-existing `R1-TDC-4` (supported since pilot-v1): its method genuinely
calls the target twice (lines 460 and 464); the verifier matched the
first occurrence, the ground-truth author cited the second -- both are
real call sites inside the claimed caller.

## Controlled corpus

`research/e2e-evaluation-bridge/experiment_j3.py` re-run against this
backend: unchanged and clean -- supported_correctly 5/5, precision 1.0,
recall 1.0, zero false supports, correct_abstention_rate 1.0, evidence
correctness/completeness 1.0. (The 7 failures in
`test_e2e_bridge.py` are stale J-V0-era historical assertions that
already fail identically at the protected product baseline `c700f40` --
verified in a scratch worktree -- and are unrelated to A/B/C.)

## Sanity

Full backend suite passes (593 tests, including 5 new A tests, 9 new B
tests, and 11 new C tests -- positive, refusal, and frozen-false-claim
abstention analogs). No proposition/verifier semantics, clustering, UI,
JS/TS, annotation-binding, or dynamic-dispatch code touched.

## Classification

**ABC_COVERAGE_IMPROVEMENT_VALIDATED**
