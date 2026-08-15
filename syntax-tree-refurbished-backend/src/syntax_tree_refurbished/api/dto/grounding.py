"""Grounding API DTOs."""

from __future__ import annotations

from pydantic import BaseModel, Field

from syntax_tree_refurbished.core.models.grounding import (
    Citation,
    CitationValidation,
    Claim,
    GroundedClaim,
    GroundingResult,
)


class CitationDTO(BaseModel):
    kind: str
    ref_id: str | None = None
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    content_hash: str | None = None

    def to_domain(self) -> Citation:
        return Citation(
            kind=self.kind,  # type: ignore[arg-type]
            ref_id=self.ref_id,
            path=self.path,
            start_line=self.start_line,
            end_line=self.end_line,
            content_hash=self.content_hash,
        )

    @classmethod
    def from_domain(cls, citation: Citation) -> "CitationDTO":
        return cls(
            kind=citation.kind,
            ref_id=citation.ref_id,
            path=citation.path,
            start_line=citation.start_line,
            end_line=citation.end_line,
            content_hash=citation.content_hash,
        )


class ClaimDTO(BaseModel):
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    requested_status: str = "verified"
    citations: list[CitationDTO] = Field(default_factory=list)

    def to_domain(self) -> Claim:
        return Claim(
            id=self.id,
            text=self.text,
            requested_status=self.requested_status,  # type: ignore[arg-type]
            citations=tuple(citation.to_domain() for citation in self.citations),
        )

    @classmethod
    def from_domain(cls, claim: Claim) -> "ClaimDTO":
        return cls(
            id=claim.id,
            text=claim.text,
            requested_status=claim.requested_status,
            citations=[CitationDTO.from_domain(citation) for citation in claim.citations],
        )


class GroundingValidationRequest(BaseModel):
    run_id: str | None = None
    claims: list[ClaimDTO]


class CitationValidationDTO(BaseModel):
    citation: CitationDTO
    valid: bool
    support_status: str
    resolved_region_id: str | None
    reason: str

    @classmethod
    def from_domain(cls, validation: CitationValidation) -> "CitationValidationDTO":
        return cls(
            citation=CitationDTO.from_domain(validation.citation),
            valid=validation.valid,
            support_status=validation.support_status,
            resolved_region_id=validation.resolved_region_id,
            reason=validation.reason,
        )


class GroundedClaimDTO(BaseModel):
    claim: ClaimDTO
    support_status: str
    citations: list[CitationValidationDTO]
    failures: list[str]

    @classmethod
    def from_domain(cls, grounded: GroundedClaim) -> "GroundedClaimDTO":
        return cls(
            claim=ClaimDTO.from_domain(grounded.claim),
            support_status=grounded.support_status,
            citations=[CitationValidationDTO.from_domain(citation) for citation in grounded.citations],
            failures=list(grounded.failures),
        )


class GroundingValidationResponse(BaseModel):
    analysis_run_id: str
    claims: list[GroundedClaimDTO]
    verified_count: int
    downgraded_count: int
    failure_count: int

    @classmethod
    def from_domain(cls, result: GroundingResult) -> "GroundingValidationResponse":
        return cls(
            analysis_run_id=result.run_id,
            claims=[GroundedClaimDTO.from_domain(claim) for claim in result.claims],
            verified_count=result.verified_count,
            downgraded_count=result.downgraded_count,
            failure_count=result.failure_count,
        )

