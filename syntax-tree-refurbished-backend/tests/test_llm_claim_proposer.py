"""Tests for L1: ``app.architectural_explanation.llm_claim_proposer.
LLMClaimProposer``.

No live API is ever called here -- every test injects a ``FakeInvestigation
Model`` test double (a controllable structural implementation of
``InvestigationModel``), never a real network-backed provider and never
``NoConfiguredModel`` (that is a different thing: an always-raising null
object used to test the "no proposer should be able to swallow this"
behavior, not a controllable fake).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from syntax_tree_refurbished.app.architectural_explanation.claim_proposer import ClaimProposer
from syntax_tree_refurbished.app.architectural_explanation.llm_claim_proposer import (
    LLMClaimProposer,
)
from syntax_tree_refurbished.app.investigation.llm_model import ModelReply
from syntax_tree_refurbished.core.models.architectural_explanation import BoundedEvidence
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol

RUN_ID = "run:l1-proposer-test"


def _symbol(id_suffix: str, name: str, kind: str = "function") -> ParsedSymbol:
    return ParsedSymbol(
        id=f"symbol:{id_suffix}",
        run_id=RUN_ID,
        path=f"pkg/{id_suffix}.py",
        language="python",
        kind=kind,  # type: ignore[arg-type]
        name=name,
        qualified_name=f"python:pkg/{id_suffix}.py::{name}",
        start_line=1,
        end_line=2,
        source_region_id=f"region:{id_suffix}",
        signature="",
        exported=True,
        async_=False,
    )


def _bounded_evidence() -> BoundedEvidence:
    subject = _symbol("a", "CallerService")
    target = _symbol("b", "CalleeRepository")
    return BoundedEvidence(run_id=RUN_ID, target_entity_id=subject.id, symbols=(subject, target), relations=())


@dataclass
class FakeInvestigationModel:
    """Controllable structural implementation of ``InvestigationModel``.

    ``data`` is returned verbatim (wrapped in a ``ModelReply``) from
    ``complete_json``. Records every call's ``system``/``messages``/
    ``max_tokens`` so tests can assert on exactly what was sent.
    """

    data: dict[str, Any]
    name: str = "fake-l1-model"
    calls: list[dict[str, Any]] = field(default_factory=list)

    @property
    def model_name(self) -> str:
        return self.name

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        self.calls.append({"system": system, "messages": messages, "max_tokens": max_tokens})
        return ModelReply(data=self.data, model=self.name, tokens_in=10, tokens_out=5, latency_ms=1)


@dataclass
class RaisingInvestigationModel:
    """Mirrors NoConfiguredModel's always-raising behavior, but as a
    controllable fake (distinct from NoConfiguredModel itself) so the test
    doesn't depend on that class's exact message text."""

    name: str = "raising-fake-model"

    @property
    def model_name(self) -> str:
        return self.name

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        raise RuntimeError("No live LLM is configured.")


# ---------------------------------------------------------------------------
# 1. Well-formed response, 2 valid in-vocabulary proposals
# ---------------------------------------------------------------------------


def test_propose_claims_accepts_well_formed_valid_proposals():
    evidence = _bounded_evidence()
    model = FakeInvestigationModel(
        data={
            "proposals": [
                {
                    "proposition": {
                        "kind": "direct_relation",
                        "subject_entity_id": "symbol:a",
                        "relation_kind": "calls",
                        "object_entity_id": "symbol:b",
                    },
                    "proposed_statement": "CallerService calls CalleeRepository",
                },
                {
                    "proposition": {
                        "kind": "reachability",
                        "subject_entity_id": "symbol:a",
                        "relation_kind": "calls",
                        "object_entity_id": "symbol:b",
                        "path_entity_ids": ["symbol:a", "symbol:b"],
                    },
                },
            ]
        }
    )
    proposer = LLMClaimProposer(model)
    result = proposer.propose_claims(evidence)

    assert len(result) == 2
    assert result[0].proposition.kind == "direct_relation"
    assert result[0].proposition.subject_entity_id == "symbol:a"
    assert result[0].proposition.object_entity_id == "symbol:b"
    assert result[0].proposed_statement == "CallerService calls CalleeRepository"
    assert result[0].producer.producer_type == "llm"
    assert result[0].producer.name == "fake-l1-model"

    assert result[1].proposition.kind == "reachability"
    assert result[1].proposition.path_entity_ids == ("symbol:a", "symbol:b")


# ---------------------------------------------------------------------------
# 2. One valid + one out-of-vocabulary proposal -> only the valid one returned
# ---------------------------------------------------------------------------


def test_propose_claims_drops_out_of_vocabulary_proposal_silently():
    evidence = _bounded_evidence()
    model = FakeInvestigationModel(
        data={
            "proposals": [
                {
                    "proposition": {
                        "kind": "direct_relation",
                        "subject_entity_id": "symbol:a",
                        "relation_kind": "calls",
                        "object_entity_id": "symbol:b",
                    },
                },
                {
                    "proposition": {
                        "kind": "direct_relation",
                        "subject_entity_id": "symbol:a",
                        "relation_kind": "imports",
                        "object_entity_id": "symbol:b",
                    },
                },
            ]
        }
    )
    proposer = LLMClaimProposer(model)
    result = proposer.propose_claims(evidence)

    assert len(result) == 1
    assert result[0].proposition.relation_kind == "calls"


# ---------------------------------------------------------------------------
# 3. Proposal referencing an entity id not in bounded evidence -> dropped
# ---------------------------------------------------------------------------


def test_propose_claims_drops_proposal_referencing_unknown_entity_id():
    evidence = _bounded_evidence()
    model = FakeInvestigationModel(
        data={
            "proposals": [
                {
                    "proposition": {
                        "kind": "direct_relation",
                        "subject_entity_id": "symbol:a",
                        "relation_kind": "calls",
                        "object_entity_id": "symbol:not-in-evidence",
                    },
                },
            ]
        }
    )
    proposer = LLMClaimProposer(model)
    result = proposer.propose_claims(evidence)

    assert result == ()
    for proposal in result:
        assert proposal.proposition.object_entity_id != "symbol:not-in-evidence"


# ---------------------------------------------------------------------------
# 4. Empty/malformed proposals -> returns () without raising
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "data",
    [
        {"proposals": []},
        {},
        {"proposals": "not-a-list"},
        {"proposals": [{"no_proposition_key": True}]},
        {"proposals": [{"proposition": {"kind": "direct_relation"}}]},  # missing required fields
        {"proposals": ["not-a-dict"]},
    ],
)
def test_propose_claims_handles_malformed_replies_without_raising(data):
    evidence = _bounded_evidence()
    model = FakeInvestigationModel(data=data)
    proposer = LLMClaimProposer(model)
    result = proposer.propose_claims(evidence)
    assert result == ()


# ---------------------------------------------------------------------------
# 5. Prompt is bounded: contains only the evidence's own entities, never
#    entities from a larger universe that weren't included in the evidence.
# ---------------------------------------------------------------------------


def test_prompt_is_bounded_to_the_supplied_evidence_only():
    subject = _symbol("a", "CallerServiceXyz")
    target = _symbol("b", "CalleeRepositoryXyz")
    evidence = BoundedEvidence(
        run_id=RUN_ID, target_entity_id=subject.id, symbols=(subject, target), relations=()
    )

    # A separate, larger universe of symbols NOT included in the bounded
    # evidence above -- their names must never leak into the prompt.
    excluded_symbols = [
        _symbol("c", "UnrelatedWidgetAlpha"),
        _symbol("d", "UnrelatedWidgetBeta"),
        _symbol("e", "SecretInternalHelperGamma"),
    ]

    model = FakeInvestigationModel(data={"proposals": []})
    proposer = LLMClaimProposer(model)
    proposer.propose_claims(evidence)

    assert len(model.calls) == 1
    sent_messages = model.calls[0]["messages"]
    sent_text = "\n".join(m["content"] for m in sent_messages) + "\n" + model.calls[0]["system"]

    assert "CallerServiceXyz" in sent_text
    assert "CalleeRepositoryXyz" in sent_text
    assert "symbol:a" in sent_text
    assert "symbol:b" in sent_text

    for excluded in excluded_symbols:
        assert excluded.name not in sent_text
        assert excluded.id not in sent_text


# ---------------------------------------------------------------------------
# 6. Underlying model raising propagates -- never swallowed to ()
# ---------------------------------------------------------------------------


def test_propose_claims_reraises_when_model_raises():
    evidence = _bounded_evidence()
    proposer = LLMClaimProposer(RaisingInvestigationModel())
    with pytest.raises(RuntimeError, match="No live LLM is configured"):
        proposer.propose_claims(evidence)


# ---------------------------------------------------------------------------
# 7. Determinism: same fake model + same evidence -> same output
# ---------------------------------------------------------------------------


def test_propose_claims_is_deterministic_for_same_inputs():
    evidence = _bounded_evidence()
    data = {
        "proposals": [
            {
                "proposition": {
                    "kind": "direct_relation",
                    "subject_entity_id": "symbol:a",
                    "relation_kind": "calls",
                    "object_entity_id": "symbol:b",
                },
                "proposed_statement": "a calls b",
            },
        ]
    }
    model_1 = FakeInvestigationModel(data=data)
    model_2 = FakeInvestigationModel(data=data)
    proposer_1 = LLMClaimProposer(model_1)
    proposer_2 = LLMClaimProposer(model_2)

    result_1 = proposer_1.propose_claims(evidence)
    result_2 = proposer_2.propose_claims(evidence)

    # Compare everything except ProducerInfo.produced_at, which is a
    # real wall-clock timestamp by design (see ProducerInfo) and is not
    # part of what "the same inputs produce the same output" means here.
    assert len(result_1) == len(result_2) == 1
    assert result_1[0].proposition == result_2[0].proposition
    assert result_1[0].proposed_statement == result_2[0].proposed_statement
    assert result_1[0].producer.producer_type == result_2[0].producer.producer_type
    assert result_1[0].producer.name == result_2[0].producer.name
    assert result_1[0].producer.version == result_2[0].producer.version


# ---------------------------------------------------------------------------
# 8. LLMClaimProposer satisfies the ClaimProposer Protocol structurally
# ---------------------------------------------------------------------------


def test_llm_claim_proposer_satisfies_claim_proposer_protocol():
    model = FakeInvestigationModel(data={"proposals": []})
    proposer: ClaimProposer = LLMClaimProposer(model)
    assert callable(proposer.propose_claims)
    result = proposer.propose_claims(_bounded_evidence())
    assert isinstance(result, tuple)
