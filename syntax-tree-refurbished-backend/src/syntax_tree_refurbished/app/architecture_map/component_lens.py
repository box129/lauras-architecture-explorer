"""Generate focused component drilldown lenses from a SystemOverview component."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.investigation.engine import InvestigationEngine
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel
from syntax_tree_refurbished.core.models.grounding import GroundedClaim
from syntax_tree_refurbished.core.models.investigation import (
    InvestigationBudget,
    InvestigationFocus,
    InvestigationMetrics,
    InvestigationRequest,
)
from syntax_tree_refurbished.core.models.lens import Lens, LensChildComponent, LensRelationship
from syntax_tree_refurbished.core.models.source_region import SourceRegion
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent, SystemOverview


PROMPT_VERSION = "component-drilldown-v1"


class ComponentLensGenerator:
    def __init__(
        self,
        *,
        job: AnalysisJob,
        store: InMemoryRunStore,
        overview: SystemOverview,
        component: OverviewComponent | LensChildComponent,
        model: InvestigationModel,
        parent_lens: Lens | None = None,
    ) -> None:
        if not job.snapshot:
            raise ValueError("Repo snapshot is not ready.")
        self._job = job
        self._store = store
        self._overview = overview
        self._component = component
        self._model = model
        self._parent_lens = parent_lens

    def get_or_generate(self, *, validation_mode: bool = False) -> Lens:
        if isinstance(self._component, OverviewComponent):
            input_hash = build_component_lens_input_hash(
                job=self._job,
                overview=self._overview,
                component=self._component,
                model_name=self._model.model_name,
            )
        else:
            input_hash = build_child_lens_input_hash(
                job=self._job,
                overview=self._overview,
                child=self._component,
                parent_lens=self._parent_lens,
                model_name=self._model.model_name,
            )
        cached = self._store.get_lens(self._job.run_id, self._component.id)
        if cached and cached.input_hash == input_hash:
            return cached
        if isinstance(self._model, NoConfiguredModel):
            lens = self._degraded_lens(input_hash)
            self._store.put_lens(lens)
            return lens
        anchor_ids = getattr(self._component, 'anchor_ids', ())
        request = InvestigationRequest(
            run_id=self._job.run_id,
            question=self._question(),
            mode="component_drilldown",
            focus=InvestigationFocus(
                anchor_ids=anchor_ids,
                file_paths=self._component.related_file_paths,
            ),
            budget=InvestigationBudget(
                max_tool_calls=18,
                max_source_regions=14,
                timeout_seconds=120,
                max_tokens=24_000,
            ),
            validation_mode=validation_mode,
        )
        investigation = InvestigationEngine(job=self._job, store=self._store, model=self._model).investigate(request)
        lens = self._lens_from_investigation(input_hash=input_hash, investigation=investigation)
        self._store.put_lens(lens)
        return lens

    def _question(self) -> str:
        parent_context: dict[str, Any] = {
            "id": self._component.id,
            "label": self._component.label,
            "kind": self._component.kind,
            "summary": self._component.summary,
            "responsibilities": self._component.responsibilities,
            "source_region_ids": self._component.source_region_ids,
            "related_file_paths": self._component.related_file_paths,
            "support_status": self._component.support_status,
        }
        if isinstance(self._component, OverviewComponent):
            parent_context["anchor_ids"] = self._component.anchor_ids
        if isinstance(self._component, LensChildComponent) and self._parent_lens:
            parent_context["parent_lens_title"] = self._parent_lens.title
            parent_context["parent_lens_summary"] = self._parent_lens.summary
        source_context: dict[str, Any] = {
            "repo_shape": self._overview.repo_shape,
            "system_summary": self._overview.summary,
            "parent_component": parent_context,
            "parent_claims": [
                {
                    "text": claim.claim.text,
                    "support_status": claim.support_status,
                    "resolved_region_ids": [
                        citation.resolved_region_id
                        for citation in claim.citations
                        if citation.resolved_region_id
                    ],
                }
                for claim in self._overview.claims
                if _claim_relates_to_component(claim, self._component)
            ][:12],
            "known_gaps": self._overview.gaps[:12],
        }
        if isinstance(self._component, LensChildComponent):
            depth_hint = "This is a deeper sub-drilldown. Focus on fine-grained behavioral subareas. "
        else:
            depth_hint = ""
        return (
            f"{depth_hint}"
            "Create a source-grounded component drilldown lens for the selected parent component. "
            "Return meaningful subareas that help a user understand the code, not a file list. "
            "Each verified child must cite source regions. Context: "
            f"{json.dumps(source_context, sort_keys=True, default=list)}"
        )

    def _lens_from_investigation(self, *, input_hash: str, investigation) -> Lens:
        child_components = _children_from_investigation(
            run_id=self._job.run_id,
            parent_component_id=self._component.id,
            input_hash=input_hash,
            items=investigation.component_hypotheses,
            claims=investigation.claims,
            store=self._store,
        )
        relationships = _relationships_from_investigation(investigation.relationships, child_components)
        gaps = tuple(dict.fromkeys([*investigation.gaps, *_child_gaps(child_components)]))
        return Lens(
            id=_stable_id("lens", self._job.run_id, self._component.id, input_hash),
            analysis_run_id=self._job.run_id,
            parent_node_id=self._component.id,
            parent_component_id=self._component.id,
            input_hash=input_hash,
            status=_lens_status(investigation.status, child_components),
            title=self._component.label,
            summary=investigation.answer.summary or f"{self._component.label} drilldown.",
            simple_explanation=investigation.answer.simple_explanation,
            technical_explanation=investigation.answer.technical_explanation,
            child_components=child_components,
            relationships=relationships,
            claims=tuple(investigation.claims),
            important_regions=tuple(investigation.important_regions),
            gaps=gaps,
            suggested_questions=investigation.suggested_next_questions,
            metrics=investigation.metrics,
        )

    def _degraded_lens(self, input_hash: str) -> Lens:
        if isinstance(self._component, OverviewComponent):
            children = _children_from_file_fallback(
                run_id=self._job.run_id,
                parent_component_id=self._component.id,
                input_hash=input_hash,
                component=self._component,
                store=self._store,
            )
        else:
            children = _children_from_child_file_fallback(
                run_id=self._job.run_id,
                parent_component_id=self._component.id,
                input_hash=input_hash,
                child=self._component,
                store=self._store,
            )
        return Lens(
            id=_stable_id("lens", self._job.run_id, self._component.id, input_hash),
            analysis_run_id=self._job.run_id,
            parent_node_id=self._component.id,
            parent_component_id=self._component.id,
            input_hash=input_hash,
            status="degraded_no_llm",
            title=self._component.label,
            summary=f"{self._component.label} could not be semantically drilled down because no live LLM is configured.",
            simple_explanation="The backend can show source-backed file groups, but it cannot synthesize deeper architecture without a live model.",
            technical_explanation="No component_drilldown investigation ran.",
            child_components=children,
            relationships=(),
            claims=(),
            important_regions=(),
            gaps=("No live LLM configured; drilldown is source/file fallback only.",),
            suggested_questions=(),
            metrics=InvestigationMetrics(
                llm_used=False,
                model=self._model.model_name,
                tool_calls=0,
                regions_returned=0,
                tokens_in=0,
                tokens_out=0,
                latency_ms=0,
                fallback_reason="No live LLM configured.",
            ),
        )


def build_component_lens_input_hash(
    *,
    job: AnalysisJob,
    overview: SystemOverview,
    component: OverviewComponent,
    model_name: str,
) -> str:
    payload = {
        "prompt_version": PROMPT_VERSION,
        "run_id": job.run_id,
        "overview_input_hash": overview.input_hash,
        "model": model_name,
        "component": {
            "id": component.id,
            "label": component.label,
            "summary": component.summary,
            "responsibilities": component.responsibilities,
            "source_region_ids": component.source_region_ids,
            "anchor_ids": component.anchor_ids,
            "related_file_paths": component.related_file_paths,
            "support_status": component.support_status,
        },
    }
    return hashlib.sha1(json.dumps(payload, sort_keys=True, default=list).encode("utf-8")).hexdigest()


def build_child_lens_input_hash(
    *,
    job: AnalysisJob,
    overview: SystemOverview,
    child: LensChildComponent,
    parent_lens: Lens | None,
    model_name: str,
) -> str:
    payload: dict[str, Any] = {
        "prompt_version": PROMPT_VERSION,
        "run_id": job.run_id,
        "overview_input_hash": overview.input_hash,
        "model": model_name,
        "child": {
            "id": child.id,
            "label": child.label,
            "summary": child.summary,
            "responsibilities": child.responsibilities,
            "source_region_ids": child.source_region_ids,
            "related_file_paths": child.related_file_paths,
            "support_status": child.support_status,
        },
    }
    if parent_lens:
        payload["parent_lens_id"] = parent_lens.id
        payload["parent_lens_input_hash"] = parent_lens.input_hash
    return hashlib.sha1(json.dumps(payload, sort_keys=True, default=list).encode("utf-8")).hexdigest()


def _children_from_investigation(
    *,
    run_id: str,
    parent_component_id: str,
    input_hash: str,
    items: tuple[dict[str, Any], ...],
    claims: tuple[GroundedClaim, ...],
    store: InMemoryRunStore,
) -> tuple[LensChildComponent, ...]:
    children: list[LensChildComponent] = []
    seen: set[str] = set()
    for index, raw in enumerate(items):
        raw_label = _label(raw, f"Child Area {index + 1}")
        label = _child_label(raw_label)
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        source_region_ids = _region_ids(raw)
        related_paths = tuple(_dedupe([*(_list(raw.get("related_file_paths") or raw.get("files"))), *([raw_label] if _looks_like_path(raw_label) else [])]))
        if not source_region_ids:
            source_region_ids = _matching_claim_region_ids(label, related_paths, claims, store)
        support = str(raw.get("support_status") or raw.get("support") or "uncertain")
        if support == "verified" and not source_region_ids:
            support = "uncertain"
        children_hint = tuple(str(item) for item in _list(raw.get("children_hint")))
        children.append(
            LensChildComponent(
                id=_stable_id("lens-child", run_id, parent_component_id, label, input_hash),
                label=label,
                kind=_child_kind(raw, raw_label),
                summary=str(raw.get("summary") or raw.get("description") or ""),
                responsibilities=tuple(str(item) for item in _list(raw.get("responsibilities"))),
                source_region_ids=source_region_ids,
                related_file_paths=related_paths,
                support_status=support,
                confidence=_float(raw.get("confidence"), 0.55),
                children_hint=children_hint,
            )
        )
    return tuple(children)


def _children_from_file_fallback(
    *,
    run_id: str,
    parent_component_id: str,
    input_hash: str,
    component: OverviewComponent,
    store: InMemoryRunStore,
) -> tuple[LensChildComponent, ...]:
    children: list[LensChildComponent] = []
    seen: set[str] = set()
    for region_id in component.source_region_ids:
        region = store.get_region(region_id)
        if not region or region.path in seen:
            continue
        seen.add(region.path)
        label = _child_label(region.path)
        children.append(
            LensChildComponent(
                id=_stable_id("lens-child", run_id, parent_component_id, label, input_hash),
                label=label,
                kind="code_group",
                summary=f"Source-backed file group for {component.label}.",
                responsibilities=(),
                source_region_ids=(region.id,),
                related_file_paths=(region.path,),
                support_status="uncertain",
                confidence=0.35,
            )
        )
    return tuple(children)


def _children_from_child_file_fallback(
    *,
    run_id: str,
    parent_component_id: str,
    input_hash: str,
    child: LensChildComponent,
    store: InMemoryRunStore,
) -> tuple[LensChildComponent, ...]:
    children: list[LensChildComponent] = []
    seen: set[str] = set()
    for region_id in child.source_region_ids:
        region = store.get_region(region_id)
        if not region or region.path in seen:
            continue
        seen.add(region.path)
        label = _child_label(region.path)
        children.append(
            LensChildComponent(
                id=_stable_id("lens-child", run_id, parent_component_id, label, input_hash),
                label=label,
                kind="code_group",
                summary=f"Source-backed file group for {child.label}.",
                responsibilities=(),
                source_region_ids=(region.id,),
                related_file_paths=(region.path,),
                support_status="uncertain",
                confidence=0.35,
            )
        )
    return tuple(children)


def _relationships_from_investigation(items: tuple[dict[str, Any], ...], children: tuple[LensChildComponent, ...]) -> tuple[LensRelationship, ...]:
    by_label = {child.label.lower(): child.id for child in children}
    relationships: list[LensRelationship] = []
    for raw in items:
        from_label = _child_label(str(raw.get("from") or raw.get("source") or raw.get("from_component") or ""))
        to_label = _child_label(str(raw.get("to") or raw.get("target") or raw.get("to_component") or ""))
        from_id = str(raw.get("from_child_id") or raw.get("from_component_id") or by_label.get(from_label.lower()) or "")
        to_id = str(raw.get("to_child_id") or raw.get("to_component_id") or by_label.get(to_label.lower()) or "")
        if not from_id or not to_id:
            continue
        relationships.append(
            LensRelationship(
                from_child_id=from_id,
                to_child_id=to_id,
                label=str(raw.get("label") or raw.get("relationship") or "relates to"),
                summary=str(raw.get("summary") or raw.get("description") or ""),
                source_region_ids=_region_ids(raw),
                support_status=str(raw.get("support_status") or raw.get("support") or "uncertain"),
            )
        )
    return tuple(relationships)


def _matching_claim_region_ids(
    label: str,
    related_paths: tuple[str, ...],
    claims: tuple[GroundedClaim, ...],
    store: InMemoryRunStore,
) -> tuple[str, ...]:
    label_terms = set(_terms(label))
    path_terms = set(term for path in related_paths for term in _terms(path))
    region_ids: list[str] = []
    for claim in claims:
        claim_terms = set(_terms(claim.claim.text))
        region_paths = []
        for citation in claim.citations:
            if citation.resolved_region_id:
                region = store.get_region(citation.resolved_region_id)
                if region:
                    region_paths.append(region.path)
        if label_terms & claim_terms or path_terms & set(term for path in region_paths for term in _terms(path)):
            for citation in claim.citations:
                if citation.resolved_region_id and citation.resolved_region_id not in region_ids:
                    region_ids.append(citation.resolved_region_id)
    return tuple(region_ids)


def _claim_relates_to_component(claim: GroundedClaim, component: OverviewComponent | LensChildComponent) -> bool:
    component_terms = set(_terms(component.label)) | set(term for path in component.related_file_paths for term in _terms(path))
    claim_terms = set(_terms(claim.claim.text))
    return bool(component_terms & claim_terms)


def _child_gaps(children: tuple[LensChildComponent, ...]) -> tuple[str, ...]:
    return tuple(
        f"Child '{child.label}' is {child.support_status} because no exact source region was attached."
        for child in children
        if child.support_status == "verified" and not child.source_region_ids
    )


def _lens_status(status: str, children: tuple[LensChildComponent, ...]) -> str:
    if status == "completed" and children:
        return "ready"
    if status == "degraded_no_llm":
        return "degraded_no_llm"
    if status == "failed":
        return "failed"
    return "partial"


def _label(raw: dict[str, Any], fallback: str) -> str:
    return str(raw.get("label") or raw.get("name") or raw.get("component") or raw.get("title") or raw.get("area") or fallback).strip()


def _child_label(label: str) -> str:
    text = label.strip()
    if not _looks_like_path(text):
        return text
    normalized = text.replace("\\", "/").lower()
    stem = normalized.rsplit("/", 1)[-1]
    if "client" in stem:
        return "Client Code Group"
    if "transport" in stem:
        return "Transport Code Group"
    if "auth" in stem:
        return "Auth Code Group"
    if "model" in stem:
        return "Model Code Group"
    cleaned = stem.rsplit(".", 1)[0].strip("_-")
    return f"{cleaned.replace('_', ' ').replace('-', ' ').title()} Code Group" if cleaned else "Code Group"


def _child_kind(raw: dict[str, Any], raw_label: str) -> str:
    kind = str(raw.get("kind") or raw.get("type") or "subcomponent")
    if _looks_like_path(raw_label):
        return "code_group"
    return kind


def _region_ids(raw: dict[str, Any]) -> tuple[str, ...]:
    values: list[Any] = []
    for key in ("source_region_ids", "region_ids", "source_regions"):
        value = raw.get(key)
        if isinstance(value, list):
            values.extend(value)
    values.extend(
        item.get("source_region_id")
        for item in _list(raw.get("evidence"))
        if isinstance(item, dict)
    )
    return tuple(_dedupe(str(value) for value in values if str(value or "").startswith("region:")))


def _terms(value: str) -> tuple[str, ...]:
    return tuple(term for term in re.split(r"[^a-zA-Z0-9]+", value.lower()) if len(term) >= 3)


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _looks_like_path(value: str) -> bool:
    text = value.strip()
    return "/" in text or "\\" in text or text.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".java", ".rs", ".rb", ".php"))


def _dedupe(values) -> tuple[str, ...]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if text and text not in seen:
            seen.add(text)
            output.append(text)
    return tuple(output)


def _stable_id(prefix: str, *parts: str) -> str:
    raw = "|".join(str(part) for part in parts)
    return f"{prefix}:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"
