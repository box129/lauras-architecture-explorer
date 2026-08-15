"""Docs adapter — maps SystemOverview + Lens models to frontend DTOs."""

from __future__ import annotations

from typing import Any

from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.core.models.lens import Lens
from syntax_tree_refurbished.core.models.system_overview import SystemOverview


def build_evidence_summary(overview: SystemOverview) -> dict[str, int]:
    return {
        "architecture_entities": len(overview.main_components),
        "code_entities": len(overview.claims),
        "files": len(overview.important_files),
        "dependencies": len(overview.relationships),
    }


def format_components_text(overview: SystemOverview) -> str:
    if not overview.main_components:
        return "(no components in overview)"
    lines: list[str] = []
    for comp in overview.main_components:
        lines.append(f"- {comp.label} [{comp.kind}]: {comp.summary}")
        if comp.responsibilities:
            for resp in comp.responsibilities[:3]:
                lines.append(f"  - {resp}")
    return "\n".join(lines)


def format_claims_text(overview: SystemOverview) -> str:
    if not overview.claims:
        return "(no claims in overview)"
    lines: list[str] = []
    for claim in overview.claims[:15]:
        lines.append(f"- [{claim.support_status}] {claim.claim.text}")
    return "\n".join(lines)


def format_gaps_text(overview: SystemOverview) -> str:
    if not overview.gaps:
        return "(no known gaps)"
    return "\n".join(f"- {g}" for g in overview.gaps)


def format_lens_summaries(lenses: list[Lens]) -> str:
    if not lenses:
        return "(no selected lenses)"
    lines: list[str] = []
    for lens in lenses:
        lines.append(f"## {lens.title}")
        lines.append(f"Summary: {lens.summary}")
        if lens.child_components:
            lines.append("Child components:")
            for child in lens.child_components[:5]:
                lines.append(f"  - {child.label}: {child.summary}")
        if lens.claims:
            lines.append("Key claims:")
            for claim in lens.claims[:5]:
                lines.append(f"  - [{claim.support_status}] {claim.claim.text}")
        lines.append("")
    return "\n".join(lines)


def format_source_evidence(
    overview: SystemOverview,
    lenses: list[Lens],
    store: InMemoryRunStore,
) -> str:
    parts: list[str] = []
    seen: set[str] = set()

    for region_dict in overview.important_regions:
        region_id = str(region_dict.get("id", ""))
        if region_id and region_id not in seen:
            seen.add(region_id)
            region = store.get_region(region_id)
            if region:
                parts.append(
                    f"### {region.path}:{region.start_line}-{region.end_line}\n"
                    f"```{_region_language(region)}\n{_region_text(region)[:800]}\n```"
                )

    for lens in lenses:
        for claim in lens.claims:
            for citation in claim.citations:
                if citation.resolved_region_id and citation.resolved_region_id not in seen:
                    seen.add(citation.resolved_region_id)
                    region = store.get_region(citation.resolved_region_id)
                    if region:
                        parts.append(
                            f"### {region.path}:{region.start_line}-{region.end_line}\n"
                            f"```{_region_language(region)}\n{_region_text(region)[:800]}\n```"
                        )

    if not parts:
        return "(no source evidence available)"

    return "\n\n".join(parts[:10])


def _region_language(region) -> str:
    language = getattr(region, "language", None)
    if isinstance(language, str):
        return language
    path = str(getattr(region, "path", ""))
    suffix = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        "py": "python",
        "js": "javascript",
        "jsx": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "md": "markdown",
        "json": "json",
        "yml": "yaml",
        "yaml": "yaml",
    }.get(suffix, "")


def _region_text(region) -> str:
    text = getattr(region, "content", None)
    if isinstance(text, str):
        return text
    text = getattr(region, "text", None)
    return text if isinstance(text, str) else ""


def build_plan_response(
    *,
    plan_id: str,
    title: str,
    artifact_type: str,
    scope_qn: str,
    user_request: str,
    max_words: int,
    outline: list[str],
    assumptions: list[str],
    evidence_targets: list[str],
    risks: list[str],
    intended_claims: list[str],
    questions: list[str],
    resolved_references: list[dict[str, Any]],
    evidence_summary: dict[str, int],
    planning_fallback_used: bool = False,
    planning_model: str = "",
    planning_errors: list[str] | None = None,
    unsupported_requested_terms: list[str] | None = None,
    run_metadata: dict[str, Any] | None = None,
    source_span_ids: list[str] | None = None,
    question_lens_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "plan_id": plan_id,
        "title": title,
        "artifact_type": artifact_type,
        "scope_qn": scope_qn,
        "user_request": user_request,
        "max_words": max_words,
        "outline": outline,
        "assumptions": assumptions,
        "evidence_targets": evidence_targets,
        "resolved_references": resolved_references,
        "risks": risks,
        "intended_claims": intended_claims,
        "questions": questions,
        "planning_fallback_used": planning_fallback_used,
        "planning_model": planning_model,
        "planning_errors": planning_errors or [],
        "unsupported_requested_terms": unsupported_requested_terms or [],
        "run_metadata": run_metadata or {},
        "evidence_summary": evidence_summary,
        "source_evidence_summary": {},
        "source_span_ids": source_span_ids or [],
        "retrieval_warnings": [],
        "evidence_available": bool(source_span_ids),
        "question_lens_summary": question_lens_summary or {},
    }


def build_generate_response(
    *,
    generated: bool,
    message: str,
    qualified_name: str,
    artifact_type: str,
    generation_mode: str = "on_demand",
    run_metadata: dict[str, Any] | None = None,
    unsupported_claims: list[str] | None = None,
) -> dict[str, Any]:
    meta = run_metadata or {}
    if unsupported_claims:
        meta = {**meta, "unsupported_claims": unsupported_claims}
    return {
        "generated": generated,
        "message": message,
        "qualified_name": qualified_name,
        "artifact_type": artifact_type,
        "generation_mode": generation_mode,
        "run_metadata": meta,
    }
