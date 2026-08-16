"""DTOs for ``POST /api/docs/components/{component_id}/generate``.

Response contract for the Doc Studio's evidence-grounded LLM
documentation generation (see
``app.docs.component_doc_generator`` for the generation semantics):

- ``ai_generated=True``: ``purpose``/``responsibilities``/
  ``relationship_notes`` are LLM-written interpretive prose and MUST be
  presented under an explicit AI-generated label by any consumer.
  ``claims`` are the deterministically verified ``ArchitecturalClaim``s
  the prose was grounded against -- their ``support_status`` comes from
  the verifier alone and remains authoritative over anything the prose
  says. Every ``relationship_notes[].claim_id`` references an entry in
  ``claims`` (invalid ids were already discarded server-side and counted
  in ``discarded_relationship_notes``).
- ``ai_generated=False`` + ``unavailable_reason="not_configured"``: no
  AI is configured/enabled. No generated content is fabricated -- the
  prose fields stay empty and the deterministic Doc Studio surfaces
  (``GET /docs/components/{id}``) remain the only documentation.
- A configured-but-failing provider is NOT represented in this body: the
  route raises 503 with ``code="documentation_generation_unavailable"``
  instead, mirroring the architectural-explanation route's contract.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from syntax_tree_refurbished.api.dto.provenance import ArchitecturalClaimDTO


class DocGenerationRunMetadata(BaseModel):
    provider: str = ""
    model: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0


class RelationshipNoteDTO(BaseModel):
    claim_id: str = Field(min_length=1)
    note: str = Field(min_length=1)


class ComponentDocGenerationResponse(BaseModel):
    analysis_run_id: str
    component_id: str
    ai_generated: bool
    unavailable_reason: Literal["not_configured"] | None = None
    message: str = ""
    purpose: str = ""
    responsibilities: list[str] = Field(default_factory=list)
    relationship_notes: list[RelationshipNoteDTO] = Field(default_factory=list)
    discarded_relationship_notes: int = 0
    claims: list[ArchitecturalClaimDTO] = Field(default_factory=list)
    supported_count: int = 0
    insufficient_evidence_count: int = 0
    run_metadata: DocGenerationRunMetadata = Field(default_factory=DocGenerationRunMetadata)
