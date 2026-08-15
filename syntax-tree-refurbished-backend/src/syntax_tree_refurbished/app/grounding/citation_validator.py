"""Validate LLM/source citations against the run's actual indexed artifacts."""

from __future__ import annotations

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.core.models.grounding import (
    Citation,
    CitationValidation,
    Claim,
    GroundedClaim,
    GroundingResult,
    SupportStatus,
)
from syntax_tree_refurbished.core.models.source_region import SourceRegion


class GroundingError(ValueError):
    pass


class CitationValidator:
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore):
        if not job.snapshot:
            raise GroundingError("Repo snapshot is not ready.")
        self._job = job
        self._store = store
        self._reader = SourceReader(job)

    def validate_claims(self, claims: tuple[Claim, ...]) -> GroundingResult:
        grounded = tuple(self._validate_claim(claim) for claim in claims)
        return GroundingResult(
            run_id=self._job.run_id,
            claims=grounded,
            verified_count=sum(1 for claim in grounded if claim.support_status == "verified"),
            downgraded_count=sum(
                1 for claim in grounded if claim.support_status != claim.claim.requested_status
            ),
            failure_count=sum(len(claim.failures) for claim in grounded),
        )

    def _validate_claim(self, claim: Claim) -> GroundedClaim:
        validations = tuple(self._validate_citation(citation) for citation in claim.citations)
        failures = tuple(validation.reason for validation in validations if not validation.valid)
        support = _claim_support(claim, validations)
        return GroundedClaim(
            claim=claim,
            support_status=support,
            citations=validations,
            failures=failures,
        )

    def _validate_citation(self, citation: Citation) -> CitationValidation:
        if citation.kind == "source_region":
            return self._validate_source_region(citation)
        if citation.kind == "semantic_anchor":
            return self._validate_semantic_anchor(citation)
        if citation.kind == "parsed_symbol":
            return self._validate_parsed_symbol(citation)
        if citation.kind == "orientation_item":
            return self._validate_orientation_item(citation)
        if citation.kind == "file_range":
            return self._validate_file_range(citation)
        return CitationValidation(
            citation=citation,
            valid=False,
            support_status="unsupported",
            resolved_region_id=None,
            reason=f"Unsupported citation kind: {citation.kind}",
        )

    def _validate_source_region(self, citation: Citation) -> CitationValidation:
        if not citation.ref_id:
            return _invalid(citation, "source_region citation requires ref_id.")
        region = self._store.get_region(citation.ref_id)
        if not region:
            return _invalid(citation, "Source region was not inspected or does not exist.")
        if region.run_id != self._job.run_id:
            return _invalid(citation, "Source region belongs to another run.")
        return self._validate_region_bounds_and_hash(citation, region, "Source region citation is valid.")

    def _validate_semantic_anchor(self, citation: Citation) -> CitationValidation:
        if not citation.ref_id:
            return _invalid(citation, "semantic_anchor citation requires ref_id.")
        anchor = next(
            (item for item in self._store.get_anchors(self._job.run_id) if item.id == citation.ref_id),
            None,
        )
        if not anchor:
            return _invalid(citation, "Semantic anchor does not exist for this run.")
        region = self._store.get_region(anchor.source_region_id)
        if not region:
            return _invalid(citation, "Semantic anchor source region is missing.")
        return CitationValidation(
            citation=citation,
            valid=True,
            support_status="verified",
            resolved_region_id=region.id,
            reason="Semantic anchor resolves to source code.",
        )

    def _validate_parsed_symbol(self, citation: Citation) -> CitationValidation:
        if not citation.ref_id:
            return _invalid(citation, "parsed_symbol citation requires ref_id.")
        symbol = self._store.get_symbol(citation.ref_id)
        if not symbol or symbol.run_id != self._job.run_id:
            return _invalid(citation, "Parsed symbol does not exist for this run.")
        try:
            region = self._reader.read_range(symbol.path, symbol.start_line, symbol.end_line)
        except SourceReadError as exc:
            return _invalid(citation, f"Parsed symbol source is unreadable: {exc}")
        self._store.put_region(region)
        return CitationValidation(
            citation=citation,
            valid=True,
            support_status="verified",
            resolved_region_id=region.id,
            reason="Parsed symbol resolves to source code.",
        )

    def _validate_orientation_item(self, citation: Citation) -> CitationValidation:
        if not citation.ref_id:
            return _invalid(citation, "orientation_item citation requires ref_id.")
        item = next(
            (item for item in self._store.get_orientation_items(self._job.run_id) if item.id == citation.ref_id),
            None,
        )
        if not item:
            return _invalid(citation, "Orientation item does not exist for this run.")
        return CitationValidation(
            citation=citation,
            valid=True,
            support_status="orientation_only",
            resolved_region_id=None,
            reason="Orientation material is guidance-only and cannot verify runtime behavior.",
        )

    def _validate_file_range(self, citation: Citation) -> CitationValidation:
        if not citation.path or citation.start_line is None or citation.end_line is None:
            return _invalid(citation, "file_range citation requires path, start_line, and end_line.")
        try:
            region = self._reader.read_range(citation.path, citation.start_line, citation.end_line)
        except SourceReadError as exc:
            return _invalid(citation, str(exc))
        self._store.put_region(region)
        return self._validate_region_bounds_and_hash(citation, region, "File range resolves to source code.")

    def _validate_region_bounds_and_hash(
        self,
        citation: Citation,
        region: SourceRegion,
        success_reason: str,
    ) -> CitationValidation:
        if citation.path and citation.path != region.path:
            return _invalid(citation, "Citation path does not match resolved source region.")
        if citation.start_line is not None and citation.start_line < region.start_line:
            return _invalid(citation, "Citation start_line is outside resolved source region.")
        if citation.end_line is not None and citation.end_line > region.end_line:
            return _invalid(citation, "Citation end_line is outside resolved source region.")
        if citation.start_line is not None and citation.end_line is not None and citation.end_line < citation.start_line:
            return _invalid(citation, "Citation end_line must be >= start_line.")
        if citation.content_hash and citation.content_hash != region.content_hash:
            return CitationValidation(
                citation=citation,
                valid=False,
                support_status="unsupported",
                resolved_region_id=region.id,
                reason="Citation content hash does not match current snapshot.",
            )
        return CitationValidation(
            citation=citation,
            valid=True,
            support_status="verified",
            resolved_region_id=region.id,
            reason=success_reason,
        )


def _claim_support(claim: Claim, validations: tuple[CitationValidation, ...]) -> SupportStatus:
    if not validations:
        return "not_inspected"
    if any(not validation.valid for validation in validations):
        if any(validation.valid and validation.support_status == "verified" for validation in validations):
            return "uncertain"
        if any(validation.valid and validation.support_status == "orientation_only" for validation in validations):
            return "orientation_only"
        return "unsupported"
    if any(validation.support_status == "verified" for validation in validations):
        return "verified"
    if any(validation.support_status == "orientation_only" for validation in validations):
        return "orientation_only"
    return claim.requested_status if claim.requested_status != "verified" else "uncertain"


def _invalid(citation: Citation, reason: str) -> CitationValidation:
    return CitationValidation(
        citation=citation,
        valid=False,
        support_status="unsupported",
        resolved_region_id=None,
        reason=reason,
    )

