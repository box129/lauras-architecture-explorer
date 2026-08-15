"""End-to-end + unit tests for the provenance-evaluation harness.

Run with:

    cd research/provenance-evaluation
    python -m pytest tests/ -v

(or `pytest research/provenance-evaluation/tests` from the repo root -- the
sys.path manipulation below makes the `evaluator` package importable either
way, with no packaging/installation step required).
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from evaluator.metrics import evaluate  # noqa: E402
from evaluator.schema import (  # noqa: E402
    CandidateClaim,
    CandidateSet,
    EvidenceItem,
    GroundTruth,
    GroundTruthClaim,
    load_candidate_set,
    load_ground_truth,
)

GROUND_TRUTH_PATH = ROOT / "fixtures" / "ground_truth" / "claims.json"
CANDIDATE_GOOD_PATH = ROOT / "fixtures" / "candidates" / "candidate_good.json"
CANDIDATE_BAD_PATH = ROOT / "fixtures" / "candidates" / "candidate_bad.json"


def approx(value, expected, tol=1e-6):
    assert value is not None, f"expected {expected}, got None"
    assert abs(value - expected) < tol, f"expected {expected}, got {value}"


# ---------------------------------------------------------------------------
# Ground truth sanity
# ---------------------------------------------------------------------------

def test_ground_truth_loads_and_covers_all_four_categories():
    gt = load_ground_truth(GROUND_TRUTH_PATH)
    assert len(gt.claims) == 10
    categories = {c.category for c in gt.claims}
    assert categories == {
        "supported_observed",
        "supported_multi_hop",
        "insufficient_evidence",
        "contradicted",
    }
    # exactly the claims we hand-designed
    by_id = gt.by_id()
    assert by_id["C4"].is_multi_hop and len(by_id["C4"].expected_evidence) == 3
    assert by_id["C5"].is_multi_hop and len(by_id["C5"].expected_evidence) == 2
    # C8/C9 assert absence of a behavior the analyzer can't find -- corrected to
    # insufficient_evidence (see the "CORRECTED" notes in ground_truth/claims.json).
    # Only C10 (an explicit, closed class-inheritance declaration) is a genuine
    # contradiction: the analyzed representation positively establishes an
    # incompatible fact, not merely an absence of a matching relationship.
    assert by_id["C8"].expected_support_status == "insufficient_evidence"
    assert by_id["C9"].expected_support_status == "insufficient_evidence"
    assert by_id["C6"].expected_support_status == "insufficient_evidence"
    assert by_id["C7"].expected_support_status == "insufficient_evidence"
    assert by_id["C10"].expected_support_status == "contradicted"
    assert by_id["C10"].expected_evidence[0].relationship_type == "inherits"


# ---------------------------------------------------------------------------
# End-to-end: fully-correct candidate set should score perfectly
# ---------------------------------------------------------------------------

def test_good_candidate_scores_perfectly():
    gt = load_ground_truth(GROUND_TRUTH_PATH)
    candidate = load_candidate_set(CANDIDATE_GOOD_PATH)
    report = evaluate(gt, candidate)

    assert report.novel_claim_ids == ()
    approx(report.claim_support_precision.value, 1.0)
    approx(report.claim_support_recall.value, 1.0)
    approx(report.evidence_correctness.value, 1.0)
    approx(report.evidence_completeness.value, 1.0)
    approx(report.unsupported_claim_acceptance_rate.value, 0.0)
    approx(report.correct_abstention_rate.value, 1.0)

    assert report.claim_support_precision.numerator == 5
    assert report.claim_support_precision.denominator == 5
    # 5 non-supported ground-truth claims now (C6, C7, C8, C9, C10), all correctly abstained
    assert report.correct_abstention_rate.numerator == 5
    assert report.correct_abstention_rate.denominator == 5


# ---------------------------------------------------------------------------
# End-to-end: flawed candidate set should have the errors show up numerically
# ---------------------------------------------------------------------------

def test_bad_candidate_surfaces_each_deliberate_error():
    gt = load_ground_truth(GROUND_TRUTH_PATH)
    candidate = load_candidate_set(CANDIDATE_BAD_PATH)
    report = evaluate(gt, candidate)

    # the novel claim (no ground-truth counterpart) is reported, not silently dropped or miscounted
    assert report.novel_claim_ids == ("novel:extra1",)

    # precision drops below 1.0 because of the false-positive supports (C6, C8) and the
    # accepted contradiction (C10): candidate marked 8 claims supported (C1-C6,C8,C10),
    # only 5 (C1-C5) are truly supported.
    approx(report.claim_support_precision.value, 5 / 8)
    assert report.claim_support_precision.numerator == 5
    assert report.claim_support_precision.denominator == 8

    # recall is unaffected: the candidate DID mark all 5 truly-supported claims as
    # supported (evidence completeness/correctness are separate failure modes)
    approx(report.claim_support_recall.value, 1.0)

    # evidence_correctness: C9 cites an irrelevant span despite the correct verdict
    # (1 invalid item out of 8 pooled items across the 6 correct-verdict claims that
    # cited evidence: C1,C2,C3,C4,C5,C9 -- C6/C8/C10 excluded for having the wrong
    # verdict, C7 excluded for citing no evidence)
    approx(report.evidence_correctness.value, 7 / 8)

    # evidence_completeness: C4 is missing its third hop (2/3 present), C5 is complete (2/2)
    approx(report.evidence_completeness.value, (2 / 3 + 1.0) / 2)

    # unsupported_claim_acceptance_rate: of {C6,C7,C8,C9,C10}, C6, C8, and C10 were
    # wrongly accepted as "supported" -> 3/5
    approx(report.unsupported_claim_acceptance_rate.value, 3 / 5)
    assert report.unsupported_claim_acceptance_rate.numerator == 3
    assert report.unsupported_claim_acceptance_rate.denominator == 5

    # correct_abstention_rate: only C7 and C9 got the exact right non-supported status -> 2/5
    approx(report.correct_abstention_rate.value, 2 / 5)
    assert report.correct_abstention_rate.numerator == 2
    assert report.correct_abstention_rate.denominator == 5


def test_good_candidate_outperforms_bad_candidate_on_every_defined_metric():
    """Sanity check that ties the two example candidate sets together: a
    mostly-correct system must never look worse than a deliberately flawed
    one on any metric that is defined for both."""
    gt = load_ground_truth(GROUND_TRUTH_PATH)
    good = evaluate(gt, load_candidate_set(CANDIDATE_GOOD_PATH))
    bad = evaluate(gt, load_candidate_set(CANDIDATE_BAD_PATH))

    for good_metric, bad_metric in zip(good.all_metrics(), bad.all_metrics()):
        assert good_metric.name == bad_metric.name
        if good_metric.value is None or bad_metric.value is None:
            continue
        if good_metric.name == "unsupported_claim_acceptance_rate":
            assert good_metric.value <= bad_metric.value, good_metric.name
        else:
            assert good_metric.value >= bad_metric.value, good_metric.name


# ---------------------------------------------------------------------------
# Unit tests against small synthetic ground truth, for edge cases the two
# example candidate sets don't happen to exercise.
# ---------------------------------------------------------------------------

def _rel(source, target, file="f.py", line=1, rtype="calls"):
    return EvidenceItem(
        evidence_type="relationship",
        relationship_type=rtype,
        source_symbol_id=source,
        target_symbol_id=target,
        file=file,
        start_line=line,
        end_line=line,
    )


def test_metrics_are_none_not_zero_when_undefined():
    """An empty candidate set has nothing to measure; metrics must report
    None (undefined), never a misleading 0.0 or 1.0."""
    gt = GroundTruth(
        fixture_root="x",
        claims=(
            GroundTruthClaim(
                claim_id="A1",
                text="A calls B",
                category="supported_observed",
                expected_support_status="supported",
                expected_epistemic_type="observed",
                expected_evidence=(_rel("A", "B"),),
            ),
        ),
    )
    empty_candidate = CandidateSet(claims=())
    report = evaluate(gt, empty_candidate)
    for m in report.all_metrics():
        if m.name == "claim_support_recall":
            # recall's denominator is ground-truth-driven (all truly-supported GT
            # claims), not candidate-driven, so it IS well-defined even when the
            # candidate attempted nothing: 0 correctly recalled out of 1 -- see
            # claim_support_recall's docstring on the closed-world assumption.
            approx(m.value, 0.0)
            continue
        assert m.value is None, f"{m.name} should be undefined for an empty candidate set, got {m.value}"


def test_wrong_abstention_type_is_neither_accepted_nor_correctly_abstained():
    """If ground truth says 'contradicted' and the candidate says
    'insufficient_evidence' (or vice versa), that is wrong, but it is a
    different kind of wrong than accepting the claim as supported --
    unsupported_claim_acceptance_rate must not count it, and
    correct_abstention_rate must not count it either."""
    gt = GroundTruth(
        fixture_root="x",
        claims=(
            GroundTruthClaim(
                claim_id="A1",
                text="A does fraud detection",
                category="contradicted",
                expected_support_status="contradicted",
                expected_epistemic_type="observed",
                expected_evidence=(),
            ),
        ),
    )
    candidate = CandidateSet(
        claims=(
            CandidateClaim(
                claim_id="A1",
                text="A does fraud detection",
                support_status="insufficient_evidence",  # ground truth says contradicted
                epistemic_type="observed",
                evidence=(),
            ),
        )
    )
    report = evaluate(gt, candidate)
    approx(report.unsupported_claim_acceptance_rate.value, 0.0)  # not accepted as supported
    approx(report.correct_abstention_rate.value, 0.0)  # but also not a correct (matching) abstention
    assert any("wrong" in n.lower() for n in report.correct_abstention_rate.notes)


def test_novel_claims_excluded_from_ground_truth_metrics():
    gt = GroundTruth(
        fixture_root="x",
        claims=(
            GroundTruthClaim(
                claim_id="A1",
                text="A calls B",
                category="supported_observed",
                expected_support_status="supported",
                expected_epistemic_type="observed",
                expected_evidence=(_rel("A", "B"),),
            ),
        ),
    )
    candidate = CandidateSet(
        claims=(
            CandidateClaim(claim_id="A1", text="A calls B", support_status="supported", epistemic_type="observed", evidence=(_rel("A", "B"),)),
            CandidateClaim(claim_id="novel:1", text="Something made up", support_status="supported", epistemic_type="observed", evidence=()),
        )
    )
    report = evaluate(gt, candidate)
    assert report.novel_claim_ids == ("novel:1",)
    approx(report.claim_support_precision.value, 1.0)
    assert report.claim_support_precision.denominator == 1  # the novel claim doesn't inflate the denominator


if __name__ == "__main__":
    # allow `python tests/test_metrics_e2e.py` without pytest installed
    import traceback

    tests = [v for k, v in list(globals().items()) if k.startswith("test_") and callable(v)]
    failures = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception:
            failures += 1
            print(f"FAIL {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    if failures:
        sys.exit(1)
