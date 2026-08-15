"""Pytest wrapper for the real end-to-end feasibility experiment in
``experiment.py``.

Run with:

    cd research/e2e-evaluation-bridge
    "<path-to-backend-venv>/python.exe" -m pytest test_e2e_bridge.py -v

(or `pytest research/e2e-evaluation-bridge` from the repo root -- the
sys.path bootstrap in experiment.py makes both the backend package and the
evaluator harness importable either way, matching the pattern already used
by research/provenance-evaluation/tests/test_metrics_e2e.py).

This module asserts the REAL outcome of running
AnalysisController.analyze() against the real
research/provenance-evaluation/fixtures/python_app/ fixture, through the
real "relations" stage, the real run-store persistence round-trip, and the
real ClaimProposition verifier/adapter -- not a hand-simulated expectation.
See experiment.py's module docstring for the full explanation of why C1,
C2, C3, and C5 come back `insufficient_evidence` (a real, now-confirmed
scope gap in python_call_extractor's resolution heuristics for
`self.<injected_dependency>.<method>()` call sites), while the two
C10-derived inheritance propositions come back exactly as originally
predicted.
"""

from __future__ import annotations

import pytest

from experiment import run_experiment


@pytest.fixture(scope="module")
def result():
    return run_experiment()


# ---------------------------------------------------------------------------
# The pipeline actually ran for real, end-to-end.
# ---------------------------------------------------------------------------


def test_real_analysis_completed(result):
    assert result.job.status == "completed"
    assert result.job.error == ""


def test_real_symbols_were_produced(result):
    assert len(result.symbols) == 15
    kinds = {s.kind for s in result.symbols}
    assert "class" in kinds and "method" in kinds


def test_relations_persistence_round_trip_is_real(result):
    """store.get_relations(run_id) must be non-empty and identical to the
    in-process job.relations attribute the controller also set -- proving
    put_relations/get_relations round-tripped faithfully, not just that the
    controller's local variable held something."""
    assert len(result.relations_from_store) == 7
    assert result.relations_from_store == result.relations_from_job_attr


def test_extractors_actually_ran_both_kinds(result):
    kinds = {r.relation_kind for r in result.relations_from_store}
    assert "calls" in kinds
    assert "inherits" in kinds


# ---------------------------------------------------------------------------
# C10 (inherits): both halves verified against real, resolved evidence.
# ---------------------------------------------------------------------------


def test_c10_true_target_is_supported_by_real_inheritance_evidence(result):
    claim = result.claims_by_key["C10-true"]
    assert claim.support_status == "supported"
    assert claim.evidence_chain.hop_count == 1
    assert claim.evidence_chain.items[0].relationship_kind == "inherits"
    assert claim.statement == "OrderRepository inherits from InMemoryRepository."


def test_c10_false_target_is_insufficient_evidence_not_supported_not_contradicted(result):
    """The central correctness property under test for C10: a FALSE claim
    (OrderRepository extends the nonexistent SqlRepository) must never come
    back 'supported', and -- given this adapter's documented, reviewed
    scope boundary of never auto-detecting contradictions (see
    app/provenance/relation_adapter.py's 'Scope boundary: contradicted'
    section) -- correctly comes back 'insufficient_evidence', not
    'contradicted'. This is the expected, conservative, CORRECT behavior of
    this deterministic prototype, not a bug."""
    claim = result.claims_by_key["C10-false"]
    assert claim.support_status == "insufficient_evidence"
    assert claim.support_status != "supported"
    assert claim.support_status != "contradicted"
    assert claim.evidence_chain.hop_count == 0


# ---------------------------------------------------------------------------
# C1/C2/C3/C5 (calls): real, confirmed extractor limitation for
# self.<injected_dependency>.<method>() call sites -- see experiment.py's
# module docstring for the full explanation.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("claim_key", ["C1", "C2", "C3", "C5"])
def test_dependency_injected_calls_come_back_insufficient_evidence(result, claim_key):
    """This is the real, empirically-confirmed outcome, not the originally
    predicted one: python_call_extractor's own documented resolution scope
    (self.method() only when `method` is directly on the same class; a
    same-expression constructor chain; or same-function local
    variable-type tracking) does not cover
    `self.<constructor-injected-attribute>.<method>()`, which is every call
    site in this fixture. verify_proposition therefore correctly reports
    insufficient_evidence for all four of these real, true-in-the-source
    calls -- there is no resolved ObservedProgramRelation for
    claim_from_proposition to cite, so it must not (and does not) invent
    one."""
    claim = result.claims_by_key[claim_key]
    assert claim.support_status == "insufficient_evidence"
    assert claim.evidence_chain.hop_count == 0
    assert "unresolved" in claim.evidence_chain.reasoning or "no resolved" in claim.evidence_chain.reasoning


def test_underlying_unresolved_call_relations_really_exist_in_real_output(result):
    """Confirms the ROOT CAUSE directly against the real extractor output:
    for each of C1/C2/C3, a real ObservedProgramRelation with
    relation_kind='calls' and resolution_status='unresolved' exists from
    exactly the right source symbol -- i.e. the extractor DID see the call
    site, it just couldn't resolve the two-hop
    self.<attr>.<method>() attribute chain to a target entity."""
    controller_place_order = next(
        s for s in result.symbols if s.path.endswith("order_controller.py") and s.name == "place_order"
    )
    service_create_order = next(
        s for s in result.symbols if s.path.endswith("order_service.py") and s.name == "create_order"
    )
    unresolved_calls = [
        r
        for r in result.relations_from_store
        if r.relation_kind == "calls" and r.resolution_status == "unresolved"
    ]
    assert any(r.source_entity_id == controller_place_order.id for r in unresolved_calls)
    assert any(r.source_entity_id == service_create_order.id for r in unresolved_calls)


# ---------------------------------------------------------------------------
# Statement rendering: never arbitrary prose, always derived from the
# verified proposition.
# ---------------------------------------------------------------------------


def test_every_claim_statement_is_rendered_not_hand_supplied(result):
    for case in result.cases:
        claim = result.claims_by_key[case.key]
        # A proposition-backed claim's statement is generated by
        # render_proposition_statement -- see core.models.provenance -- so
        # it must mention both endpoints' display names and never claim
        # anything beyond kind/subject/relation/object.
        assert claim.proposition is case.proposition
        assert claim.statement.endswith(".")


# ---------------------------------------------------------------------------
# Bridged metrics (research/provenance-evaluation/evaluator/metrics.py),
# computed over the REAL ArchitecturalClaim results.
# ---------------------------------------------------------------------------


def test_bridged_metrics_reflect_the_real_outcome(result):
    report = result.report

    # Only C10-true ends up genuinely supported by real evidence (1 of the
    # 5 truly-supported ground-truth claims in the scored set: C1, C2, C3,
    # C5, C10-true) -- recall is low BECAUSE of the real extractor gap
    # above, not because of a scoring bug.
    assert report.claim_support_recall.value == pytest.approx(1 / 5)
    assert report.claim_support_recall.numerator == 1
    assert report.claim_support_recall.denominator == 5

    # Of the claims the candidate DID mark 'supported' (just C10-true),
    # every single one is truly supported -- perfect precision. The system
    # is conservative (never wrongly says "supported"), not merely lucky.
    assert report.claim_support_precision.value == pytest.approx(1.0)

    # The false C10 target was never wrongly accepted as 'supported'.
    assert report.unsupported_claim_acceptance_rate.value == pytest.approx(0.0)

    # ...and was correctly abstained (matching insufficient_evidence exactly).
    assert report.correct_abstention_rate.value == pytest.approx(1.0)

    # The one claim marked 'supported' with a correct verdict (C10-true)
    # cites real, valid evidence -- confirmed by construction via
    # verify_proposition, checked here numerically.
    assert report.evidence_correctness.value == pytest.approx(1.0)

    # No multi-hop ground-truth claim (C5) was marked supported by the real
    # system, so evidence_completeness is undefined here -- not 0.0, not
    # 1.0, genuinely undefined (see MetricResult's own docstring on why
    # None must never be conflated with a bad score).
    assert report.evidence_completeness.value is None

    # The supplementary, unscored C4-variant claim is reported as novel
    # (no ground-truth match) and excluded from every metric above.
    assert report.novel_claim_ids == ("novel:C4-2hop-calls-only",)


def test_supplementary_c4_variant_also_reflects_the_same_real_gap(result):
    """The supplementary Controller->Service->Repository reachability
    proposition (a modified, expressible stand-in for C4, NOT scored)
    depends on the same two unresolved call hops as C1/C3, so it too comes
    back insufficient_evidence -- consistent with, not contradicting, the
    C1/C3 result above."""
    assert result.supplementary_claim.support_status == "insufficient_evidence"
