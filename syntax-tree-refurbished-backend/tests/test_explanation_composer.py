"""Tests for L3: app.architectural_explanation.explanation_composer.

Follows the same fixture-construction pattern as
``test_architectural_explanation_contract.py``'s ``_verified_claim`` helper
-- real ``ArchitecturalClaim``/``EvidenceChain``/``ProducerInfo`` objects,
never mocks. These tests exist to prove, empirically, the two properties
the composer's docstring claims by construction:

1. The narrative visibly and honestly distinguishes supported from
   insufficient-evidence (and contradicted) claims -- never a single
   undifferentiated, uniformly-confident paragraph.
2. The narrative introduces NO architectural fact absent from the input
   claims -- proven via a "disjoint claim sets" test (#4 below): compose
   from only ONE of two disjoint claim sets and assert none of the other
   set's distinctive entity names leak into the output.
"""

from __future__ import annotations

from syntax_tree_refurbished.app.architectural_explanation.explanation_composer import (
    compose_architectural_explanation,
)
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    ClaimProposition,
    EvidenceChain,
    ProducerInfo,
)

RUN_ID = "run:composer-test"


def _extractor_producer() -> ProducerInfo:
    return ProducerInfo(producer_type="extractor", name="test-verifier", version="v1")


def _explanation_producer() -> ProducerInfo:
    return ProducerInfo(producer_type="extractor", name="explanation-composer", version="v1")


def _claim(
    *,
    claim_id: str,
    statement: str,
    support_status: str,
    subject_entity_id: str = "symbol:a",
    object_entity_id: str = "symbol:b",
) -> ArchitecturalClaim:
    proposition = ClaimProposition(
        kind="direct_relation",
        subject_entity_id=subject_entity_id,
        relation_kind="calls",
        object_entity_id=object_entity_id,
    )
    chain = EvidenceChain(id=f"chain:{claim_id}", run_id=RUN_ID, claim_id=claim_id, items=())
    return ArchitecturalClaim(
        id=claim_id,
        run_id=RUN_ID,
        statement=statement,
        epistemic_type="observed",
        support_status=support_status,  # type: ignore[arg-type]
        confidence=None,
        producer=_extractor_producer(),
        evidence_chain=chain,
        proposition=proposition,
    )


# ---------------------------------------------------------------------------
# 1. All-supported claims
# ---------------------------------------------------------------------------


def test_all_supported_claims_presented_as_established_facts():
    claims = (
        _claim(
            claim_id="claim:1",
            statement="OrderController calls OrderService.",
            support_status="supported",
        ),
        _claim(
            claim_id="claim:2",
            statement="OrderService calls PaymentGateway.",
            support_status="supported",
        ),
    )
    explanation = compose_architectural_explanation(
        explanation_id="explanation:1",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        producer=_explanation_producer(),
    )
    assert explanation.supported_claims == claims
    assert "What Laura's could establish:" in explanation.narrative
    assert "OrderController calls OrderService." in explanation.narrative
    assert "OrderService calls PaymentGateway." in explanation.narrative
    # No insufficient-evidence section should appear when there are none.
    assert "What Laura's could not establish:" not in explanation.narrative


# ---------------------------------------------------------------------------
# 2. Mixed supported + insufficient-evidence
# ---------------------------------------------------------------------------


def test_mixed_claims_narrative_visibly_distinguishes_sections():
    claims = (
        _claim(
            claim_id="claim:1",
            statement="OrderController calls OrderService.",
            support_status="supported",
        ),
        _claim(
            claim_id="claim:2",
            statement="OrderController calls FraudService.",
            support_status="insufficient_evidence",
        ),
    )
    explanation = compose_architectural_explanation(
        explanation_id="explanation:2",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        producer=_explanation_producer(),
    )
    narrative = explanation.narrative

    supported_header = "What Laura's could establish:"
    insufficient_header = "What Laura's could not establish:"
    assert supported_header in narrative
    assert insufficient_header in narrative
    # Structural check: the supported section appears strictly before the
    # insufficient-evidence section, and the supported claim's raw
    # statement is not itself hedged, while the insufficient claim's
    # statement never appears un-hedged.
    assert narrative.index(supported_header) < narrative.index(insufficient_header)
    assert "- OrderController calls OrderService." in narrative
    # The insufficient claim's statement must never appear as its own bare,
    # unhedged bullet line (only embedded inside the hedge sentence below).
    assert "- OrderController calls FraudService." not in narrative
    assert "did not have sufficient deterministic evidence to establish that OrderController calls FraudService" in narrative


# ---------------------------------------------------------------------------
# 3. All-insufficient-evidence claims
# ---------------------------------------------------------------------------


def test_all_insufficient_evidence_claims_are_honestly_hedged_not_refuted():
    claims = (
        _claim(
            claim_id="claim:1",
            statement="OrderController calls FraudService.",
            support_status="insufficient_evidence",
        ),
        _claim(
            claim_id="claim:2",
            statement="OrderController calls AuditLogger.",
            support_status="insufficient_evidence",
        ),
    )
    explanation = compose_architectural_explanation(
        explanation_id="explanation:3",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        producer=_explanation_producer(),
    )
    narrative = explanation.narrative

    assert "What Laura's could not establish:" in narrative
    # This must never read as if it were a supported-claims narrative.
    assert "What Laura's could establish:" not in narrative
    # Never phrase insufficient evidence as a refutation ("does not call").
    assert "does not call" not in narrative
    assert "never calls" not in narrative
    # Every claim's statement must appear only inside the hedge, never as
    # its own bare, unqualified bullet line.
    for raw_statement in ("OrderController calls FraudService.", "OrderController calls AuditLogger."):
        assert f"- {raw_statement}" not in narrative
    assert "did not have sufficient deterministic evidence to establish that OrderController calls FraudService" in narrative
    assert "did not have sufficient deterministic evidence to establish that OrderController calls AuditLogger" in narrative


# ---------------------------------------------------------------------------
# 4. Core "no new facts" property
# ---------------------------------------------------------------------------


def test_composer_introduces_no_facts_absent_from_input_claims():
    """Two disjoint claim sets, each mentioning entirely distinct,
    distinctive entity names. Compose from ONLY set A, and assert nothing
    distinctive to set B ever appears in the resulting narrative -- the
    strongest evidence available that this composer cannot hallucinate an
    architectural fact it wasn't given."""
    set_a = (
        _claim(
            claim_id="claim:a1",
            statement="ZanzibarWidgetFactory calls QuokkaTransformEngine.",
            support_status="supported",
            subject_entity_id="symbol:zanzibar",
            object_entity_id="symbol:quokka",
        ),
        _claim(
            claim_id="claim:a2",
            statement="ZanzibarWidgetFactory calls NarwhalCacheLayer.",
            support_status="insufficient_evidence",
            subject_entity_id="symbol:zanzibar",
            object_entity_id="symbol:narwhal",
        ),
    )
    set_b_distinctive_names = (
        "PlatypusOrchestrator",
        "MongooseSerializer",
        "OcelotRetryPolicy",
    )

    explanation = compose_architectural_explanation(
        explanation_id="explanation:4",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:zanzibar",
        claims=set_a,
        producer=_explanation_producer(),
    )

    for distinctive_name in set_b_distinctive_names:
        assert distinctive_name not in explanation.narrative

    # And, sanity check, set A's own distinctive names DO appear -- proving
    # the assertion above is a meaningful negative, not a vacuous one
    # (e.g. because the narrative happened to be empty).
    assert "ZanzibarWidgetFactory" in explanation.narrative
    assert "QuokkaTransformEngine" in explanation.narrative
    assert "NarwhalCacheLayer" in explanation.narrative


# ---------------------------------------------------------------------------
# 5. Empty claims
# ---------------------------------------------------------------------------


def test_empty_claims_produce_valid_honest_empty_state_explanation():
    explanation = compose_architectural_explanation(
        explanation_id="explanation:5",
        run_id=RUN_ID,
        target_kind="module",
        target_id="module:pkg",
        claims=(),
        producer=_explanation_producer(),
    )
    assert explanation.claims == ()
    assert explanation.supported_claims == ()
    assert explanation.insufficient_evidence_claims == ()
    assert explanation.narrative  # non-empty, honest statement
    assert "no verified claims" in explanation.narrative.lower()
    # Must not fabricate a confident conclusion like "no relations exist".
    assert "What Laura's could establish:" not in explanation.narrative


# ---------------------------------------------------------------------------
# 6. Claims pass through unchanged
# ---------------------------------------------------------------------------


def test_input_claims_tuple_passes_through_unfiltered_and_unmutated():
    claims = (
        _claim(claim_id="claim:1", statement="A calls B.", support_status="supported"),
        _claim(claim_id="claim:2", statement="A calls C.", support_status="insufficient_evidence"),
        _claim(claim_id="claim:3", statement="A calls D.", support_status="contradicted"),
    )
    explanation = compose_architectural_explanation(
        explanation_id="explanation:6",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        producer=_explanation_producer(),
    )
    assert explanation.claims is claims  # identity, not just equality
    assert explanation.claims == claims


# ---------------------------------------------------------------------------
# 7. Determinism
# ---------------------------------------------------------------------------


def test_composer_is_deterministic_same_inputs_same_narrative():
    claims = (
        _claim(
            claim_id="claim:1",
            statement="OrderController calls OrderService.",
            support_status="supported",
        ),
        _claim(
            claim_id="claim:2",
            statement="OrderController calls FraudService.",
            support_status="insufficient_evidence",
        ),
    )
    kwargs = dict(
        explanation_id="explanation:7",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        producer=_explanation_producer(),
    )
    first = compose_architectural_explanation(**kwargs)
    second = compose_architectural_explanation(**kwargs)
    assert first.narrative == second.narrative
    assert first.narrative is not None


# ---------------------------------------------------------------------------
# Defensive: contradicted claims (not produced by this slice's verifier
# today, but a valid ClaimSupportStatus value) get their own explicit,
# non-blended section too -- never silently dropped or filed as supported.
# ---------------------------------------------------------------------------


def test_contradicted_claim_gets_its_own_explicit_section():
    claims = (
        _claim(
            claim_id="claim:1",
            statement="OrderController calls PaymentGateway.",
            support_status="contradicted",
        ),
    )
    explanation = compose_architectural_explanation(
        explanation_id="explanation:8",
        run_id=RUN_ID,
        target_kind="entity",
        target_id="symbol:a",
        claims=claims,
        producer=_explanation_producer(),
    )
    narrative = explanation.narrative
    assert "What Laura's evidence contradicts:" in narrative
    assert "What Laura's could establish:" not in narrative
    assert "- OrderController calls PaymentGateway." not in narrative  # only the hedged form as a bare bullet
    assert "contradicts the claim that OrderController calls PaymentGateway" in narrative
