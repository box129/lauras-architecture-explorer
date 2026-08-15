"""Claim-level provenance API DTOs.

This module defines the Pydantic request/response contract for the
(experimental, currently unregistered — see api/routes/claims.py)
``GET /api/query-lenses/{lens_id}/claims`` endpoint, alongside DTOs for the
underlying provenance domain model in ``core.models.provenance``.

--------------------------------------------------------------------------
Endpoint contract: GET /api/query-lenses/{lens_id}/claims
--------------------------------------------------------------------------

Path parameters:
    lens_id (str, path, greedy ``{lens_id:path}`` like the sibling
        ``/query-lenses/{lens_id}/evidence`` and ``.../implementation``
        routes in api/routes/query.py): the id of a previously-generated
        Lens (see core.models.lens.Lens) to scope claims to.

Query parameters:
    run_id (str | None, optional): explicit analysis run id. Falls back to
        the ``X-Syntax-Tree-Run-Id`` header, then the store's active run,
        exactly per ``api/run_resolution.resolve_ready_run`` — this
        endpoint does not invent its own run-resolution policy.

Responses:
    200 LensClaimsResponse — the lens was found (even if it has zero
        claims; an empty ``claims`` list with ``total=0`` is a valid,
        non-error response meaning no ArchitecturalClaim data has been
        produced for this lens yet).
    404 — no analysis run resolves (see resolve_ready_run: no active run,
        unknown run_id) or the lens_id does not resolve to a known Lens.
    409 — analysis run exists but is not yet complete / has no snapshot
        (see resolve_ready_run).

Response shape (LensClaimsResponse below):
    {
      "analysis_run_id": "<run id>",
      "lens_id": "<lens id>",
      "claims": [
        {
          "id": "claim:<sha1[:24]>",
          "run_id": "<run id>",
          "statement": "AuthMiddleware enforces the auth boundary for /api routes",
          "epistemic_type": "observed" | "inferred",
          "support_status": "supported" | "insufficient_evidence" | "contradicted",
          "confidence": 0.0-1.0 | null,
          "producer": {
            "producer_type": "extractor" | "llm" | "manual",
            "name": "...",
            "version": "...",
            "produced_at": "<ISO8601>"
          },
          "evidence_chain": {
            "id": "evidence-chain:<sha1[:24]>",
            "run_id": "<run id>",
            "claim_id": "claim:<sha1[:24]>",
            "reasoning": "...",
            "hop_count": 2,
            "items": [
              {
                "kind": "source_span",
                "id": "evidence-span:<sha1[:24]>",
                "run_id": "<run id>",
                "producer": {...},
                "description": "...",
                "source_region_id": "region:...",
                "content_hash": "..."
              },
              {
                "kind": "relationship",
                "id": "evidence-rel:<sha1[:24]>",
                "run_id": "<run id>",
                "producer": {...},
                "description": "...",
                "relationship_kind": "calls",
                "from_symbol_id": "symbol:...",
                "to_symbol_id": "symbol:...",
                "source_region_id": "region:..." | null
              }
            ]
          },
          "proposition": {
            "kind": "direct_relation" | "reachability",
            "subject_entity_id": "...",
            "relation_kind": "contains" | "imports" | "calls" | "inherits",
            "object_entity_id": "...",
            "path_entity_ids": ["...", "..."]
          } | null,
          "subject_symbol_ids": ["symbol:..."],
          "related_lens_ids": ["<lens id>"],
          "created_at": "<ISO8601>"
        }
      ],
      "total": 1
    }

This mirrors the request-shape conventions already used across
api/dto/*.py (e.g. ArchitectureMapEvidenceResponse, GroundingValidationResponse):
a top-level envelope carrying analysis_run_id plus a list + total, and every
domain object DTO exposes ``from_domain``/``to_domain`` so routes stay thin.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from syntax_tree_refurbished.core.models.program_relation import ProgramRelationKind
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    ClaimEpistemicType,
    ClaimProposition,
    ClaimSupportStatus,
    EvidenceChain,
    EvidenceItem,
    ProducerInfo,
    ProducerType,
    PropositionKind,
    RelationshipEvidence,
    RelationshipKind,
    SourceSpanEvidence,
)


class ProducerInfoDTO(BaseModel):
    producer_type: ProducerType
    name: str = Field(min_length=1)
    version: str = ""
    produced_at: datetime

    def to_domain(self) -> ProducerInfo:
        return ProducerInfo(
            producer_type=self.producer_type,  # type: ignore[arg-type]
            name=self.name,
            version=self.version,
            produced_at=self.produced_at,
        )

    @classmethod
    def from_domain(cls, producer: ProducerInfo) -> "ProducerInfoDTO":
        return cls(
            producer_type=producer.producer_type,
            name=producer.name,
            version=producer.version,
            produced_at=producer.produced_at,
        )


class SourceSpanEvidenceDTO(BaseModel):
    kind: Literal["source_span"] = "source_span"
    id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    producer: ProducerInfoDTO
    description: str = ""
    source_region_id: str = Field(min_length=1)
    content_hash: str = Field(min_length=1)

    def to_domain(self) -> SourceSpanEvidence:
        return SourceSpanEvidence(
            id=self.id,
            run_id=self.run_id,
            kind="source_span",
            producer=self.producer.to_domain(),
            description=self.description,
            source_region_id=self.source_region_id,
            content_hash=self.content_hash,
        )

    @classmethod
    def from_domain(cls, evidence: SourceSpanEvidence) -> "SourceSpanEvidenceDTO":
        return cls(
            kind="source_span",
            id=evidence.id,
            run_id=evidence.run_id,
            producer=ProducerInfoDTO.from_domain(evidence.producer),
            description=evidence.description,
            source_region_id=evidence.source_region_id,
            content_hash=evidence.content_hash,
        )


class RelationshipEvidenceDTO(BaseModel):
    kind: Literal["relationship"] = "relationship"
    id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    producer: ProducerInfoDTO
    description: str = ""
    relationship_kind: RelationshipKind
    from_symbol_id: str = Field(min_length=1)
    to_symbol_id: str = Field(min_length=1)
    source_region_id: str | None = None

    def to_domain(self) -> RelationshipEvidence:
        return RelationshipEvidence(
            id=self.id,
            run_id=self.run_id,
            kind="relationship",
            producer=self.producer.to_domain(),
            description=self.description,
            relationship_kind=self.relationship_kind,  # type: ignore[arg-type]
            from_symbol_id=self.from_symbol_id,
            to_symbol_id=self.to_symbol_id,
            source_region_id=self.source_region_id,
        )

    @classmethod
    def from_domain(cls, evidence: RelationshipEvidence) -> "RelationshipEvidenceDTO":
        return cls(
            kind="relationship",
            id=evidence.id,
            run_id=evidence.run_id,
            producer=ProducerInfoDTO.from_domain(evidence.producer),
            description=evidence.description,
            relationship_kind=evidence.relationship_kind,
            from_symbol_id=evidence.from_symbol_id,
            to_symbol_id=evidence.to_symbol_id,
            source_region_id=evidence.source_region_id,
        )


EvidenceItemDTO = Annotated[
    Union[SourceSpanEvidenceDTO, RelationshipEvidenceDTO], Field(discriminator="kind")
]


def evidence_item_from_domain(item: EvidenceItem) -> "SourceSpanEvidenceDTO | RelationshipEvidenceDTO":
    if isinstance(item, SourceSpanEvidence):
        return SourceSpanEvidenceDTO.from_domain(item)
    if isinstance(item, RelationshipEvidence):
        return RelationshipEvidenceDTO.from_domain(item)
    raise TypeError(f"Unsupported EvidenceItem subtype: {type(item)!r}")


def evidence_item_to_domain(dto: "SourceSpanEvidenceDTO | RelationshipEvidenceDTO") -> EvidenceItem:
    return dto.to_domain()


class EvidenceChainDTO(BaseModel):
    id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    claim_id: str = Field(min_length=1)
    items: list[EvidenceItemDTO] = Field(default_factory=list)
    reasoning: str = ""
    hop_count: int = 0

    def to_domain(self) -> EvidenceChain:
        return EvidenceChain(
            id=self.id,
            run_id=self.run_id,
            claim_id=self.claim_id,
            items=tuple(evidence_item_to_domain(item) for item in self.items),
            reasoning=self.reasoning,
        )

    @classmethod
    def from_domain(cls, chain: EvidenceChain) -> "EvidenceChainDTO":
        return cls(
            id=chain.id,
            run_id=chain.run_id,
            claim_id=chain.claim_id,
            items=[evidence_item_from_domain(item) for item in chain.items],
            reasoning=chain.reasoning,
            hop_count=chain.hop_count,
        )


class ClaimPropositionDTO(BaseModel):
    """DTO for core.models.provenance.ClaimProposition -- the structured,
    machine-verifiable assertion a claim carries alongside its human-readable
    statement. See ClaimProposition's own docstring for the full semantics."""

    kind: PropositionKind
    subject_entity_id: str = Field(min_length=1)
    relation_kind: ProgramRelationKind
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
    def from_domain(cls, proposition: ClaimProposition) -> "ClaimPropositionDTO":
        return cls(
            kind=proposition.kind,
            subject_entity_id=proposition.subject_entity_id,
            relation_kind=proposition.relation_kind,
            object_entity_id=proposition.object_entity_id,
            path_entity_ids=list(proposition.path_entity_ids),
        )


class ArchitecturalClaimDTO(BaseModel):
    id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    statement: str = Field(min_length=1)
    epistemic_type: ClaimEpistemicType
    support_status: ClaimSupportStatus
    confidence: float | None = None
    producer: ProducerInfoDTO
    evidence_chain: EvidenceChainDTO
    proposition: ClaimPropositionDTO | None = None
    subject_symbol_ids: list[str] = Field(default_factory=list)
    related_lens_ids: list[str] = Field(default_factory=list)
    created_at: datetime

    def to_domain(self) -> ArchitecturalClaim:
        return ArchitecturalClaim(
            id=self.id,
            run_id=self.run_id,
            statement=self.statement,
            epistemic_type=self.epistemic_type,  # type: ignore[arg-type]
            support_status=self.support_status,  # type: ignore[arg-type]
            confidence=self.confidence,
            producer=self.producer.to_domain(),
            evidence_chain=self.evidence_chain.to_domain(),
            proposition=self.proposition.to_domain() if self.proposition is not None else None,
            subject_symbol_ids=tuple(self.subject_symbol_ids),
            related_lens_ids=tuple(self.related_lens_ids),
            created_at=self.created_at,
        )

    @classmethod
    def from_domain(cls, claim: ArchitecturalClaim) -> "ArchitecturalClaimDTO":
        return cls(
            id=claim.id,
            run_id=claim.run_id,
            statement=claim.statement,
            epistemic_type=claim.epistemic_type,
            support_status=claim.support_status,
            confidence=claim.confidence,
            producer=ProducerInfoDTO.from_domain(claim.producer),
            evidence_chain=EvidenceChainDTO.from_domain(claim.evidence_chain),
            proposition=(
                ClaimPropositionDTO.from_domain(claim.proposition)
                if claim.proposition is not None
                else None
            ),
            subject_symbol_ids=list(claim.subject_symbol_ids),
            related_lens_ids=list(claim.related_lens_ids),
            created_at=claim.created_at,
        )


class LensClaimsResponse(BaseModel):
    """Response body for ``GET /api/query-lenses/{lens_id}/claims``."""

    analysis_run_id: str
    lens_id: str
    claims: list[ArchitecturalClaimDTO] = Field(default_factory=list)
    total: int = 0
