"""Docs controller — orchestrates documentation planning and generation from System Overview."""

from __future__ import annotations

import json
import uuid
from typing import Any

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.docs.docs_adapter import (
    build_evidence_summary,
    build_generate_response,
    build_plan_response,
    format_claims_text,
    format_components_text,
    format_gaps_text,
    format_lens_summaries,
    format_source_evidence,
)
from syntax_tree_refurbished.app.docs.docs_prompts import (
    GENERATE_SYSTEM_PROMPT,
    PLAN_SYSTEM_PROMPT,
    build_generate_user_prompt,
    build_plan_user_prompt,
)
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel
from syntax_tree_refurbished.core.models.lens import Lens
from syntax_tree_refurbished.core.models.system_overview import SystemOverview


class DocsController:
    def __init__(
        self,
        *,
        job: AnalysisJob,
        store: InMemoryRunStore,
        overview: SystemOverview,
        model: InvestigationModel,
    ) -> None:
        self._job = job
        self._store = store
        self._overview = overview
        self._model = model

    def create_plan(
        self,
        *,
        scope_qn: str,
        artifact_type: str,
        user_request: str,
        references: list[str] | None = None,
        max_words: int = 6000,
    ) -> dict[str, Any]:
        lens_ids = references or []
        lenses = self._resolve_lenses(lens_ids)

        evidence_summary = build_evidence_summary(self._overview)
        components_text = format_components_text(self._overview)
        claims_text = format_claims_text(self._overview)
        gaps_text = format_gaps_text(self._overview)
        lens_summaries = format_lens_summaries(lenses)

        resolved_refs: list[dict[str, Any]] = []
        for lens in lenses:
            resolved_refs.append({
                "qualified_name": lens.id,
                "label": lens.title,
                "name": lens.title,
                "type": "question_lens",
            })

        if isinstance(self._model, NoConfiguredModel):
            return self._degraded_plan(
                scope_qn=scope_qn,
                artifact_type=artifact_type,
                user_request=user_request,
                max_words=max_words,
                resolved_refs=resolved_refs,
                evidence_summary=evidence_summary,
                gaps_text=gaps_text,
            )

        try:
            user_prompt = build_plan_user_prompt(
                artifact_type=artifact_type,
                user_request=user_request,
                overview_summary=self._overview.summary,
                components_text=components_text,
                claims_text=claims_text,
                gaps_text=gaps_text,
                lens_summaries=lens_summaries,
                max_words=max_words,
            )
            reply = self._model.complete_json(
                system=PLAN_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
                max_tokens=2000,
            )
            plan_data = reply.data
            plan_id = str(uuid.uuid4())

            source_span_ids = _collect_span_ids(self._overview, lenses, self._store)
            return build_plan_response(
                plan_id=plan_id,
                title=plan_data.get("title", "Documentation"),
                artifact_type=artifact_type,
                scope_qn=scope_qn,
                user_request=user_request,
                max_words=max_words,
                outline=plan_data.get("outline", []),
                assumptions=plan_data.get("assumptions", []),
                evidence_targets=plan_data.get("evidence_targets", []),
                risks=plan_data.get("risks", []),
                intended_claims=plan_data.get("intended_claims", []),
                questions=plan_data.get("questions", []),
                resolved_references=resolved_refs,
                evidence_summary=evidence_summary,
                planning_model=reply.model,
                run_metadata={
                    "model": reply.model,
                    "tokens_in": reply.tokens_in,
                    "tokens_out": reply.tokens_out,
                    "latency_ms": reply.latency_ms,
                },
                source_span_ids=source_span_ids,
                question_lens_summary={
                    "lens_count": len(lenses),
                    "lens_ids": [lens.id for lens in lenses],
                },
            )
        except Exception as exc:
            return self._degraded_plan(
                scope_qn=scope_qn,
                artifact_type=artifact_type,
                user_request=user_request,
                max_words=max_words,
                resolved_refs=resolved_refs,
                evidence_summary=evidence_summary,
                gaps_text=gaps_text,
                planning_errors=[f"LLM planning failed: {exc}"],
            )

    def generate_from_plan(
        self,
        plan: dict[str, Any],
    ) -> dict[str, Any]:
        artifact_type = plan.get("artifact_type", "focused_doc")
        plan_title = plan.get("title", "Documentation")
        user_request = plan.get("user_request", "")
        outline = plan.get("outline", [])
        risks = plan.get("risks", [])
        max_words = plan.get("max_words", 6000)
        lens_ids = [
            ref.get("qualified_name", "")
            for ref in plan.get("resolved_references", [])
        ]
        lenses = self._resolve_lenses(lens_ids)

        components_text = format_components_text(self._overview)
        gaps_text = format_gaps_text(self._overview)
        source_evidence = format_source_evidence(self._overview, lenses, self._store)

        qualified_name = f"doc:{artifact_type}:{_slugify(plan_title)}"

        if isinstance(self._model, NoConfiguredModel):
            return build_generate_response(
                generated=False,
                message="No live LLM configured. Cannot generate documentation.",
                qualified_name=qualified_name,
                artifact_type=artifact_type,
                run_metadata={"model": "none", "fallback_used": True},
            )

        try:
            user_prompt = build_generate_user_prompt(
                plan_title=plan_title,
                artifact_type=artifact_type,
                user_request=user_request,
                outline=outline,
                risks=risks,
                overview_summary=self._overview.summary,
                components_text=components_text,
                source_evidence=source_evidence,
                gaps_text=gaps_text,
                max_words=max_words,
            )
            reply = self._model.complete_json(
                system=GENERATE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
                max_tokens=4000,
            )
            body = reply.data.get("body", "") or json.dumps(reply.data)

            unsupported: list[str] = []
            if self._overview.gaps:
                unsupported = list(self._overview.gaps)

            return build_generate_response(
                generated=True,
                message=body,
                qualified_name=qualified_name,
                artifact_type=artifact_type,
                run_metadata={
                    "model": reply.model,
                    "tokens_in": reply.tokens_in,
                    "tokens_out": reply.tokens_out,
                    "latency_ms": reply.latency_ms,
                },
                unsupported_claims=unsupported if unsupported else None,
            )
        except Exception as exc:
            return build_generate_response(
                generated=False,
                message=f"Documentation generation failed: {exc}",
                qualified_name=qualified_name,
                artifact_type=artifact_type,
                run_metadata={"model": getattr(self._model, "model_name", ""), "fallback_used": True},
            )

    def _resolve_lenses(self, lens_ids: list[str]) -> list[Lens]:
        lenses: list[Lens] = []
        for lid in lens_ids:
            lens = self._store.get_lens(self._job.run_id, lid)
            if lens:
                lenses.append(lens)
        return lenses

    def _degraded_plan(
        self,
        *,
        scope_qn: str,
        artifact_type: str,
        user_request: str,
        max_words: int,
        resolved_refs: list[dict[str, Any]],
        evidence_summary: dict[str, int],
        gaps_text: str,
        planning_errors: list[str] | None = None,
    ) -> dict[str, Any]:
        plan_id = str(uuid.uuid4())
        risks = ["No LLM available — plan is deterministic scaffold only."]
        if gaps_text and gaps_text != "(no known gaps)":
            risks.append(f"Known gaps in overview: {gaps_text}")

        return build_plan_response(
            plan_id=plan_id,
            title=self._overview.summary[:80] if self._overview.summary else "Documentation",
            artifact_type=artifact_type,
            scope_qn=scope_qn,
            user_request=user_request,
            max_words=max_words,
            outline=["Overview", "Components", "Key Relationships"],
            assumptions=["Overview data is accurate and complete."],
            evidence_targets=["System Overview components and claims"],
            risks=risks,
            intended_claims=[],
            questions=[],
            resolved_references=resolved_refs,
            evidence_summary=evidence_summary,
            planning_fallback_used=True,
            planning_errors=planning_errors or ["No LLM configured."],
            run_metadata={"model": "none", "fallback_used": True},
            source_span_ids=[],
            question_lens_summary={"lens_count": 0, "lens_ids": []},
        )


def _slugify(text: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9]+", "_", text.lower()).strip("_")[:60]


def _collect_span_ids(
    overview: SystemOverview,
    lenses: list[Lens],
    store: InMemoryRunStore,
) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    for region_dict in overview.important_regions:
        rid = str(region_dict.get("id", ""))
        if rid and rid not in seen:
            seen.add(rid)
            ids.append(rid)
    for lens in lenses:
        for claim in lens.claims:
            for citation in claim.citations:
                if citation.resolved_region_id and citation.resolved_region_id not in seen:
                    seen.add(citation.resolved_region_id)
                    ids.append(citation.resolved_region_id)
    return ids
