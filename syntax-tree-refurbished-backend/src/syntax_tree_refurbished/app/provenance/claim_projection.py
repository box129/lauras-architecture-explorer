"""Project existing GroundedClaim data (already produced by the
lens/investigation pipeline) into the claim-level provenance shapes defined
in core.models.provenance.

This is a *reshaping* step, not an analyzer: it does not discover new
architectural claims, run any new extraction, or call an LLM. It only reads
citation-validation results a lens already carries (core.models.lens.Lens
.claims, itself GroundedClaim from core.models.grounding) and the
SourceRegion each resolved citation points at, and repackages them as
ArchitecturalClaim / EvidenceChain / SourceSpanEvidence records with
deterministic ids.

Used by the experimental GET /api/query-lenses/{lens_id}/claims route stub
(api/routes/claims.py) to demonstrate the contract end-to-end against real
data without requiring a new architecture-recovery analyzer.
"""

from __future__ import annotations

from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.core.models.grounding import GroundedClaim
from syntax_tree_refurbished.core.models.provenance import (
    ArchitecturalClaim,
    ClaimEpistemicType,
    ClaimSupportStatus,
    ProducerInfo,
    SourceSpanEvidence,
)


PROJECTION_PRODUCER = ProducerInfo(
    producer_type="extractor",
    name="provenance.claim_projection",
    version="v1",
)
"""Producer metadata stamped on claims/evidence built by this module. Marks
them as a *reshaping* of pre-existing grounding data, not a fresh
observation — the original GroundedClaim's own citations remain the source
of truth for what was actually inspected."""


_SUPPORT_STATUS_MAP: dict[str, ClaimSupportStatus] = {
    "verified": "supported",
    "inferred": "supported",
    "orientation_only": "insufficient_evidence",
    "uncertain": "insufficient_evidence",
    "unsupported": "insufficient_evidence",
    "not_inspected": "insufficient_evidence",
}
"""Maps core.models.grounding.SupportStatus (a per-citation-chain grounding
verdict) onto ClaimSupportStatus (an aggregate claim-chain verdict). No
SupportStatus value maps to "contradicted": detecting an actual
contradiction is a verification capability this projection does not have
(the existing grounding validator only ever downgrades to unsupported for
lack of evidence, it does not flag inconsistency) — so this projection
never claims a contradiction it hasn't actually found."""


def architectural_claim_from_grounded_claim(
    grounded: GroundedClaim,
    *,
    run_id: str,
    store: InMemoryRunStore,
    lens_id: str,
) -> ArchitecturalClaim:
    """Build one ArchitecturalClaim from one GroundedClaim.

    Evidence: every citation whose validation resolved to a SourceRegion
    (citation.resolved_region_id) becomes one SourceSpanEvidence item, in
    the same order as grounded.citations. Citations that failed to resolve
    contribute no evidence item (their failure is already reflected in
    grounded.support_status / grounded.failures upstream).

    epistemic_type: "observed" only for a single-citation claim that was
    fully "verified"; anything requiring more than one piece of evidence,
    or resolved with any lower-confidence status, is "inferred" — matching
    EvidenceChain's own multi-hop-implies-inferred framing.

    support_status: mapped via _SUPPORT_STATUS_MAP, with one additional
    invariant enforced regardless of the upstream status: a claim backed by
    zero evidence items can never be "supported" (an empty evidence chain
    is definitionally insufficient).
    """
    evidence_items: list[SourceSpanEvidence] = []
    for citation in grounded.citations:
        if not citation.resolved_region_id:
            continue
        region = store.get_region(citation.resolved_region_id)
        if region is None:
            continue
        evidence_items.append(
            SourceSpanEvidence.create(
                run_id=run_id,
                source_region_id=region.id,
                content_hash=region.content_hash,
                description=citation.reason or grounded.claim.text,
                producer=PROJECTION_PRODUCER,
            )
        )

    mapped_status = _SUPPORT_STATUS_MAP.get(grounded.support_status, "insufficient_evidence")
    if not evidence_items:
        mapped_status = "insufficient_evidence"

    epistemic_type: ClaimEpistemicType = (
        "observed"
        if grounded.support_status == "verified" and len(evidence_items) == 1
        else "inferred"
    )

    return ArchitecturalClaim.create(
        run_id=run_id,
        statement=grounded.claim.text,
        epistemic_type=epistemic_type,
        support_status=mapped_status,
        confidence=None,
        producer=PROJECTION_PRODUCER,
        evidence_items=tuple(evidence_items),
        related_lens_ids=(lens_id,),
        reasoning="; ".join(grounded.failures) if grounded.failures else "",
    )


def architectural_claims_for_lens(
    grounded_claims: tuple[GroundedClaim, ...],
    *,
    run_id: str,
    store: InMemoryRunStore,
    lens_id: str,
) -> tuple[ArchitecturalClaim, ...]:
    return tuple(
        architectural_claim_from_grounded_claim(
            grounded, run_id=run_id, store=store, lens_id=lens_id
        )
        for grounded in grounded_claims
    )
