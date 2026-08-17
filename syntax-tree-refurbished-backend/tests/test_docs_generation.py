"""Tests for POST /api/docs/components/{component_id}/generate --
evidence-grounded per-component LLM documentation generation.

Follows tests/test_architectural_explanation_route.py's pattern exactly:
a real ``POST /api/analyze`` against a tiny repository fixture produces
real ParsedSymbol/ObservedProgramRelation data; the LLM boundary is faked
via the same ``app.state.claim_proposer`` injection hook the
architectural-explanation route uses, plus the docs route's own
``app.state.docs_generation_model`` hook for the documentation-writing
call. No live LLM call anywhere.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.investigation.llm_model import ModelReply
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.architectural_explanation import (
    BoundedEvidence,
    ClaimProposal,
)
from syntax_tree_refurbished.core.models.provenance import ClaimProposition, ProducerInfo


class _FixedProposalsProposer:
    def __init__(self, proposals: tuple[ClaimProposal, ...]) -> None:
        self._proposals = proposals

    def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
        return self._proposals


class _ScriptedDocModel:
    """Fake documentation-writing model returning a fixed JSON payload.

    ``echo_claim_notes=True`` makes it extract every ``claim_id=...`` it
    was actually shown in the user prompt and write a note for each --
    the only way a fake can produce VALID claim ids, since real claim ids
    are content-derived hashes not knowable before the request runs.
    """

    def __init__(
        self,
        *,
        purpose: str = "Coordinates the request flow.",
        responsibilities: tuple[str, ...] = ("Delegates work to its collaborator.",),
        extra_notes: tuple[dict[str, Any], ...] = (),
        echo_claim_notes: bool = True,
        note_text: str = "This relationship is the component's main collaboration.",
    ) -> None:
        self._purpose = purpose
        self._responsibilities = responsibilities
        self._extra_notes = extra_notes
        self._echo_claim_notes = echo_claim_notes
        self._note_text = note_text
        self.seen_prompts: list[str] = []

    @property
    def model_name(self) -> str:
        return "fake-docs-model"

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        prompt = messages[0]["content"]
        self.seen_prompts.append(prompt)
        notes: list[dict[str, Any]] = []
        if self._echo_claim_notes:
            for claim_id in re.findall(r"claim_id=(\S+)", prompt):
                notes.append({"claim_id": claim_id, "note": self._note_text})
        notes.extend(self._extra_notes)
        return ModelReply(
            data={
                "purpose": self._purpose,
                "responsibilities": list(self._responsibilities),
                "relationship_notes": notes,
            },
            model="fake-docs-model",
            tokens_in=123,
            tokens_out=45,
            latency_ms=7,
        )


class _FailingDocModel:
    @property
    def model_name(self) -> str:
        return "failing-docs-model"

    def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
        raise RuntimeError("LLM network error: connection refused")


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _analyzed(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    run_id = response.json()["run_id"]
    return app, run_id, client


def _proposal(subject_id: str, object_id: str, statement: str) -> ClaimProposal:
    return ClaimProposal(
        proposition=ClaimProposition(
            kind="direct_relation",
            subject_entity_id=subject_id,
            relation_kind="calls",
            object_entity_id=object_id,
        ),
        proposed_statement=statement,
        producer=ProducerInfo(producer_type="llm", name="fake-test-model", version="v1"),
    )


def test_successful_structured_generation(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    callee = next(s for s in symbols if s.name == "callee")
    app.state.claim_proposer = _FixedProposalsProposer(
        (_proposal(caller.id, callee.id, "caller calls callee"),)
    )
    doc_model = _ScriptedDocModel()
    app.state.docs_generation_model = doc_model

    response = client.post(
        f"/api/docs/components/{caller.id}/generate", params={"run_id": run_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ai_generated"] is True
    assert body["unavailable_reason"] is None
    assert body["component_id"] == caller.id
    assert body["purpose"] == "Coordinates the request flow."
    assert body["responsibilities"] == ["Delegates work to its collaborator."]
    assert body["supported_count"] == 1
    assert len(body["claims"]) == 1
    claim = body["claims"][0]
    assert claim["support_status"] == "supported"
    # The relationship note references the real verified claim id.
    assert len(body["relationship_notes"]) == 1
    assert body["relationship_notes"][0]["claim_id"] == claim["id"]
    # run_metadata carries the writing model's real reply metadata.
    metadata = body["run_metadata"]
    assert metadata["model"] == "fake-docs-model"
    assert metadata["tokens_in"] == 123
    assert metadata["tokens_out"] == 45
    assert metadata["latency_ms"] == 7
    # The prompt the writer saw contains deterministic facts, never raw repo access.
    assert "qualified_name" in doc_model.seen_prompts[0]
    assert f"claim_id={claim['id']}" in doc_model.seen_prompts[0]


def test_invalid_claim_id_notes_are_deterministically_discarded(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    callee = next(s for s in symbols if s.name == "callee")
    app.state.claim_proposer = _FixedProposalsProposer(
        (_proposal(caller.id, callee.id, "caller calls callee"),)
    )
    app.state.docs_generation_model = _ScriptedDocModel(
        echo_claim_notes=False,
        extra_notes=(
            {"claim_id": "claim:fabricated-id", "note": "This claim id was never verified."},
            {"note": "malformed -- no claim id at all"},
        ),
    )

    response = client.post(
        f"/api/docs/components/{caller.id}/generate", params={"run_id": run_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ai_generated"] is True
    assert body["relationship_notes"] == []
    assert body["discarded_relationship_notes"] == 2
    # The verified claim itself is unaffected by the discarded notes.
    assert len(body["claims"]) == 1


def test_confident_prose_cannot_upgrade_insufficient_evidence(tmp_path: Path) -> None:
    """A direct caller->deeper claim is genuinely false (only reachable
    via callee), so the deterministic verifier marks it
    insufficient_evidence. A maximally confident LLM note for that claim
    must not change the claim's support_status in the response."""
    _write(
        tmp_path / "app.py",
        "def caller():\n    return callee()\n\n\ndef callee():\n    return deeper()\n\n\ndef deeper():\n    return 1\n",
    )
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    deeper = next(s for s in symbols if s.name == "deeper")
    app.state.claim_proposer = _FixedProposalsProposer(
        (_proposal(caller.id, deeper.id, "caller directly calls deeper"),)
    )
    app.state.docs_generation_model = _ScriptedDocModel(
        note_text="caller absolutely, definitely calls deeper directly. This is fully established."
    )

    response = client.post(
        f"/api/docs/components/{caller.id}/generate", params={"run_id": run_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["supported_count"] == 0
    assert body["insufficient_evidence_count"] == 1
    claim = body["claims"][0]
    assert claim["support_status"] == "insufficient_evidence"
    # The note is attached to the claim, but the verifier's verdict is untouched.
    assert body["relationship_notes"][0]["claim_id"] == claim["id"]


def test_not_configured_returns_honest_unavailable_body(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    # No docs_generation_model injected and environment=test -> NoConfiguredModel.

    response = client.post(
        f"/api/docs/components/{caller.id}/generate", params={"run_id": run_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ai_generated"] is False
    assert body["unavailable_reason"] == "not_configured"
    # No fabricated generated content.
    assert body["purpose"] == ""
    assert body["responsibilities"] == []
    assert body["relationship_notes"] == []
    assert body["claims"] == []
    assert body["run_metadata"]["model"] == "none"
    # The deterministic documentation surface still works alongside.
    deterministic = client.get(
        f"/api/docs/components/{caller.id}", params={"run_id": run_id}
    )
    assert deterministic.status_code == 200


def test_provider_failure_returns_503_not_500(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    app.state.docs_generation_model = _FailingDocModel()

    response = client.post(
        f"/api/docs/components/{caller.id}/generate", params={"run_id": run_id}
    )

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["code"] == "documentation_generation_unavailable"
    assert "connection refused" not in response.text


def test_unknown_component_404s(tmp_path: Path) -> None:
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    _app, run_id, client = _analyzed(tmp_path)

    response = client.post(
        "/api/docs/components/symbol:does-not-exist/generate", params={"run_id": run_id}
    )

    assert response.status_code == 404


def test_module_component_generation_uses_top_level_symbols(tmp_path: Path) -> None:
    """A module hierarchy item (the roots the Doc Studio tree shows) must
    also generate: the claim pipeline runs against the module's top-level
    symbols and the facts describe the module."""
    _write(tmp_path / "app.py", "def caller():\n    return callee()\n\n\ndef callee():\n    return 1\n")
    app, run_id, client = _analyzed(tmp_path)
    hierarchy = client.get("/api/docs/hierarchy", params={"run_id": run_id}).json()
    module_item = hierarchy["items"][0]
    assert module_item["kind"] == "module"
    symbols = app.state.run_store.get_symbols(run_id)
    caller = next(s for s in symbols if s.name == "caller")
    callee = next(s for s in symbols if s.name == "callee")
    app.state.claim_proposer = _FixedProposalsProposer(
        (_proposal(caller.id, callee.id, "caller calls callee"),)
    )
    doc_model = _ScriptedDocModel()
    app.state.docs_generation_model = doc_model

    response = client.post(
        f"/api/docs/components/{module_item['id']}/generate", params={"run_id": run_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ai_generated"] is True
    assert body["supported_count"] == 1
    assert "kind: module" in doc_model.seen_prompts[0]
    assert "top-level declarations:" in doc_model.seen_prompts[0]
