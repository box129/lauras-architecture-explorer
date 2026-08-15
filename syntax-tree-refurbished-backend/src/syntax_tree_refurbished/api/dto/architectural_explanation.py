"""V2 vertical-slice API DTOs: architectural explanations built from
LLM-proposed, deterministically-verified structural claims.

Reuses ``ArchitecturalClaimDTO``/``ClaimPropositionDTO``/``ProducerInfoDTO``
(``api.dto.provenance``) as-is for the "verified claim" shape -- see
``core.models.architectural_explanation``'s module docstring, "Why no new
VerifiedArchitecturalClaim type", for why no parallel DTO is introduced
for that.

--------------------------------------------------------------------------
Planned endpoint contract: POST /api/entities/{entity_id}/architectural-explanation
--------------------------------------------------------------------------
NOT YET REGISTERED (Phase 1 defines the contract only -- L2/api/routes/
architectural_explanation.py implements and registers it, following the
exact same "write the router, document it, register it only after
review" posture already established by api/routes/claims.py).

Path parameters:
    entity_id (str, path, greedy ``{entity_id:path}`` -- real symbol ids
        can contain ``:`` and other characters the plain-string path
        converter would mis-split, matching the ``{lens_id:path}``
        convention already used by api/routes/query.py and
        api/routes/claims.py): the id of a real ParsedSymbol produced by
        the target analysis run.

Query parameters:
    run_id (str | None, optional): same resolution policy as every other
        route in this codebase -- explicit query param, else
        ``X-Syntax-Tree-Run-Id`` header, else the store's active run
        (``api.run_resolution.resolve_ready_run``).

Request body: ArchitecturalExplanationRequest (below) -- empty/default is
    valid (no required fields); present so future options (e.g. hop-limit
    tuning, forcing regeneration) have a documented home without a
    breaking change.

Responses:
    200 ArchitecturalExplanationResponse.
    404 -- entity_id does not resolve to a real ParsedSymbol in the
        resolved run.
    409 -- analysis run exists but is not yet complete (resolve_ready_run).
    503 -- no active run.

Response shape (ArchitecturalExplanationResponse below):
    {
      "analysis_run_id": "<run id>",
      "target_kind": "entity",
      "target_id": "symbol:...",
      "explanation_id": "explanation:<sha1[:24]>",
      "narrative": "...",
      "claims": [ <ArchitecturalClaimDTO, exactly api/dto/provenance.py's shape> ],
      "supported_count": 2,
      "insufficient_evidence_count": 1,
      "producer": { "producer_type": "llm", "name": "...", "version": "...", "produced_at": "..." },
      "created_at": "<ISO8601>"
    }

This mirrors the existing envelope convention (analysis_run_id at the top
level, a typed list + a total/count breakdown) already used by
``LensClaimsResponse``/``GroundingValidationResponse``.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from syntax_tree_refurbished.api.dto.provenance import ArchitecturalClaimDTO, ProducerInfoDTO
from syntax_tree_refurbished.core.models.architectural_explanation import (
    ArchitecturalExplanation,
    ClaimProposal,
    ExplanationTargetKind,
)
from syntax_tree_refurbished.core.models.provenance import ClaimProposition


class ClaimPropositionRequestDTO(BaseModel):
    """Bare proposition shape, for round-tripping a ClaimProposal over the
    wire if a caller ever needs to (e.g. a debug/test endpoint) --
    intentionally identical field-for-field to
    ``api.dto.provenance.ClaimPropositionDTO``; kept as a separate class
    here rather than imported, since this slice's proposal-side contract
    and the existing lens-claims contract are allowed to diverge
    independently later without one accidentally constraining the other."""

    kind: str
    subject_entity_id: str = Field(min_length=1)
    relation_kind: str
    object_entity_id: str = Field(min_length=1)
    path_entity_ids: list[str] = Field(default_factory=list)

    def to_domain(self) -> ClaimProposition:
        return ClaimProposition(
            kind=self.kind,  # type: ignore[arg-type]
            subject_entity_id=self.subject_entity_id,
            relation_kind=self.relation_kind,  # type: ignore[arg-type]
            object_entity_id=self.object_entity_id,
            path_entity_ids=tuple(self.path_entity_ids),
        )

    @classmethod
    def from_domain(cls, proposition: ClaimProposition) -> "ClaimPropositionRequestDTO":
        return cls(
            kind=proposition.kind,
            subject_entity_id=proposition.subject_entity_id,
            relation_kind=proposition.relation_kind,
            object_entity_id=proposition.object_entity_id,
            path_entity_ids=list(proposition.path_entity_ids),
        )


class ClaimProposalDTO(BaseModel):
    """DTO for ``core.models.architectural_explanation.ClaimProposal`` --
    an LLM's PRE-VERIFICATION proposal. Never carries a support status
    (there is no field for one -- structurally impossible to smuggle
    authoritative-looking support through this DTO)."""

    proposition: ClaimPropositionRequestDTO
    proposed_statement: str | None = None
    producer: ProducerInfoDTO

    def to_domain(self) -> ClaimProposal:
        return ClaimProposal(
            proposition=self.proposition.to_domain(),
            proposed_statement=self.proposed_statement,
            producer=self.producer.to_domain(),
        )

    @classmethod
    def from_domain(cls, proposal: ClaimProposal) -> "ClaimProposalDTO":
        return cls(
            proposition=ClaimPropositionRequestDTO.from_domain(proposal.proposition),
            proposed_statement=proposal.proposed_statement,
            producer=ProducerInfoDTO.from_domain(proposal.producer),
        )


class ArchitecturalExplanationRequest(BaseModel):
    """Request body for ``POST /api/entities/{entity_id}/architectural-explanation``.
    Every field optional/defaulted -- see module docstring."""

    run_id: str | None = None


class ArchitecturalExplanationResponse(BaseModel):
    """Response body for ``POST /api/entities/{entity_id}/architectural-explanation``.
    ``claims`` reuses ``ArchitecturalClaimDTO`` verbatim -- see module
    docstring's "Why no new VerifiedArchitecturalClaim type"."""

    analysis_run_id: str
    target_kind: ExplanationTargetKind
    target_id: str
    explanation_id: str
    narrative: str
    claims: list[ArchitecturalClaimDTO] = Field(default_factory=list)
    supported_count: int = 0
    insufficient_evidence_count: int = 0
    producer: ProducerInfoDTO
    created_at: datetime

    @classmethod
    def from_domain(cls, explanation: ArchitecturalExplanation) -> "ArchitecturalExplanationResponse":
        from syntax_tree_refurbished.api.dto.provenance import ArchitecturalClaimDTO as _ClaimDTO

        return cls(
            analysis_run_id=explanation.run_id,
            target_kind=explanation.target_kind,
            target_id=explanation.target_id,
            explanation_id=explanation.id,
            narrative=explanation.narrative,
            claims=[_ClaimDTO.from_domain(c) for c in explanation.claims],
            supported_count=len(explanation.supported_claims),
            insufficient_evidence_count=len(explanation.insufficient_evidence_claims),
            producer=ProducerInfoDTO.from_domain(explanation.producer),
            created_at=explanation.created_at,
        )


# ---------------------------------------------------------------------------
# L2 (verification service) response contract -- narrower than the FULL
# explanation contract above: verified claims only, no narrative. See
# api/routes/architectural_explanation.py (``POST
# /api/entities/{entity_id:path}/claims``) for the endpoint that returns
# this. Additive alongside ArchitecturalExplanationResponse/ClaimProposalDTO
# above -- those remain L3/integration's contract, unchanged.
# ---------------------------------------------------------------------------


class EntityClaimsResponse(BaseModel):
    """Response body for ``POST /api/entities/{entity_id:path}/claims``
    (api/routes/architectural_explanation.py). Reuses
    ``ArchitecturalClaimDTO`` verbatim, exactly like
    ``ArchitecturalExplanationResponse``/``LensClaimsResponse`` do -- see
    ``core.models.architectural_explanation``'s module docstring, "Why no
    new VerifiedArchitecturalClaim type"."""

    analysis_run_id: str
    target_id: str
    claims: list[ArchitecturalClaimDTO] = Field(default_factory=list)
    supported_count: int = 0
    insufficient_evidence_count: int = 0
