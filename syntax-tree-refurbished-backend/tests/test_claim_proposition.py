"""Tests for machine-verifiable claim semantics: ClaimProposition,
compute_claim_id's proposition-awareness, and verify_proposition
(core.models.provenance).

The central property under test (per the Phase 3 requirement): a real,
connected, valid evidence chain must NOT be able to support an unrelated or
overreaching claim proposition just because it happens to mention the same
entities. See test_direct_relation_not_supported_by_indirect_multi_hop_chain
for the canonical "Controller -> Service -> PaymentService" example.
"""

from __future__ import annotations

import pytest

from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    ClaimProposition,
    ProducerInfo,
    compute_claim_id,
    render_proposition_statement,
    verify_proposition,
)


RUN_ID = "run-1"
CONTROLLER = "pkg.controllers.OrderController"
SERVICE = "pkg.services.OrderService"
PAYMENT_SERVICE = "pkg.services.PaymentService"


def _resolved(source: str, target: str, *, kind: str = "calls", line: int = 1) -> ObservedProgramRelation:
    return ObservedProgramRelation.create(
        run_id=RUN_ID,
        relation_kind=kind,
        source_entity_id=source,
        target_entity_id=target,
        extractor_name="test.extractor",
        extractor_version="v1",
        resolution_status="resolved",
        span_path="pkg/mod.py",
        span_start_line=line,
        span_end_line=line,
    )


def _unresolved(source: str, reference: str, *, kind: str = "calls", line: int = 1) -> ObservedProgramRelation:
    return ObservedProgramRelation.create(
        run_id=RUN_ID,
        relation_kind=kind,
        source_entity_id=source,
        target_reference=reference,
        extractor_name="test.extractor",
        extractor_version="v1",
        resolution_status="unresolved",
        span_path="pkg/mod.py",
        span_start_line=line,
        span_end_line=line,
    )


def _partial(source: str, target: str | None, reference: str, *, kind: str = "calls", line: int = 1) -> ObservedProgramRelation:
    return ObservedProgramRelation.create(
        run_id=RUN_ID,
        relation_kind=kind,
        source_entity_id=source,
        target_entity_id=target,
        target_reference=reference,
        extractor_name="test.extractor",
        extractor_version="v1",
        resolution_status="partial",
        confidence=0.7,
        span_path="pkg/mod.py",
        span_start_line=line,
        span_end_line=line,
    )


# ---------------------------------------------------------------------------
# ClaimProposition validation
# ---------------------------------------------------------------------------


def test_direct_relation_proposition_constructs():
    prop = ClaimProposition(
        kind="direct_relation",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=SERVICE,
    )
    assert prop.path_entity_ids == ()


def test_direct_relation_rejects_path_entity_ids():
    with pytest.raises(ValueError, match="direct_relation"):
        ClaimProposition(
            kind="direct_relation",
            subject_entity_id=CONTROLLER,
            relation_kind="calls",
            object_entity_id=SERVICE,
            path_entity_ids=(CONTROLLER, SERVICE),
        )


def test_reachability_proposition_constructs():
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    assert prop.path_entity_ids == (CONTROLLER, SERVICE, PAYMENT_SERVICE)


def test_reachability_requires_at_least_two_path_entries():
    with pytest.raises(ValueError, match="reachability"):
        ClaimProposition(
            kind="reachability",
            subject_entity_id=CONTROLLER,
            relation_kind="calls",
            object_entity_id=PAYMENT_SERVICE,
            path_entity_ids=(CONTROLLER,),
        )


def test_reachability_path_must_start_with_subject():
    with pytest.raises(ValueError, match="start with subject"):
        ClaimProposition(
            kind="reachability",
            subject_entity_id=CONTROLLER,
            relation_kind="calls",
            object_entity_id=PAYMENT_SERVICE,
            path_entity_ids=(SERVICE, PAYMENT_SERVICE),
        )


def test_reachability_path_must_end_with_object():
    with pytest.raises(ValueError, match="end with object"):
        ClaimProposition(
            kind="reachability",
            subject_entity_id=CONTROLLER,
            relation_kind="calls",
            object_entity_id=PAYMENT_SERVICE,
            path_entity_ids=(CONTROLLER, SERVICE),
        )


def test_rejects_invalid_kind():
    with pytest.raises(ValueError):
        ClaimProposition(
            kind="vibes",  # type: ignore[arg-type]
            subject_entity_id=CONTROLLER,
            relation_kind="calls",
            object_entity_id=SERVICE,
        )


def test_rejects_invalid_relation_kind():
    with pytest.raises(ValueError):
        ClaimProposition(
            kind="direct_relation",
            subject_entity_id=CONTROLLER,
            relation_kind="performs_fraud_detection",  # type: ignore[arg-type]
            object_entity_id=SERVICE,
        )


@pytest.mark.parametrize("field", ["subject_entity_id", "object_entity_id"])
def test_rejects_empty_entity_ids(field):
    kwargs = dict(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    kwargs[field] = ""
    with pytest.raises(ValueError):
        ClaimProposition(**kwargs)


# ---------------------------------------------------------------------------
# compute_claim_id is proposition-aware
# ---------------------------------------------------------------------------


def test_same_proposition_different_wording_same_id():
    """Phase 2 requirement 1: the presentation statement must NOT determine
    a proposition-backed claim's semantic identity. Two calls asserting the
    SAME proposition but with completely different rendered wording must
    produce the SAME claim id."""
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)

    id_a = compute_claim_id(run_id=RUN_ID, statement="OrderController calls OrderService.", epistemic_type="observed", proposition=prop)
    id_b = compute_claim_id(
        run_id=RUN_ID,
        statement="It has been observed, via static analysis, that the former invokes the latter.",
        epistemic_type="observed",
        proposition=prop,
    )
    assert id_a == id_b


def test_same_wording_different_propositions_different_ids():
    """Phase 2 requirement 2: the converse -- identical statement text
    attached to two DIFFERENT propositions must NOT collide."""
    prop_a = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    prop_b = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=PAYMENT_SERVICE)

    id_a = compute_claim_id(run_id=RUN_ID, statement="Same wording either way.", epistemic_type="observed", proposition=prop_a)
    id_b = compute_claim_id(run_id=RUN_ID, statement="Same wording either way.", epistemic_type="observed", proposition=prop_b)
    assert id_a != id_b


def test_proposition_present_vs_absent_never_collide():
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    id_with_prop = compute_claim_id(run_id=RUN_ID, statement="X", epistemic_type="observed", proposition=prop)
    id_without_prop = compute_claim_id(run_id=RUN_ID, statement="X", epistemic_type="observed", proposition=None)
    assert id_with_prop != id_without_prop


def test_claim_id_without_proposition_matches_legacy_call_shape():
    """Phase 2 requirement 3: legacy proposition=None behavior remains
    backward compatible -- calling compute_claim_id exactly as pre-existing
    callers do (no proposition kwarg at all) must still work and remain
    internally consistent. This is the backward-compatibility guarantee for
    app/provenance/claim_projection.py, which has no ObservedProgramRelation
    evidence to build a proposition from."""
    id_with_default = compute_claim_id(run_id=RUN_ID, statement="X", epistemic_type="observed")
    id_explicit_none = compute_claim_id(run_id=RUN_ID, statement="X", epistemic_type="observed", proposition=None)
    assert id_with_default == id_explicit_none

    # and legacy identity still varies with statement, exactly as before
    id_different_statement = compute_claim_id(run_id=RUN_ID, statement="Y", epistemic_type="observed")
    assert id_different_statement != id_with_default


# ---------------------------------------------------------------------------
# verify_proposition: DIRECT_RELATION
# ---------------------------------------------------------------------------


def test_direct_relation_supported_by_matching_resolved_relation():
    relation = _resolved(CONTROLLER, SERVICE)
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)

    result = verify_proposition(prop, (relation,))

    assert result.supported is True
    assert result.matched_relation_ids == (relation.id,)


def test_direct_relation_not_supported_with_no_evidence():
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    result = verify_proposition(prop, ())
    assert result.supported is False
    assert result.matched_relation_ids == ()


def test_direct_relation_not_supported_by_unresolved_relation():
    relation = _unresolved(CONTROLLER, "some_dynamic_target()")
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    result = verify_proposition(prop, (relation,))
    assert result.supported is False


def test_direct_relation_not_supported_by_partial_relation():
    relation = _partial(CONTROLLER, SERVICE, "obj.method(...)")
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    result = verify_proposition(prop, (relation,))
    assert result.supported is False, "a PARTIAL relation must never prove a definite direct_relation claim"


def test_direct_relation_not_supported_by_wrong_relation_kind():
    relation = ObservedProgramRelation.create(
        run_id=RUN_ID,
        relation_kind="imports",
        source_entity_id=CONTROLLER,
        target_entity_id=SERVICE,
        extractor_name="test.extractor",
        extractor_version="v1",
        resolution_status="resolved",
    )
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    result = verify_proposition(prop, (relation,))
    assert result.supported is False


def test_direct_relation_not_supported_by_indirect_multi_hop_chain():
    """The canonical precision test (Phase 3 requirement): a real, valid,
    connected evidence chain Controller -> Service -> PaymentService must
    NOT support a DIRECT_RELATION claim between the two ends
    (Controller -> PaymentService) -- that direct edge was never actually
    observed, only reachability through Service was. This is exactly the
    mechanism that keeps an overreaching claim like "PaymentService
    performs fraud detection" from ever being marked supported merely
    because PaymentService happens to appear somewhere in a valid evidence
    chain: PropositionKind has no vocabulary to express "performs fraud
    detection" at all, and even a structurally-adjacent-but-wrong claim
    like an unearned direct relation is caught here.
    """
    controller_calls_service = _resolved(CONTROLLER, SERVICE, line=10)
    service_calls_payment = _resolved(SERVICE, PAYMENT_SERVICE, line=20)
    evidence = (controller_calls_service, service_calls_payment)

    overreaching_claim = ClaimProposition(
        kind="direct_relation",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
    )

    result = verify_proposition(overreaching_claim, evidence)

    assert result.supported is False
    assert result.matched_relation_ids == ()

    # Contrast: the SAME evidence correctly supports the accurate
    # REACHABILITY proposition -- proving the chain itself is fine and the
    # rejection above is precision, not a bug in relation handling.
    accurate_reachability_claim = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    reachability_result = verify_proposition(accurate_reachability_claim, evidence)
    assert reachability_result.supported is True
    assert reachability_result.matched_relation_ids == (
        controller_calls_service.id,
        service_calls_payment.id,
    )


# ---------------------------------------------------------------------------
# verify_proposition: REACHABILITY
# ---------------------------------------------------------------------------


def test_reachability_supported_by_full_resolved_chain_in_hop_order():
    hop1 = _resolved(CONTROLLER, SERVICE, line=1)
    hop2 = _resolved(SERVICE, PAYMENT_SERVICE, line=2)
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    result = verify_proposition(prop, (hop2, hop1))  # order in the evidence tuple shouldn't matter
    assert result.supported is True
    assert result.matched_relation_ids == (hop1.id, hop2.id)  # but result order follows path order


def test_reachability_not_supported_when_a_hop_is_missing():
    hop1 = _resolved(CONTROLLER, SERVICE, line=1)
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    result = verify_proposition(prop, (hop1,))
    assert result.supported is False
    # the successfully-matched prefix (hop1) is still surfaced for
    # diagnostics, even though the overall proposition is unsupported --
    # "all or nothing" applies to `supported`, not to what's reported
    assert result.matched_relation_ids == (hop1.id,)


def test_reachability_not_supported_when_a_hop_is_only_unresolved():
    hop1 = _resolved(CONTROLLER, SERVICE, line=1)
    hop2_unresolved = _unresolved(SERVICE, "PaymentService (dynamic)", line=2)
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    result = verify_proposition(prop, (hop1, hop2_unresolved))
    assert result.supported is False
    assert result.matched_relation_ids == (hop1.id,)


def test_reachability_not_supported_when_a_hop_is_only_partial():
    hop1 = _resolved(CONTROLLER, SERVICE, line=1)
    hop2_partial = _partial(SERVICE, PAYMENT_SERVICE, "self.payment.charge(...)", line=2)
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    result = verify_proposition(prop, (hop1, hop2_partial))
    assert result.supported is False, "a PARTIAL hop must never complete a reachability proof"


def test_reachability_not_supported_with_no_evidence():
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    result = verify_proposition(prop, ())
    assert result.supported is False


def test_reachability_ignores_unrelated_relations_between_other_entities():
    """A valid chain about entirely different entities must not leak into
    an unrelated proposition's verification."""
    unrelated = _resolved("pkg.Other.a", "pkg.Other.b", line=1)
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )
    result = verify_proposition(prop, (unrelated,))
    assert result.supported is False


# ---------------------------------------------------------------------------
# render_proposition_statement: canonical, deterministic rendering
# ---------------------------------------------------------------------------


def test_render_direct_relation_matches_canonical_wording():
    prop = ClaimProposition(kind="direct_relation", subject_entity_id="A", relation_kind="calls", object_entity_id="B")
    assert render_proposition_statement(prop) == "A calls B."


def test_render_reachability_matches_canonical_wording():
    prop = ClaimProposition(
        kind="reachability",
        subject_entity_id="A",
        relation_kind="calls",
        object_entity_id="C",
        path_entity_ids=("A", "B", "C"),
    )
    assert render_proposition_statement(prop) == "A reaches C through a call path."


def test_render_uses_entity_display_names_when_given():
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    rendered = render_proposition_statement(
        prop, entity_display_names={CONTROLLER: "OrderController", SERVICE: "OrderService"}
    )
    assert rendered == "OrderController calls OrderService."


def test_render_falls_back_to_raw_entity_id_when_name_missing():
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    rendered = render_proposition_statement(prop, entity_display_names={CONTROLLER: "OrderController"})
    assert rendered == f"OrderController calls {SERVICE}."


def test_render_is_deterministic():
    prop = ClaimProposition(kind="direct_relation", subject_entity_id="A", relation_kind="inherits", object_entity_id="B")
    assert render_proposition_statement(prop) == render_proposition_statement(prop)
    assert render_proposition_statement(prop) == "A inherits from B."


def test_render_never_consults_anything_outside_the_proposition():
    """No hidden global state, no randomness -- same proposition, called
    from two independently-constructed but field-equal instances, renders
    identically."""
    prop1 = ClaimProposition(kind="reachability", subject_entity_id="A", relation_kind="imports", object_entity_id="C", path_entity_ids=("A", "B", "C"))
    prop2 = ClaimProposition(kind="reachability", subject_entity_id="A", relation_kind="imports", object_entity_id="C", path_entity_ids=("A", "B", "C"))
    assert render_proposition_statement(prop1) == render_proposition_statement(prop2)


# ---------------------------------------------------------------------------
# ArchitecturalClaim.create binds statement to proposition
# ---------------------------------------------------------------------------


PRODUCER = ProducerInfo(producer_type="extractor", name="test.extractor", version="v1")


def test_create_rejects_arbitrary_statement_alongside_a_proposition():
    """The core Phase 3 property: arbitrary unsupported prose cannot be
    attached to a verified proposition through the claim-creation API."""
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    with pytest.raises(ValueError, match="statement"):
        ArchitecturalClaim.create(
            run_id=RUN_ID,
            epistemic_type="observed",
            support_status="supported",
            confidence=None,
            producer=PRODUCER,
            evidence_items=(),
            proposition=prop,
            statement="PaymentService performs fraud detection.",  # arbitrary, false, unrelated
        )


def test_create_generates_statement_from_proposition():
    """The displayed statement on a proposition-backed claim is generated
    from the actual proposition, not supplied independently."""
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    claim = ArchitecturalClaim.create(
        run_id=RUN_ID,
        epistemic_type="observed",
        support_status="supported",
        confidence=None,
        producer=PRODUCER,
        evidence_items=(),
        proposition=prop,
        entity_display_names={CONTROLLER: "OrderController", SERVICE: "OrderService"},
    )
    assert claim.statement == "OrderController calls OrderService."
    assert claim.statement == render_proposition_statement(prop, entity_display_names={CONTROLLER: "OrderController", SERVICE: "OrderService"})


def test_create_changing_only_display_wording_does_not_change_semantic_identity():
    """Two claims built from the SAME proposition but different
    entity_display_names (i.e. different rendered wording) must have the
    same claim id -- display formatting is not semantic identity."""
    prop = ClaimProposition(kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE)
    claim_verbose_names = ArchitecturalClaim.create(
        run_id=RUN_ID,
        epistemic_type="observed",
        support_status="supported",
        confidence=None,
        producer=PRODUCER,
        evidence_items=(),
        proposition=prop,
        entity_display_names={CONTROLLER: "The Order Controller Class", SERVICE: "The Order Service Class"},
    )
    claim_raw_ids = ArchitecturalClaim.create(
        run_id=RUN_ID,
        epistemic_type="observed",
        support_status="supported",
        confidence=None,
        producer=PRODUCER,
        evidence_items=(),
        proposition=prop,
    )
    assert claim_verbose_names.statement != claim_raw_ids.statement
    assert claim_verbose_names.id == claim_raw_ids.id


def test_create_still_requires_statement_when_no_proposition():
    """Legacy citation-based ArchitecturalClaims without propositions may
    retain their existing statement behavior -- statement is required."""
    with pytest.raises(ValueError, match="statement"):
        ArchitecturalClaim.create(
            run_id=RUN_ID,
            epistemic_type="observed",
            support_status="insufficient_evidence",
            confidence=None,
            producer=PRODUCER,
            evidence_items=(),
        )


def test_create_legacy_statement_path_still_works_without_proposition():
    claim = ArchitecturalClaim.create(
        run_id=RUN_ID,
        epistemic_type="observed",
        support_status="supported",
        confidence=None,
        producer=PRODUCER,
        evidence_items=(),
        statement="Legacy citation-based claim text.",
    )
    assert claim.statement == "Legacy citation-based claim text."
    assert claim.proposition is None
