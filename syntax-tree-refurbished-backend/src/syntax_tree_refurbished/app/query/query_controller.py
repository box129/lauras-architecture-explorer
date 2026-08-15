"""Query controller — answers questions from System Overview + optional focused investigation."""

from __future__ import annotations

import uuid
from typing import Any

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.investigation.engine import InvestigationEngine
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel
from syntax_tree_refurbished.app.query.query_lens_adapter import (
    _tokenize,
    classify_intent,
    investigation_to_query_response,
)
from syntax_tree_refurbished.app.query.local_search import LocalSearchEngine, local_query_response
from syntax_tree_refurbished.core.models.investigation import (
    InvestigationBudget,
    InvestigationFocus,
    InvestigationRequest,
)
from syntax_tree_refurbished.core.models.lens import Lens
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent, SystemOverview


class QueryController:
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

    def answer(self, question: str, conversation_id: str | None = None) -> dict[str, Any]:
        if isinstance(self._model, NoConfiguredModel):
            return self._degraded_answer(question, conversation_id)

        matched_components, matched_claims = self._match_question(question)

        return self._investigate(question, matched_components, matched_claims, conversation_id)

    def get_lens(self, lens_id: str) -> Lens | dict[str, Any] | None:
        cached = self._store.get_lens(self._job.run_id, lens_id)
        if cached:
            return cached
        return LocalSearchEngine(
            job=self._job,
            store=self._store,
            overview=self._overview,
        ).lens_for_subject(lens_id)

    def _match_question(self, question: str) -> tuple[list[OverviewComponent], list]:
        terms = set(_tokenize(question))
        if not terms:
            return [], []

        matched_components: list[tuple[int, OverviewComponent]] = []
        for component in self._overview.main_components:
            score = 0
            label_terms = set(_tokenize(component.label))
            score += len(terms & label_terms) * 3
            summary_terms = set(_tokenize(component.summary))
            score += len(terms & summary_terms) * 2
            for resp in component.responsibilities:
                resp_terms = set(_tokenize(resp))
                score += len(terms & resp_terms)
            if score > 0:
                matched_components.append((score, component))
        matched_components.sort(key=lambda x: x[0], reverse=True)

        matched_claims: list[tuple[int, Any]] = []
        for claim in self._overview.claims:
            claim_terms = set(_tokenize(claim.claim.text))
            score = len(terms & claim_terms) * 2
            if score > 0:
                matched_claims.append((score, claim))
        matched_claims.sort(key=lambda x: x[0], reverse=True)

        return (
            [comp for _, comp in matched_components[:10]],
            [claim for _, claim in matched_claims[:10]],
        )

    def _investigate(
        self,
        question: str,
        matched_components: list[OverviewComponent],
        matched_claims: list,
        conversation_id: str | None,
    ) -> dict[str, Any]:
        anchor_ids: list[str] = []
        file_paths: list[str] = []
        for comp in matched_components:
            anchor_ids.extend(comp.anchor_ids)
            file_paths.extend(comp.related_file_paths)
        for claim in matched_claims:
            for citation in getattr(claim, "citations", []):
                if getattr(citation, "resolved_region_id", None):
                    region = self._store.get_region(citation.resolved_region_id)
                    if region and region.path not in file_paths:
                        file_paths.append(region.path)

        context_parts: list[str] = [f"Question: {question}"]
        if matched_components:
            context_parts.append(
                "Relevant overview components: "
                + "; ".join(f"{c.label}: {c.summary}" for c in matched_components[:5])
            )
        if matched_claims:
            context_parts.append(
                "Relevant overview claims: "
                + "; ".join(c.claim.text for c in matched_claims[:5])
            )
        context_parts.append(
            "Investigate further if the overview does not fully answer the question. "
            "Otherwise synthesize an answer from the overview context above."
        )

        request = InvestigationRequest(
            run_id=self._job.run_id,
            question="\n".join(context_parts),
            mode="focused_question",
            focus=InvestigationFocus(
                anchor_ids=tuple(dict.fromkeys(anchor_ids)),
                file_paths=tuple(dict.fromkeys(file_paths)),
            ),
            budget=InvestigationBudget(
                max_tool_calls=12,
                max_source_regions=10,
                timeout_seconds=90,
                max_tokens=16_000,
            ),
        )
        investigation = InvestigationEngine(
            job=self._job,
            store=self._store,
            model=self._model,
        ).investigate(request)

        for hypothesis in investigation.component_hypotheses:
            lens_id = hypothesis.get("id", "")
            if lens_id and not self._store.get_lens(self._job.run_id, lens_id):
                from syntax_tree_refurbished.app.architecture_map.component_lens import (
                    _children_from_investigation,
                    _relationships_from_investigation,
                )
                from syntax_tree_refurbished.core.models.lens import Lens as LensModel

                children = _children_from_investigation(
                    run_id=self._job.run_id,
                    parent_component_id=lens_id,
                    input_hash=investigation.metrics.model or "query",
                    items=(hypothesis,),
                    claims=investigation.claims,
                    store=self._store,
                )
                relationships = _relationships_from_investigation(
                    investigation.relationships, children
                )
                lens = LensModel(
                    id=lens_id,
                    analysis_run_id=self._job.run_id,
                    parent_node_id=lens_id,
                    parent_component_id=lens_id,
                    input_hash=investigation.metrics.model or "query",
                    status="ready" if children else "partial",
                    title=hypothesis.get("label", question[:60]),
                    summary=investigation.answer.summary,
                    simple_explanation=investigation.answer.simple_explanation,
                    technical_explanation=investigation.answer.technical_explanation,
                    child_components=children,
                    relationships=relationships,
                    claims=investigation.claims,
                    important_regions=investigation.important_regions,
                    gaps=investigation.gaps,
                    suggested_questions=investigation.suggested_next_questions,
                    metrics=investigation.metrics,
                )
                self._store.put_lens(lens)

        result = investigation_to_query_response(
            investigation=investigation,
            question=question,
            conversation_id=conversation_id,
            store=self._store,
        )
        result["intent"] = classify_intent(question)
        return result

    def _degraded_answer(self, question: str, conversation_id: str | None) -> dict[str, Any]:
        engine = LocalSearchEngine(job=self._job, store=self._store, overview=self._overview)
        lenses = engine.search(question, limit=10)
        return local_query_response(
            job=self._job,
            question=question,
            conversation_id=conversation_id or str(uuid.uuid4()),
            lenses=lenses,
            intent=classify_intent(question),
        )
