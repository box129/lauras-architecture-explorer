"""Tests for the ClaimProposition + ObservedProgramRelation ->
RelationshipEvidence -> EvidenceChain -> ArchitecturalClaim adapter
(app.provenance.relation_adapter).

Round 3 (G3 correction): round 2 (G2) accepted an arbitrary, independently
supplied `statement` string alongside the `proposition` being verified.
`verify_proposition` correctly never consulted that text for verification,
but G2 still stored and surfaced it verbatim as the resulting claim's
displayed text -- so a caller could pair a TRUE proposition with a false,
unrelated `statement` and get back a "supported" claim carrying that false
text. That gap is now closed structurally: `claim_from_proposition` has no
`statement` parameter at all. The displayed text is always generated from
the verified `proposition` itself (via `ArchitecturalClaim.create` ->
`render_proposition_statement`); the only caller-controlled input affecting
wording is the purely cosmetic `entity_display_names` mapping.

The central precision property under test, mirroring
test_claim_proposition.py's canonical example, is
test_unrelated_direct_claim_is_not_supported_by_a_real_connected_chain
below: a real, valid, connected evidence chain must not be able to prove an
unrelated or overreaching proposition just because it happens to mention the
same entities.

All ObservedProgramRelation fixtures here are hand-constructed and
controlled -- this module does not depend on, or wait for, any extractor.
"""

from __future__ import annotations

import inspect

import pytest

from syntax_tree_refurbished.app.provenance.relation_adapter import (
    BrokenRelationChainError,
    claim_from_proposition,
)
from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ResolutionEvidenceSpan,
)
from syntax_tree_refurbished.core.models.provenance import (
    ClaimProposition,
    ProducerInfo,
    render_proposition_statement,
)


PRODUCER = ProducerInfo(producer_type="extractor", name="test.relation_adapter", version="v1")

RUN_ID = "run-1"
CONTROLLER = "pkg.Controller.handle"
SERVICE = "pkg.Service.process"
REPOSITORY = "pkg.Repository.save"
PAYMENT_SERVICE = "pkg.PaymentService.charge"

DISPLAY_NAMES = {
    CONTROLLER: "Controller",
    SERVICE: "Service",
    REPOSITORY: "Repository",
    PAYMENT_SERVICE: "PaymentService",
}


def _relation(**overrides) -> ObservedProgramRelation:
    kwargs = dict(
        run_id=RUN_ID,
        relation_kind="calls",
        source_entity_id=CONTROLLER,
        target_entity_id=SERVICE,
        extractor_name="python_call_extractor",
        extractor_version="0.1.0",
        resolution_status="resolved",
        span_path="pkg/controller.py",
        span_start_line=10,
        span_end_line=10,
    )
    kwargs.update(overrides)
    return ObservedProgramRelation.create(**kwargs)


# ---------------------------------------------------------------------------
# Single-hop direct_relation claim
# ---------------------------------------------------------------------------


def test_single_hop_direct_relation_claim_is_supported_with_matching_evidence() -> None:
    relation = _relation()
    proposition = ClaimProposition(
        kind="direct_relation",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=SERVICE,
    )

    claim = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
        entity_display_names=DISPLAY_NAMES,
        subject_symbol_ids=(CONTROLLER, SERVICE),
    )

    assert claim.statement == "Controller calls Service."
    assert claim.epistemic_type == "observed"
    assert claim.proposition is proposition
    assert claim.support_status == "supported"
    assert claim.evidence_chain.hop_count == 1
    assert claim.evidence_chain.items[0].kind == "relationship"
    assert claim.evidence_chain.items[0].relationship_kind == "calls"
    assert claim.evidence_chain.items[0].from_symbol_id == CONTROLLER
    assert claim.evidence_chain.items[0].to_symbol_id == SERVICE
    assert claim.evidence_chain.reasoning == ""


def test_evidence_chain_exposes_resolution_provenance_from_the_relation() -> None:
    """A relation resolved via a non-direct technique (e.g. constructor
    binding) carries resolution_basis/supporting_resolution_spans; the
    adapter must propagate both onto the resulting RelationshipEvidence so
    a claim's evidence chain can expose *how* the relation was resolved,
    not just that it was."""
    spans = (
        ResolutionEvidenceSpan(path="pkg/controller.py", start_line=5, end_line=5, description="constructor parameter annotation"),
        ResolutionEvidenceSpan(path="pkg/controller.py", start_line=6, end_line=6, description="attribute assignment"),
    )
    relation = _relation(resolution_basis="constructor_binding", supporting_resolution_spans=spans)
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim = claim_from_proposition(
        proposition, (relation,), run_id=RUN_ID, epistemic_type="observed", producer=PRODUCER
    )

    assert claim.support_status == "supported"
    evidence_item = claim.evidence_chain.items[0]
    assert evidence_item.resolution_basis == "constructor_binding"
    assert evidence_item.supporting_resolution_spans == spans


def test_direct_relation_claim_ignores_irrelevant_relations_in_the_pool() -> None:
    """The candidate pool may contain relations beyond the one that actually
    proves the proposition; only the proving relation ends up cited."""
    matching = _relation()
    noise = _relation(
        source_entity_id=SERVICE, target_entity_id=REPOSITORY, span_start_line=20, span_end_line=20
    )
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim = claim_from_proposition(
        proposition,
        (noise, matching),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
    )

    assert claim.support_status == "supported"
    assert claim.evidence_chain.hop_count == 1
    assert claim.evidence_chain.items[0].from_symbol_id == CONTROLLER
    assert claim.evidence_chain.items[0].to_symbol_id == SERVICE


# ---------------------------------------------------------------------------
# Multi-hop reachability claim
# ---------------------------------------------------------------------------


def test_multi_hop_reachability_claim_has_evidence_in_path_order() -> None:
    hop1 = _relation(source_entity_id=CONTROLLER, target_entity_id=SERVICE, span_start_line=10, span_end_line=10)
    hop2 = _relation(source_entity_id=SERVICE, target_entity_id=REPOSITORY, span_start_line=20, span_end_line=20)
    proposition = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=REPOSITORY,
        path_entity_ids=(CONTROLLER, SERVICE, REPOSITORY),
    )

    # Relations handed in reverse order -- the candidate pool is a search
    # space, not a pre-ordered chain; output order must still follow the
    # proposition's path order, not input order.
    claim = claim_from_proposition(
        proposition,
        (hop2, hop1),
        run_id=RUN_ID,
        epistemic_type="inferred",
        producer=PRODUCER,
        subject_symbol_ids=(CONTROLLER, SERVICE, REPOSITORY),
    )

    assert claim.epistemic_type == "inferred"
    assert claim.support_status == "supported"
    assert claim.evidence_chain.hop_count == 2
    assert claim.evidence_chain.is_multi_hop

    first_item, second_item = claim.evidence_chain.items
    assert first_item.from_symbol_id == CONTROLLER
    assert first_item.to_symbol_id == SERVICE
    assert second_item.from_symbol_id == SERVICE
    assert second_item.to_symbol_id == REPOSITORY
    assert claim.evidence_chain.reasoning == ""


# ---------------------------------------------------------------------------
# Support / abstention behavior -- proven end-to-end through the adapter
# ---------------------------------------------------------------------------


def test_empty_evidence_is_never_supported() -> None:
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim = claim_from_proposition(
        proposition,
        (),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
    )

    assert claim.support_status == "insufficient_evidence"
    assert claim.evidence_chain.hop_count == 0
    assert "no resolved" in claim.evidence_chain.reasoning


def test_unresolved_relation_forces_insufficient_evidence() -> None:
    relation = _relation(resolution_status="unresolved", target_entity_id=None, target_reference="<dynamic dispatch target>")
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
    )

    assert claim.support_status == "insufficient_evidence"
    # verify_proposition never even considers an unresolved relation a
    # candidate match, so nothing is cited as evidence for this claim.
    assert claim.evidence_chain.hop_count == 0
    assert "unresolved" in claim.evidence_chain.reasoning


def test_partial_relation_forces_insufficient_evidence() -> None:
    relation = _relation(resolution_status="partial", target_reference="obj.method(...)", confidence=0.6)
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
    )

    assert claim.support_status == "insufficient_evidence"
    assert claim.evidence_chain.hop_count == 0
    assert "partial" in claim.evidence_chain.reasoning


def test_missing_reachability_hop_forces_insufficient_evidence_but_keeps_matched_prefix() -> None:
    hop1 = _relation(source_entity_id=CONTROLLER, target_entity_id=SERVICE, span_start_line=10, span_end_line=10)
    # No relation at all for SERVICE -> REPOSITORY: the second hop is missing entirely.
    proposition = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=REPOSITORY,
        path_entity_ids=(CONTROLLER, SERVICE, REPOSITORY),
    )

    claim = claim_from_proposition(
        proposition,
        (hop1,),
        run_id=RUN_ID,
        epistemic_type="inferred",
        producer=PRODUCER,
    )

    assert claim.support_status == "insufficient_evidence"
    # Per the Phase 4 diagnostics policy, the matched prefix (hop1) is still
    # cited as evidence even though the overall proposition is unsupported.
    assert claim.evidence_chain.hop_count == 1
    assert claim.evidence_chain.items[0].from_symbol_id == CONTROLLER
    assert claim.evidence_chain.items[0].to_symbol_id == SERVICE
    assert SERVICE in claim.evidence_chain.reasoning
    assert REPOSITORY in claim.evidence_chain.reasoning


def test_relation_from_a_different_run_is_rejected() -> None:
    relation = _relation(run_id="run-OTHER")
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    with pytest.raises(BrokenRelationChainError, match="run_id"):
        claim_from_proposition(
            proposition,
            (relation,),
            run_id=RUN_ID,
            epistemic_type="observed",
            producer=PRODUCER,
        )


# ---------------------------------------------------------------------------
# The canonical precision property: a real, connected, valid chain cannot
# prove an unrelated/overreaching proposition.
# ---------------------------------------------------------------------------


def test_unrelated_direct_claim_is_not_supported_by_a_real_connected_chain() -> None:
    """Controller -> Service -> PaymentService is a real, valid, fully
    resolved 2-hop chain. A direct_relation proposition claiming Controller
    directly calls PaymentService is FALSE -- that edge was never observed,
    only reachability through Service was -- and must come back
    insufficient_evidence, not supported, even though every hop in the
    chain is individually real and resolved.
    """
    controller_calls_service = _relation(
        source_entity_id=CONTROLLER, target_entity_id=SERVICE, span_start_line=10, span_end_line=10
    )
    service_calls_payment = _relation(
        source_entity_id=SERVICE, target_entity_id=PAYMENT_SERVICE, span_start_line=20, span_end_line=20
    )
    evidence_pool = (controller_calls_service, service_calls_payment)

    overreaching_proposition = ClaimProposition(
        kind="direct_relation",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
    )

    overreaching_claim = claim_from_proposition(
        overreaching_proposition,
        evidence_pool,
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
    )

    assert overreaching_claim.support_status == "insufficient_evidence"
    assert overreaching_claim.evidence_chain.hop_count == 0
    assert "direct_relation" in overreaching_claim.evidence_chain.reasoning or (
        "does not satisfy" in overreaching_claim.evidence_chain.reasoning
    )
    # And the displayed statement asserts exactly (and only) the unsupported
    # proposition -- never anything describing PaymentService's behavior.
    assert overreaching_claim.statement == render_proposition_statement(overreaching_proposition)

    # Contrast: the SAME evidence pool correctly supports the accurate
    # REACHABILITY proposition, proving the adapter is precise rather than
    # simply too strict across the board.
    accurate_reachability_proposition = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=PAYMENT_SERVICE,
        path_entity_ids=(CONTROLLER, SERVICE, PAYMENT_SERVICE),
    )

    reachability_claim = claim_from_proposition(
        accurate_reachability_proposition,
        evidence_pool,
        run_id=RUN_ID,
        epistemic_type="inferred",
        producer=PRODUCER,
    )

    assert reachability_claim.support_status == "supported"
    assert reachability_claim.evidence_chain.hop_count == 2
    first_item, second_item = reachability_claim.evidence_chain.items
    assert first_item.from_symbol_id == CONTROLLER
    assert first_item.to_symbol_id == SERVICE
    assert second_item.from_symbol_id == SERVICE
    assert second_item.to_symbol_id == PAYMENT_SERVICE


# ---------------------------------------------------------------------------
# G3 correction: arbitrary prose can no longer be attached to a
# proposition-backed claim -- there is no code path for it any more.
# ---------------------------------------------------------------------------


def test_claim_from_proposition_has_no_statement_parameter() -> None:
    """The old (G2) `statement` parameter -- the arbitrary-prose gap -- must
    be entirely absent from the adapter's public signature. This is a
    structural guarantee, not a convention: there is no way for a caller to
    pass free text into a proposition-backed claim through this function at
    all."""
    signature = inspect.signature(claim_from_proposition)
    assert "statement" not in signature.parameters


def test_passing_an_unexpected_statement_keyword_is_rejected() -> None:
    """Belt-and-braces: even attempting to pass `statement=` (e.g. a caller
    migrating stale G2 call sites) fails loudly with a TypeError from the
    normal Python calling convention, rather than being silently accepted
    and threaded through to the claim's displayed text."""
    relation = _relation()
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    with pytest.raises(TypeError):
        claim_from_proposition(
            proposition,
            (relation,),
            run_id=RUN_ID,
            epistemic_type="observed",
            producer=PRODUCER,
            statement="PaymentService performs fraud detection",  # type: ignore[call-arg]
        )


def test_statement_is_generated_from_the_verified_proposition_direct_relation() -> None:
    """The displayed claim.statement equals render_proposition_statement
    computed independently for the exact same proposition + display names --
    proving the adapter never diverges from the sanctioned renderer."""
    relation = _relation()
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
        entity_display_names=DISPLAY_NAMES,
    )

    expected = render_proposition_statement(proposition, entity_display_names=DISPLAY_NAMES)
    assert claim.statement == expected
    assert claim.statement == "Controller calls Service."


def test_statement_is_generated_from_the_verified_proposition_reachability() -> None:
    hop1 = _relation(source_entity_id=CONTROLLER, target_entity_id=SERVICE, span_start_line=10, span_end_line=10)
    hop2 = _relation(source_entity_id=SERVICE, target_entity_id=REPOSITORY, span_start_line=20, span_end_line=20)
    proposition = ClaimProposition(
        kind="reachability",
        subject_entity_id=CONTROLLER,
        relation_kind="calls",
        object_entity_id=REPOSITORY,
        path_entity_ids=(CONTROLLER, SERVICE, REPOSITORY),
    )

    claim = claim_from_proposition(
        proposition,
        (hop1, hop2),
        run_id=RUN_ID,
        epistemic_type="inferred",
        producer=PRODUCER,
        entity_display_names=DISPLAY_NAMES,
    )

    expected = render_proposition_statement(proposition, entity_display_names=DISPLAY_NAMES)
    assert claim.statement == expected
    assert claim.statement == "Controller reaches Repository through a call path."


def test_display_wording_changes_do_not_change_semantic_claim_id() -> None:
    """Two claims built from the SAME proposition + SAME evidence but
    different entity_display_names (different rendered wording) must
    produce the SAME claim.id -- semantic identity is independent of
    display formatting."""
    relation = _relation()
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim_with_names = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
        entity_display_names={CONTROLLER: "The Controller Class", SERVICE: "The Service Class"},
    )
    claim_without_names = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
    )

    assert claim_with_names.statement != claim_without_names.statement
    assert claim_with_names.id == claim_without_names.id
    assert claim_with_names.evidence_chain.id == claim_without_names.evidence_chain.id


# ---------------------------------------------------------------------------
# contradicted: explicit pass-through only, never auto-detected. Statement
# is rendered from the proposition here too -- see module docstring's
# "Scope boundary: contradicted" section for why the rendering is
# verdict-invariant.
# ---------------------------------------------------------------------------


def test_assert_contradicted_passes_through_with_evidence() -> None:
    relation = _relation()
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    claim = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
        entity_display_names=DISPLAY_NAMES,
        assert_contradicted=True,
    )

    assert claim.support_status == "contradicted"
    assert claim.evidence_chain.hop_count == 1
    assert "caller-asserted" in claim.evidence_chain.reasoning
    # The statement still describes the proposition, not the verdict -- the
    # verdict lives in support_status, not in a separately-worded sentence.
    assert claim.statement == render_proposition_statement(proposition, entity_display_names=DISPLAY_NAMES)
    assert claim.statement == "Controller calls Service."


def test_assert_contradicted_has_no_statement_parameter_either() -> None:
    """Same structural guarantee as the supported/insufficient_evidence
    path: assert_contradicted=True still goes through the single
    `claim_from_proposition` signature, which has no `statement` param."""
    signature = inspect.signature(claim_from_proposition)
    assert "statement" not in signature.parameters


def test_assert_contradicted_still_requires_at_least_one_evidence_item() -> None:
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CONTROLLER, relation_kind="calls", object_entity_id=SERVICE
    )

    with pytest.raises(BrokenRelationChainError, match="zero evidence"):
        claim_from_proposition(
            proposition,
            (),
            run_id=RUN_ID,
            epistemic_type="observed",
            producer=PRODUCER,
            assert_contradicted=True,
        )


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_same_inputs_yield_the_same_claim_id() -> None:
    def build():
        hop1 = _relation(source_entity_id=CONTROLLER, target_entity_id=SERVICE, span_start_line=10, span_end_line=10)
        hop2 = _relation(source_entity_id=SERVICE, target_entity_id=REPOSITORY, span_start_line=20, span_end_line=20)
        proposition = ClaimProposition(
            kind="reachability",
            subject_entity_id=CONTROLLER,
            relation_kind="calls",
            object_entity_id=REPOSITORY,
            path_entity_ids=(CONTROLLER, SERVICE, REPOSITORY),
        )
        return claim_from_proposition(
            proposition,
            (hop1, hop2),
            run_id=RUN_ID,
            epistemic_type="inferred",
            producer=PRODUCER,
            subject_symbol_ids=(CONTROLLER, SERVICE, REPOSITORY),
        )

    first, second = build(), build()

    assert first.id == second.id
    assert first.evidence_chain.id == second.evidence_chain.id
    assert first.evidence_chain.items[0].id == second.evidence_chain.items[0].id
    assert first.evidence_chain.items[1].id == second.evidence_chain.items[1].id
