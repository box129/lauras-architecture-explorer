"""Generate and cache a source-grounded System Overview."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
import hashlib
import json
import time
from typing import Any

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.analysis.static_structure import build_static_structure
from syntax_tree_refurbished.app.investigation.engine import InvestigationEngine
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel
from syntax_tree_refurbished.core.models.grounding import GroundedClaim
from syntax_tree_refurbished.core.models.investigation import (
    InvestigationBudget,
    InvestigationRequest,
)
from syntax_tree_refurbished.core.models.system_overview import (
    GenerationMode,
    OverviewComponent,
    OverviewRelationship,
    SystemOverview,
    SystemOverviewMetrics,
)


PROMPT_VERSION = "system-overview-v1"
ARCHITECTURE_DISCOVERY_QUESTION = (
    "Create a source-grounded System Overview / Architecture Brief for this repository. "
    "Identify repo shape, main architecture areas, relationships, important anchors, "
    "verified claims, orientation-only notes, uncertain claims, and gaps. Do not force "
    "frontend/backend/auth/RAG/app layers unless source evidence supports them."
)


class SystemOverviewGenerator:
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore, model: InvestigationModel):
        if not job.snapshot:
            raise ValueError("Repo snapshot is not ready.")
        self._job = job
        self._store = store
        self._model = model

    def get_or_generate(self, *, validation_mode: bool = False) -> SystemOverview:
        started = time.monotonic()
        # required_mode reflects what THIS call could possibly produce, not
        # what it will produce: a NoConfiguredModel call can only ever
        # yield "no_model" content, so it may only accept a "no_model"
        # cache entry; a live model call is attempting "live_model"
        # content, so it may only accept a "live_model" entry -- even if
        # that live attempt ultimately fails and degrades (see below), the
        # degraded result is tagged "no_model" on write, so it can never
        # satisfy a later "live_model" lookup and silently block a retry.
        required_mode: GenerationMode = "no_model" if isinstance(self._model, NoConfiguredModel) else "live_model"
        input_hash = build_overview_input_hash(
            job=self._job,
            store=self._store,
            model_name=self._model.model_name,
            generation_mode=required_mode,
        )
        cached = self._store.get_system_overview(self._job.run_id)
        if cached and cached.input_hash == input_hash and cached.metrics.generation_mode == required_mode:
            self._store.put_system_overview(_with_cached_metric(cached, True))
            return _with_cached_metric(cached, True)
        if isinstance(self._model, NoConfiguredModel):
            overview = self._degraded_overview(input_hash=input_hash, started=started)
            self._store.put_system_overview(overview)
            return overview

        request = InvestigationRequest(
            run_id=self._job.run_id,
            question=ARCHITECTURE_DISCOVERY_QUESTION,
            mode="architecture_discovery",
            budget=InvestigationBudget(
                max_tool_calls=32,
                max_source_regions=24,
                timeout_seconds=180,
                max_tokens=32_000,
            ),
            validation_mode=validation_mode,
        )
        investigation = InvestigationEngine(
            job=self._job,
            store=self._store,
            model=self._model,
        ).investigate(request)
        if not investigation.metrics.llm_used:
            # A live model WAS configured (the NoConfiguredModel branch
            # above was not taken), but it never produced a single usable
            # reply -- e.g. an invalid/stale model id, an unreachable
            # provider, or a malformed response (InvestigationEngine sets
            # ``llm_used=False`` exactly in this case, including its own
            # ``fallback_reason=f"LLM response failed after retry:
            # {exc}"``, which is a raw provider exception string never
            # meant for direct display). Rather than building an overview
            # whose gaps/warnings would surface that raw text verbatim in
            # the "Simple explanation" UI panel, degrade to the SAME
            # honest, deterministic, source-backed overview already used
            # when no live model is configured at all -- an invalid/
            # broken legacy model is treated the same as an absent one,
            # never as a reason to leak a provider error into the normal
            # product UI.
            overview = self._degraded_overview(input_hash=input_hash, started=started)
            self._store.put_system_overview(overview)
            return overview
        overview = self._overview_from_investigation(
            input_hash=input_hash,
            started=started,
            investigation=investigation,
        )
        self._store.put_system_overview(overview)
        return overview

    def _overview_from_investigation(self, *, input_hash: str, started: float, investigation) -> SystemOverview:
        snapshot = self._job.snapshot
        assert snapshot is not None
        status = _overview_status(investigation.status)
        components = _components(
            run_id=self._job.run_id,
            items=investigation.component_hypotheses,
            region_ids=tuple(region.get("source_region_id", "") for region in investigation.important_regions),
        )
        relationships = _relationships(investigation.relationships, components)
        claims = tuple(investigation.claims)
        important_regions = _important_regions(investigation.important_regions, self._store)
        important_files = _important_files(important_regions, claims, self._store)
        orientation = self._orientation_notes()
        summary = investigation.answer.summary or _fallback_summary(snapshot.repo_name, components)
        overview = SystemOverview(
            id=_overview_id(self._job.run_id, input_hash),
            analysis_run_id=self._job.run_id,
            input_hash=input_hash,
            status=status,
            repo_identity=_repo_identity(snapshot),
            repo_shape=_repo_shape(investigation, snapshot),
            summary=summary,
            main_components=components,
            relationships=relationships,
            semantic_anchors=self._semantic_anchor_summaries(),
            important_files=important_files,
            important_regions=important_regions,
            claims=claims,
            orientation_notes=orientation,
            gaps=tuple(dict.fromkeys([*investigation.gaps, *_claim_gaps(claims)])),
            suggested_questions=investigation.suggested_next_questions,
            suggested_lenses=_suggested_lenses(components, investigation.suggested_next_questions),
            investigation_summaries=(
                {
                    "question": investigation.question,
                    "status": investigation.status,
                    "summary": investigation.answer.summary,
                    "tool_calls": investigation.metrics.tool_calls,
                    "regions_returned": investigation.metrics.regions_returned,
                },
            ),
            metrics=SystemOverviewMetrics(
                cached=False,
                llm_used=investigation.metrics.llm_used,
                model=investigation.metrics.model,
                latency_ms=int((time.monotonic() - started) * 1000),
                tool_calls=investigation.metrics.tool_calls,
                regions_returned=investigation.metrics.regions_returned,
                tokens_in=investigation.metrics.tokens_in,
                tokens_out=investigation.metrics.tokens_out,
                input_hash=input_hash,
                # Only reached when investigation.metrics.llm_used is True
                # (get_or_generate diverts the False case to
                # _degraded_overview before calling this method) -- a
                # genuine successful investigation, so this is real
                # "live_model" content, never to be read back by a
                # NoConfiguredModel (or failed-live-model) lookup.
                generation_mode="live_model",
            ),
        )
        return overview

    def _degraded_overview(self, *, input_hash: str, started: float) -> SystemOverview:
        snapshot = self._job.snapshot
        assert snapshot is not None
        anchors = self._store.get_anchors(self._job.run_id)
        components, relationships = build_static_structure(self._job, self._store)
        if not components:
            components = _components_from_anchors(self._job.run_id, anchors)
        orientation = self._orientation_notes()
        important_region_ids = tuple(
            dict.fromkeys(
                region_id
                for component in components
                for region_id in component.source_region_ids
            )
        )
        important_regions = tuple(
            {
                "source_region_id": region.id,
                "path": region.path,
                "start_line": region.start_line,
                "end_line": region.end_line,
                "reason": "Static source module",
            }
            for region_id in important_region_ids
            if (region := self._store.get_region(region_id)) is not None
        )
        return SystemOverview(
            id=_overview_id(self._job.run_id, input_hash),
            analysis_run_id=self._job.run_id,
            input_hash=input_hash,
            status="ready" if components else "degraded_no_llm",
            repo_identity=_repo_identity(snapshot),
            repo_shape={
                "kind": "static_module_graph",
                "label": "Source module graph",
                "confidence": 0.98 if components else 0.0,
                "support_status": "verified" if components else "not_inspected",
                "reason": "Modules and imports were extracted locally from repository source.",
            },
            summary=(
                f"{snapshot.repo_name} contains {len(components)} source module(s) linked by "
                f"{len(relationships)} locally extracted import relationship(s)."
                if components
                else f"{snapshot.repo_name} was indexed, but no supported source modules were found."
            ),
            main_components=components,
            relationships=relationships,
            semantic_anchors=self._semantic_anchor_summaries(),
            important_files=tuple(component.related_file_paths[0] for component in components[:40] if component.related_file_paths),
            important_regions=important_regions,
            claims=(),
            orientation_notes=orientation,
            gaps=("Optional LLM enrichment is unavailable; this map uses deterministic static analysis.",),
            suggested_questions=_fallback_questions(snapshot.repo_name, anchors),
            suggested_lenses=(),
            investigation_summaries=(),
            metrics=SystemOverviewMetrics(
                cached=False,
                llm_used=False,
                model=self._model.model_name,
                latency_ms=int((time.monotonic() - started) * 1000),
                tool_calls=0,
                regions_returned=0,
                tokens_in=0,
                tokens_out=0,
                input_hash=input_hash,
                # Deterministic, source-backed content -- true whether this
                # was reached because no model is configured at all, or
                # because a configured live model was attempted and never
                # produced a usable reply. Tagging both cases identically
                # is what keeps a transient live-model failure from being
                # mistaken for a durable "live_model" result on a later
                # lookup (see get_or_generate's explicit generation_mode
                # comparison, not just the input_hash comparison).
                generation_mode="no_model",
            ),
        )

    def _semantic_anchor_summaries(self) -> tuple[dict[str, Any], ...]:
        return tuple(
            {
                "id": anchor.id,
                "kind": anchor.kind,
                "label": anchor.label,
                "path": anchor.path,
                "start_line": anchor.start_line,
                "end_line": anchor.end_line,
                "source_region_id": anchor.source_region_id,
                "confidence": anchor.confidence,
                "status": anchor.status,
            }
            for anchor in self._store.get_anchors(self._job.run_id)[:120]
        )

    def _orientation_notes(self) -> tuple[dict[str, Any], ...]:
        return tuple(
            {
                "id": item.id,
                "path": item.path,
                "kind": item.kind,
                "title": item.title,
                "summary": item.summary,
                "signals": item.signals,
                "support_status": "orientation_only",
                "proof_allowed": item.proof_allowed,
            }
            for item in self._store.get_orientation_items(self._job.run_id)[:40]
        )


def build_overview_input_hash(
    *, job: AnalysisJob, store: InMemoryRunStore, model_name: str, generation_mode: GenerationMode
) -> str:
    snapshot = job.snapshot
    if not snapshot:
        return ""
    payload = {
        "prompt_version": PROMPT_VERSION,
        "model": model_name,
        # Part of the cache key specifically so a "no_model" (deterministic)
        # entry and a "live_model" (genuine investigation) entry can never
        # collide/be reused for each other, even if model_name alone would
        # otherwise have coincided. See GenerationMode's own docstring.
        "generation_mode": generation_mode,
        "run_id": job.run_id,
        "repo_path": snapshot.repo_path,
        "files": [(file.path, file.content_hash, file.line_count, file.role) for file in snapshot.files],
        "orientation": [(item.id, item.path, item.summary, item.signals) for item in store.get_orientation_items(job.run_id)],
        "anchors": [
            (anchor.id, anchor.kind, anchor.path, anchor.start_line, anchor.end_line, anchor.source_region_id)
            for anchor in store.get_anchors(job.run_id)
        ],
        "symbol_count": len(store.get_symbols(job.run_id)),
    }
    encoded = json.dumps(payload, sort_keys=True, default=list).encode("utf-8")
    return hashlib.sha1(encoded).hexdigest()


def _with_cached_metric(overview: SystemOverview, cached: bool) -> SystemOverview:
    return replace(overview, metrics=replace(overview.metrics, cached=cached))


def _repo_identity(snapshot) -> dict[str, Any]:
    return {
        "name": snapshot.repo_name,
        "path": snapshot.repo_path,
        "primary_languages": [item.__dict__ for item in snapshot.languages[:8]],
        "package_boundaries": [item.__dict__ for item in snapshot.package_boundaries[:20]],
        "file_count": snapshot.file_count,
    }


def _repo_shape(investigation, snapshot) -> dict[str, Any]:
    value = investigation.metadata.get("repo_shape") if isinstance(investigation.metadata, dict) else None
    if isinstance(value, dict) and value:
        return value
    text = " ".join(
        [
            investigation.answer.summary,
            investigation.answer.simple_explanation,
            investigation.answer.technical_explanation,
        ]
    ).lower()
    if "http client" in text or "transport" in text:
        return {
            "kind": "python_http_client_library",
            "label": "Python HTTP client library",
            "confidence": 0.7,
            "support_status": "inferred",
            "reason": "Investigation summary emphasizes HTTP client and transport behavior.",
        }
    return {
        "kind": "unknown",
        "label": "Unknown repo shape",
        "confidence": 0.3,
        "support_status": "uncertain",
        "reason": f"Overview generated for {snapshot.repo_name}, but no explicit repo_shape was returned.",
    }


def _components(run_id: str, items: tuple[dict[str, Any], ...], region_ids: tuple[str, ...]) -> tuple[OverviewComponent, ...]:
    components: list[OverviewComponent] = []
    seen: set[str] = set()
    for index, raw in enumerate(items):
        raw_label = _label(raw, fallback=f"Component {index + 1}")
        label = _architecture_label(raw_label)
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        component_id = _stable_id("component", run_id, label)
        source_region_ids = _region_ids(raw) or tuple(region_id for region_id in region_ids if region_id)
        related_paths = list(_list(raw.get("related_file_paths") or raw.get("files")))
        if _looks_like_path(raw_label):
            related_paths.insert(0, raw_label)
        components.append(
            OverviewComponent(
                id=component_id,
                label=label,
                kind=str(raw.get("kind") or raw.get("type") or "component"),
                summary=str(raw.get("summary") or raw.get("description") or ""),
                responsibilities=tuple(str(item) for item in _list(raw.get("responsibilities"))),
                source_region_ids=source_region_ids,
                anchor_ids=tuple(str(item) for item in _list(raw.get("anchor_ids"))),
                related_file_paths=tuple(dict.fromkeys(str(item) for item in related_paths)),
                support_status=str(raw.get("support_status") or raw.get("support") or "uncertain"),
                confidence=_float(raw.get("confidence"), 0.5),
                children_hint=tuple(str(item) for item in _list(raw.get("children_hint"))),
            )
        )
    return tuple(components)


def _components_from_anchors(run_id: str, anchors) -> tuple[OverviewComponent, ...]:
    groups: dict[str, list[Any]] = {}
    for anchor in anchors:
        groups.setdefault(anchor.kind, []).append(anchor)
    components: list[OverviewComponent] = []
    for kind, grouped in sorted(groups.items()):
        label = kind.replace("_", " ").title()
        components.append(
            OverviewComponent(
                id=_stable_id("component", run_id, label),
                label=label,
                kind=kind,
                summary=f"{len(grouped)} source-detected {kind.replace('_', ' ')} anchor(s).",
                responsibilities=(),
                source_region_ids=tuple(anchor.source_region_id for anchor in grouped[:12]),
                anchor_ids=tuple(anchor.id for anchor in grouped[:12]),
                related_file_paths=tuple(dict.fromkeys(anchor.path for anchor in grouped[:12])),
                support_status="uncertain",
                confidence=0.35,
            )
        )
    return tuple(components)


def _relationships(items: tuple[dict[str, Any], ...], components: tuple[OverviewComponent, ...]) -> tuple[OverviewRelationship, ...]:
    by_label = {component.label.lower(): component.id for component in components}
    relationships: list[OverviewRelationship] = []
    for raw in items:
        from_label = str(raw.get("from") or raw.get("source") or raw.get("from_component") or "")
        to_label = str(raw.get("to") or raw.get("target") or raw.get("to_component") or "")
        from_id = str(raw.get("from_component_id") or by_label.get(_architecture_label(from_label).lower()) or "")
        to_id = str(raw.get("to_component_id") or by_label.get(_architecture_label(to_label).lower()) or "")
        if not from_id or not to_id:
            continue
        relationships.append(
            OverviewRelationship(
                from_component_id=from_id,
                to_component_id=to_id,
                label=str(raw.get("label") or raw.get("relationship") or "relates to"),
                summary=str(raw.get("summary") or raw.get("description") or ""),
                source_region_ids=_region_ids(raw),
                support_status=str(raw.get("support_status") or raw.get("support") or "uncertain"),
            )
        )
    return tuple(relationships)


def _important_regions(items: tuple[dict[str, Any], ...], store: InMemoryRunStore) -> tuple[dict[str, Any], ...]:
    regions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in items:
        region_id = raw.get("source_region_id") or raw.get("region_id") or raw.get("id")
        if not region_id or not str(region_id).startswith("region:") or region_id in seen:
            continue
        seen.add(str(region_id))
        region = store.get_region(str(region_id))
        resolved = dict(raw, source_region_id=str(region_id))
        if region:
            resolved.setdefault("path", region.path)
            resolved.setdefault("start_line", region.start_line)
            resolved.setdefault("end_line", region.end_line)
            resolved.setdefault("content_hash", region.content_hash)
        regions.append(resolved)
    return tuple(regions)


def _important_files(
    regions: tuple[dict[str, Any], ...],
    claims: tuple[GroundedClaim, ...],
    store: InMemoryRunStore,
) -> tuple[str, ...]:
    files: list[str] = []
    for region in regions:
        if region.get("path"):
            files.append(str(region["path"]))
    for claim in claims:
        for validation in claim.citations:
            if validation.citation.path:
                files.append(validation.citation.path)
            elif validation.resolved_region_id:
                region = store.get_region(validation.resolved_region_id)
                if region:
                    files.append(region.path)
    return tuple(dict.fromkeys(files))


def _claim_gaps(claims: tuple[GroundedClaim, ...]) -> tuple[str, ...]:
    gaps: list[str] = []
    for claim in claims:
        if claim.support_status != "verified":
            gaps.append(f"Claim '{claim.claim.text}' is {claim.support_status}.")
    return tuple(gaps)


def _suggested_lenses(components: tuple[OverviewComponent, ...], questions: tuple[str, ...]) -> tuple[dict[str, Any], ...]:
    lenses = [
        {"type": "component", "title": component.label, "component_id": component.id}
        for component in components[:8]
    ]
    lenses.extend({"type": "question", "title": question, "question": question} for question in questions[:6])
    return tuple(lenses)


def _fallback_questions(repo_name: str, anchors) -> tuple[str, ...]:
    questions = [f"What are the main entrypoints in {repo_name}?"]
    if anchors:
        questions.append(f"How does {anchors[0].label} work?")
    return tuple(questions)


def _overview_status(status: str) -> str:
    return {
        "completed": "ready",
        "partial": "partial",
        "degraded_no_llm": "degraded_no_llm",
        "failed": "failed",
    }.get(status, "partial")


def _fallback_summary(repo_name: str, components: tuple[OverviewComponent, ...]) -> str:
    if components:
        return f"{repo_name} appears to contain {len(components)} source-backed architecture area(s)."
    return f"{repo_name} was indexed, but no architecture components were established yet."


def _label(raw: dict[str, Any], fallback: str) -> str:
    return str(
        raw.get("label")
        or raw.get("name")
        or raw.get("component")
        or raw.get("title")
        or raw.get("area")
        or fallback
    ).strip()


def _architecture_label(label: str) -> str:
    text = label.strip()
    if not _looks_like_path(text):
        return text
    normalized = text.replace("\\", "/").lower()
    stem = normalized.rsplit("/", 1)[-1]
    parent = normalized.rsplit("/", 1)[0] if "/" in normalized else ""
    if stem in {"__init__.py", "index.ts", "index.tsx", "index.js"}:
        return "Package Surface"
    if stem in {"_api.py", "api.py"} or "public" in stem:
        return "Public Request API"
    if "client" in stem:
        return "Client Lifecycle"
    if "transport" in stem or "transports" in parent:
        return "Transport Layer"
    if stem in {"_models.py", "models.py"} or "model" in stem:
        return "Request And Response Models"
    if "auth" in stem:
        return "Auth And Cookies"
    if "cookie" in stem:
        return "Auth And Cookies"
    if "config" in stem or "timeout" in stem:
        return "Configuration And Timeouts"
    if "url" in stem:
        return "URL Handling"
    if any(part in stem for part in ("content", "decoder", "multipart")):
        return "Content, Decoding, And Multipart"
    if stem in {"_main.py", "main.py", "cli.py"}:
        return "CLI And Package Surface"
    if "route" in stem or "/routes/" in normalized:
        return "HTTP Routes"
    if "page" in stem or "/pages/" in normalized:
        return "Frontend Pages"
    if "worker" in stem:
        return "Workers"
    cleaned = stem.rsplit(".", 1)[0].strip("_-")
    return cleaned.replace("_", " ").replace("-", " ").title() or text


def _looks_like_path(value: str) -> bool:
    text = value.strip()
    if not text:
        return False
    if "/" in text or "\\" in text:
        return True
    return text.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".java", ".rs", ".rb", ".php"))


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
    return tuple(dict.fromkeys(str(value) for value in values if str(value or "").startswith("region:")))


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _stable_id(prefix: str, run_id: str, label: str) -> str:
    raw = "|".join([prefix, run_id, label])
    return f"{prefix}:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


def _overview_id(run_id: str, input_hash: str) -> str:
    return _stable_id("overview", run_id, input_hash)
