"""Mapping functions: internal models → frontend QueryResponseDTO / QuestionLensDTO."""

from __future__ import annotations

import re
import uuid
from typing import Any

from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.core.models.grounding import GroundedClaim
from syntax_tree_refurbished.core.models.investigation import InvestigationResult
from syntax_tree_refurbished.core.models.lens import Lens
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent, SystemOverview


def lens_to_question_lens_dto(lens: Lens, store: InMemoryRunStore) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []
    for child in lens.child_components:
        step_evidence: list[dict[str, Any]] = []
        for region_id in child.source_region_ids:
            region = store.get_region(region_id)
            if region:
                step_evidence.append({
                    "id": f"evidence-{region.id}",
                    "analysis_run_id": lens.analysis_run_id,
                    "node_id": child.id,
                    "evidence_kind": "lens_child",
                    "source_ref_kind": "source_region",
                    "source_ref_id": region.id,
                    "file_path": region.path,
                    "language": _region_language(region),
                    "start_line": region.start_line,
                    "end_line": region.end_line,
                    "text_preview": _region_text(region)[:200],
                    "status": child.support_status,
                    "confidence": child.confidence,
                    "score": child.confidence,
                    "reason": child.summary or child.label,
                    "is_stale": False,
                })
        steps.append({
            "id": child.id,
            "label": child.label,
            "kind": child.kind,
            "summary": child.summary,
            "responsibilities": list(child.responsibilities),
            "source_region_ids": list(child.source_region_ids),
            "related_file_paths": list(child.related_file_paths),
            "support_status": child.support_status,
            "confidence": child.confidence,
            "evidence": step_evidence,
        })

    evidence: list[dict[str, Any]] = []
    for claim in lens.claims:
        for citation in claim.citations:
            if not citation.resolved_region_id:
                continue
            region = store.get_region(citation.resolved_region_id)
            if not region:
                continue
            evidence.append({
                "id": f"evidence-{claim.claim.id}",
                "analysis_run_id": lens.analysis_run_id,
                "node_id": lens.parent_node_id,
                "evidence_kind": "claim",
                "source_ref_kind": "source_region",
                "source_ref_id": region.id,
                "file_path": region.path,
                "language": _region_language(region),
                "start_line": region.start_line,
                "end_line": region.end_line,
                "text_preview": _region_text(region)[:200],
                "status": claim.support_status,
                    "confidence": _claim_confidence(claim),
                    "score": _claim_confidence(claim),
                "reason": claim.claim.text,
                "is_stale": False,
            })

    return {
        "id": lens.id,
        "title": lens.title,
        "summary": lens.summary,
        "simple_explanation": lens.simple_explanation,
        "technical_explanation": lens.technical_explanation,
        "steps": steps,
        "evidence": evidence,
        "status": _lens_dto_status(lens),
        "confidence": _avg_confidence(lens.child_components),
        "gaps": list(lens.gaps),
        "suggested_questions": list(lens.suggested_questions),
        "analysis_run_id": lens.analysis_run_id,
        "parent_node_id": lens.parent_node_id,
        "parent_component_id": lens.parent_component_id,
    }


def investigation_to_query_response(
    investigation: InvestigationResult,
    question: str,
    conversation_id: str | None,
    store: InMemoryRunStore,
) -> dict[str, Any]:
    visual_lenses: list[dict[str, Any]] = []
    for hypothesis in investigation.component_hypotheses:
        lens_id = hypothesis.get("id", "")
        if lens_id:
            cached = store.get_lens(investigation.run_id, lens_id)
            if cached:
                visual_lenses.append(lens_to_question_lens_dto(cached, store))

    citations: list[dict[str, Any]] = []
    for claim in investigation.claims:
        for citation in claim.citations:
            if citation.resolved_region_id:
                region = store.get_region(citation.resolved_region_id)
                if region:
                    citations.append({
                        "entity_qn": claim.claim.id,
                        "entity_name": claim.claim.text[:80],
                        "file_path": region.path,
                        "line_start": region.start_line,
                        "line_end": region.end_line,
                        "support_status": claim.support_status,
                    })

    evidence_count = sum(
        len(lens.get("evidence", [])) for lens in visual_lenses
    )
    source_tab_count = sum(
        len(lens.get("steps", [])) for lens in visual_lenses
    )

    return {
        "answer_text": investigation.answer.summary,
        "intent": "focused_investigation",
        "citations": citations,
        "confidence": _avg_claim_confidence(investigation.claims),
        "follow_ups": list(investigation.suggested_next_questions[:5]),
        "diagrams": [],
        "visual_lenses": visual_lenses,
        "lens_count": len(visual_lenses),
        "unsupported_reasons": _unsupported_reasons(visual_lenses),
        "evidence_coverage": {
            "lens_count": len(visual_lenses),
            "evidence_count": evidence_count,
            "source_tab_count": source_tab_count,
            "statuses": sorted({lens.get("status", "") for lens in visual_lenses if lens.get("status")}),
            "types": sorted({lens.get("kind", "") for lens in visual_lenses if lens.get("kind")}),
        },
        "conversation_id": conversation_id or str(uuid.uuid4()),
        "turn_number": 1,
        "run_metadata": {
            "llm_call_count": investigation.metrics.tool_calls,
            "tokens_in": investigation.metrics.tokens_in,
            "tokens_out": investigation.metrics.tokens_out,
            "fallback_used": not investigation.metrics.llm_used,
            "model": investigation.metrics.model,
            "files_inspected": [],
            "symbols_inspected": [],
            "evidence_sources": [],
            "unresolved_gaps": list(investigation.gaps),
        },
    }


def overview_to_query_response(
    overview: SystemOverview,
    question: str,
    matched_components: list[OverviewComponent],
    matched_claims: list[GroundedClaim],
    conversation_id: str | None,
    store: InMemoryRunStore,
) -> dict[str, Any]:
    answer_parts: list[str] = []
    if matched_components:
        answer_parts.append(
            "Based on the System Overview, the relevant architecture areas are: "
            + ", ".join(comp.label for comp in matched_components[:5])
            + "."
        )
    if matched_claims:
        claim_texts = [claim.claim.text for claim in matched_claims[:5]]
        answer_parts.append("Key findings: " + "; ".join(claim_texts))
    if not answer_parts:
        answer_parts.append(
            "The System Overview does not contain enough detail to answer this question. "
            "Try asking a more specific question about the codebase architecture."
        )

    citations: list[dict[str, Any]] = []
    for claim in matched_claims:
        for citation in claim.citations:
            if citation.resolved_region_id:
                region = store.get_region(citation.resolved_region_id)
                if region:
                    citations.append({
                        "entity_qn": claim.claim.id,
                        "entity_name": claim.claim.text[:80],
                        "file_path": region.path,
                        "line_start": region.start_line,
                        "line_end": region.end_line,
                        "support_status": claim.support_status,
                    })

    visual_lenses: list[dict[str, Any]] = []
    for component in matched_components[:5]:
        visual_lenses.append(_component_to_simple_lens(component, overview, store))

    return {
        "answer_text": " ".join(answer_parts),
        "intent": "overview_lookup",
        "citations": citations,
        "confidence": 0.55 if matched_claims else 0.35,
        "follow_ups": list(overview.suggested_questions[:5]),
        "diagrams": [],
        "visual_lenses": visual_lenses,
        "lens_count": len(visual_lenses),
        "unsupported_reasons": [],
        "evidence_coverage": {
            "lens_count": len(visual_lenses),
            "evidence_count": len(citations),
            "source_tab_count": len(visual_lenses),
            "statuses": ["verified"] if citations else [],
            "types": ["architecture_component"],
        },
        "conversation_id": conversation_id or str(uuid.uuid4()),
        "turn_number": 1,
        "run_metadata": {
            "llm_call_count": 0,
            "tokens_in": 0,
            "tokens_out": 0,
            "fallback_used": False,
            "model": "overview_cache",
            "files_inspected": [],
            "symbols_inspected": [],
            "evidence_sources": [],
            "unresolved_gaps": list(overview.gaps[:5]),
        },
    }


def _component_to_simple_lens(
    component: OverviewComponent,
    overview: SystemOverview,
    store: InMemoryRunStore,
) -> dict[str, Any]:
    evidence: list[dict[str, Any]] = []
    for region_id in component.source_region_ids:
        region = store.get_region(region_id)
        if region:
            evidence.append({
                "id": f"evidence-{region.id}",
                "analysis_run_id": overview.analysis_run_id,
                "node_id": component.id,
                "evidence_kind": "overview_component",
                "source_ref_kind": "source_region",
                "source_ref_id": region.id,
                "file_path": region.path,
                "language": _region_language(region),
                "start_line": region.start_line,
                "end_line": region.end_line,
                "text_preview": _region_text(region)[:200],
                "status": component.support_status,
                "confidence": component.confidence,
                "score": component.confidence,
                "reason": component.summary,
                "is_stale": False,
            })
    return {
        "id": component.id,
        "title": component.label,
        "summary": component.summary,
        "simple_explanation": component.summary,
        "technical_explanation": component.summary,
        "steps": [],
        "evidence": evidence,
        "status": "verified" if evidence else "insufficient",
        "confidence": component.confidence,
        "gaps": [],
        "suggested_questions": list(overview.suggested_questions[:3]),
        "analysis_run_id": overview.analysis_run_id,
        "parent_node_id": overview.analysis_run_id,
        "parent_component_id": component.id,
    }


def _lens_dto_status(lens: Lens) -> str:
    if lens.status == "ready":
        return "verified"
    if lens.status in ("partial", "degraded_no_llm"):
        return "insufficient"
    if lens.status == "failed":
        return "unsupported"
    return "insufficient"


def _avg_confidence(children: tuple) -> float | None:
    if not children:
        return None
    confidences = [c.confidence for c in children if c.confidence is not None]
    return sum(confidences) / len(confidences) if confidences else None


def _avg_claim_confidence(claims: tuple[GroundedClaim, ...]) -> float:
    if not claims:
        return 0.0
    return sum(_claim_confidence(claim) for claim in claims) / len(claims)


def _claim_confidence(claim: GroundedClaim) -> float:
    if claim.support_status == "verified":
        return 1.0
    if claim.support_status in ("inferred", "orientation_only"):
        return 0.65
    if claim.support_status == "uncertain":
        return 0.35
    return 0.0


def _unsupported_reasons(lenses: list[dict[str, Any]]) -> list[str]:
    reasons: list[str] = []
    for lens in lenses:
        if lens.get("status") == "unsupported":
            reasons.append(lens.get("title", "unknown"))
    return reasons


def classify_intent(question: str) -> str:
    q = question.lower()
    if any(kw in q for kw in ("where", "find", "locate", "show me", "search for")):
        return "navigational"
    if any(kw in q for kw in ("how does", "what does", "explain", "describe", "tell me about", "walk me through", "how is", "what is")):
        return "explanatory"
    if any(kw in q for kw in ("what breaks", "what happens if", "depends on", "blast radius", "if i change", "if i remove", "affected by")):
        return "impact"
    if any(kw in q for kw in ("architecture", "architectural", "boundary", "component", "subsystem", "design pattern", "layers", "structure", "violations", "circular", "coupling")):
        return "architectural"
    if any(kw in q for kw in ("compare", "difference", "differ", "vs", "versus", "similarities", "contrast")):
        return "comparative"
    if any(kw in q for kw in ("most complex", "most coupled", "hotspot", "worst", "biggest", "smallest", "most connected")):
        return "diagnostic"
    if any(kw in q for kw in ("how would i", "how should i", "best way to", "how to add", "how to refactor", "recommend", "suggest")):
        return "generative"
    if any(kw in q for kw in ("list all", "show all", "how many", "enumerate", "count", "all endpoints", "all functions", "all classes")):
        return "inventory"
    return "explanatory"


def build_implementation_slice_from_lens(
    lens: Lens,
    store: InMemoryRunStore,
    analysis_run_id: str,
) -> dict[str, Any]:
    region_ids: list[str] = []
    for claim in lens.claims:
        for citation in claim.citations:
            if citation.resolved_region_id:
                region_ids.append(citation.resolved_region_id)
    for child in lens.child_components:
        region_ids.extend(child.source_region_ids)

    regions: list[Any] = []
    seen: set[str] = set()
    for region_id in region_ids:
        if region_id in seen:
            continue
        seen.add(region_id)
        region = store.get_region(region_id)
        if region:
            regions.append(region)

    if not regions:
        return {
            "analysis_run_id": analysis_run_id,
            "node_id": lens.id,
            "status": "insufficient",
            "subject": {"type": "query_lens", "id": lens.id},
            "title": lens.title,
            "summary": "No source regions available for this lens.",
            "primary_span_id": "",
            "evidence_strength": 0.0,
            "tabs": [],
            "gaps": ["no_source_regions"],
            "unsupported_reason": "no_source_regions",
            "warnings": [],
        }

    by_file: dict[str, list[Any]] = {}
    for region in regions:
        by_file.setdefault(region.path, []).append(region)

    tabs: list[dict[str, Any]] = []
    for index, (path, file_regions) in enumerate(list(by_file.items())[:5]):
        role = "primary" if index == 0 else "supporting"
        highlights: list[dict[str, Any]] = []
        for region in file_regions[:20]:
            highlights.append({
                "span_id": region.id,
                "start_line": region.start_line,
                "end_line": region.end_line,
                "status": "verified",
                "confidence": 1.0,
            })
        tabs.append({
            "file_path": path,
            "language": _region_language(region),
            "role": role,
            "summary": f"{len(file_regions)} highlighted source region(s).",
            "reason": "Exact source evidence from question investigation.",
            "source_span_ids": [region.id for region in file_regions[:20]],
            "highlights": highlights,
            "is_stale": False,
        })

    primary_span_id = tabs[0]["source_span_ids"][0] if tabs and tabs[0]["source_span_ids"] else ""
    return {
        "analysis_run_id": analysis_run_id,
        "node_id": lens.id,
        "status": "verified" if primary_span_id else "insufficient",
        "subject": {"type": "query_lens", "id": lens.id},
        "title": lens.title,
        "summary": lens.summary,
        "primary_span_id": primary_span_id,
        "evidence_strength": 1.0 if primary_span_id else 0.5,
        "tabs": tabs,
        "gaps": list(lens.gaps),
        "unsupported_reason": "",
        "warnings": [],
    }


def _tokenize(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-zA-Z0-9]+", text.lower()) if len(t) >= 3]


def _region_language(region: Any) -> str:
    language = getattr(region, "language", None)
    if isinstance(language, str):
        return language
    path = getattr(region, "path", "")
    suffix = str(path).rsplit(".", 1)[-1].lower() if "." in str(path) else ""
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


def _region_text(region: Any) -> str:
    text = getattr(region, "content", None)
    if isinstance(text, str):
        return text
    text = getattr(region, "text", None)
    return text if isinstance(text, str) else ""
