"""Documentation endpoints — promptable artifact generation from System Overview."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.analysis.static_structure import module_component_id
from syntax_tree_refurbished.api.dto.docs_generation import (
    ComponentDocGenerationResponse,
    DocGenerationRunMetadata,
    RelationshipNoteDTO,
)
from syntax_tree_refurbished.api.dto.provenance import ArchitecturalClaimDTO
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.architectural_explanation.verification_service import (
    verify_target_entity,
)
from syntax_tree_refurbished.app.docs.component_doc_generator import (
    generate_component_documentation,
)
from syntax_tree_refurbished.app.docs.docs_controller import DocsController
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.app.investigation.llm_model import (
    InvestigationModel,
    NoConfiguredModel,
    make_arch_explanation_model,
    make_live_model,
)
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.provenance import ArchitecturalClaim
from syntax_tree_refurbished.core.models.system_overview import SystemOverview


class DocPlanRequest(BaseModel):
    scope_qn: str = "system"
    artifact_type: str = "onboarding"
    user_request: str
    references: list[Any] | None = None
    max_words: int = 6000


class GenerateDocsRequest(BaseModel):
    plan_id: str
    title: str | None = None
    outline: list[str] | None = None
    assumptions: list[str] | None = None
    evidence_targets: list[str] | None = None
    risks: list[str] | None = None


router = APIRouter(prefix="/docs", tags=["documentation"])

DOC_PLANS: dict[str, dict] = {}
PLAN_TTL_SECONDS = 1800  # 30 minutes


def _cleanup_stale_plans() -> None:
    now = time.time()
    stale = [
        pid for pid, p in DOC_PLANS.items()
        if now - p.get("_created_at", 0) > PLAN_TTL_SECONDS
    ]
    for pid in stale:
        DOC_PLANS.pop(pid, None)


@router.get("/hierarchy")
def documentation_hierarchy(request: Request, run_id: str | None = None) -> dict:
    """Return the real module/symbol hierarchy for the selected analysis run."""
    job = resolve_ready_run(request, run_id)
    store = _store(request)
    symbols = store.get_symbols(job.run_id)
    symbols_by_path: dict[str, list] = {}
    for symbol in symbols:
        symbols_by_path.setdefault(symbol.path, []).append(symbol)
    overview = store.get_system_overview(job.run_id) or _overview(request, job)
    module_paths = {
        component.related_file_paths[0]
        for component in overview.main_components
        if component.kind == "module" and component.related_file_paths
    }

    items_by_id: dict[str, dict] = {}
    module_ids: dict[str, str] = {}
    for file in sorted(job.snapshot.files, key=lambda item: item.path):
        file_symbols = symbols_by_path.get(file.path, [])
        if (not file_symbols and file.path not in module_paths) or not file.readable:
            continue
        module_id = module_component_id(job.run_id, file.path)
        module_ids[file.path] = module_id
        items_by_id[module_id] = {
            "id": module_id,
            "parent_id": None,
            "kind": "module",
            "name": file.path,
            "qualified_name": file.path,
            "path": file.path,
            "start_line": 1,
            "end_line": max(1, file.line_count),
            "signature": "",
            "children": [],
        }
    for symbol in symbols:
        module_id = module_ids.get(symbol.path)
        if not module_id:
            continue
        items_by_id[symbol.id] = {
            "id": symbol.id,
            "parent_id": symbol.parent_symbol_id or module_id,
            "kind": symbol.kind,
            "name": symbol.name,
            "qualified_name": symbol.qualified_name,
            "path": symbol.path,
            "start_line": symbol.start_line,
            "end_line": symbol.end_line,
            "signature": symbol.signature,
            "children": [],
        }
    for item in tuple(items_by_id.values()):
        parent_id = item["parent_id"]
        parent = items_by_id.get(parent_id) if parent_id else None
        if parent:
            parent["children"].append(item)
    for item in items_by_id.values():
        item["children"].sort(key=lambda child: (child["start_line"], child["name"]))
    roots = [item for item in items_by_id.values() if item["parent_id"] is None]
    roots.sort(key=lambda item: item["path"])
    return {
        "analysis_run_id": job.run_id,
        "repository_name": job.snapshot.repo_name,
        "items": roots,
    }


@router.get("/components/{component_id:path}")
def documentation_component(component_id: str, request: Request, run_id: str | None = None) -> dict:
    """Return source-grounded documentation and source for one hierarchy item."""
    job = resolve_ready_run(request, run_id)
    store = _store(request)
    reader = SourceReader(job)
    symbol = store.get_symbol(component_id)
    if symbol and symbol.run_id == job.run_id:
        try:
            region = reader.read_range(symbol.path, symbol.start_line, symbol.end_line)
        except SourceReadError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        store.put_region(region)
        signature = symbol.signature or symbol.name
        summary = (
            f"{symbol.kind.replace('_', ' ').title()} `{symbol.qualified_name}` is declared "
            f"in `{symbol.path}` at lines {symbol.start_line}-{symbol.end_line}."
        )
        documentation = (
            f"{summary}\n\nSource declaration: `{signature}`. "
            "No separate authored component documentation was found; the source below is authoritative."
        )
        dependencies = _symbol_dependencies(job, store, symbol, region.text)
        return _component_response(
            job=job,
            component_id=symbol.id,
            kind=symbol.kind,
            name=symbol.name,
            qualified_name=symbol.qualified_name,
            summary=summary,
            documentation=documentation,
            path=symbol.path,
            language=symbol.language,
            start_line=region.start_line,
            end_line=region.end_line,
            text=region.text,
            dependencies=dependencies,
        )

    overview = store.get_system_overview(job.run_id) or _overview(request, job)
    component = next((item for item in overview.main_components if item.id == component_id), None)
    if not component or component.kind != "module" or not component.related_file_paths:
        raise HTTPException(status_code=404, detail="Documentation component not found.")
    path = component.related_file_paths[0]
    try:
        file = reader.get_file(path)
        region = reader.read_range(path, 1, max(1, min(file.line_count, 2_000)))
    except SourceReadError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    store.put_region(region)
    dependencies = _module_dependencies(overview, component_id)
    documentation = (
        f"{component.summary}\n\nThis description is derived from parsed declarations in `{path}`. "
        "The source excerpt below is authoritative."
    )
    return _component_response(
        job=job,
        component_id=component.id,
        kind="module",
        name=path,
        qualified_name=path,
        summary=component.summary,
        documentation=documentation,
        path=path,
        language=file.language,
        start_line=region.start_line,
        end_line=region.end_line,
        text=region.text,
        dependencies=dependencies,
    )


#: Producer name recorded on every ArchitecturalClaim the generation
#: endpoint produces (mirrors the architectural-explanation route's
#: PRODUCER_NAME convention -- a stable service label, not a model id).
DOCS_GENERATION_PRODUCER_NAME = "docs-component-generation-service"

#: For a module target, the claim pipeline runs per top-level symbol; cap
#: how many are verified so one click never fans out into an unbounded
#: number of LLM proposal calls.
_MODULE_TARGET_SYMBOL_LIMIT = 3


@router.post(
    "/components/{component_id:path}/generate",
    response_model=ComponentDocGenerationResponse,
)
def generate_component_documentation_route(
    component_id: str, request: Request, run_id: str | None = None
) -> ComponentDocGenerationResponse:
    """Evidence-grounded LLM documentation for one hierarchy component.

    deterministic component facts + deterministically verified claims
    -> one LLM writing call -> structured, labeled AI documentation.

    Reuses the architectural-explanation provider/runtime configuration
    boundary (never a second provider system) and its L1/L2 claim
    pipeline unchanged. When no AI is configured, returns an honest
    ``ai_generated=False`` body -- never fabricated prose; when a
    configured provider fails, raises the same style of 503 the
    architectural-explanation route uses.
    """
    job = resolve_ready_run(request, run_id)
    store = _store(request)
    target_symbol_ids, component_facts = _resolve_generation_target(
        request, job, store, component_id
    )

    # Same private helpers the architectural-explanation route itself uses
    # (imported lazily to keep route modules order-independent): one
    # provider stack, one runtime-settings boundary, one claim pipeline.
    from syntax_tree_refurbished.api.routes import architectural_explanation as arch_routes

    settings = arch_routes._settings(request)
    model = _generation_model(request, settings)
    provider = settings.arch_explanation_llm_provider

    if isinstance(model, NoConfiguredModel):
        return ComponentDocGenerationResponse(
            analysis_run_id=job.run_id,
            component_id=component_id,
            ai_generated=False,
            unavailable_reason="not_configured",
            message=(
                "AI documentation generation is not configured. "
                "Deterministic documentation remains available."
            ),
            run_metadata=DocGenerationRunMetadata(provider=provider, model="none"),
        )

    proposer = arch_routes._proposer(request)
    symbols = store.get_symbols(job.run_id)
    relations = store.get_relations(job.run_id)
    resolver = arch_routes._source_region_resolver(store, job)

    try:
        claims: list[ArchitecturalClaim] = []
        seen_claim_ids: set[str] = set()
        for target_id in target_symbol_ids:
            for claim in verify_target_entity(
                run_id=job.run_id,
                target_entity_id=target_id,
                symbols=symbols,
                relations=relations,
                proposer=proposer,
                producer_name=DOCS_GENERATION_PRODUCER_NAME,
                source_region_resolver=resolver,
            ):
                if claim.id not in seen_claim_ids:
                    seen_claim_ids.add(claim.id)
                    claims.append(claim)

        generated = generate_component_documentation(
            model=model,
            component_facts=component_facts,
            claims=tuple(claims),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "documentation_generation_unavailable",
                "message": "The configured language-model provider could not be reached.",
            },
        ) from exc

    return ComponentDocGenerationResponse(
        analysis_run_id=job.run_id,
        component_id=component_id,
        ai_generated=True,
        purpose=generated.purpose,
        responsibilities=list(generated.responsibilities),
        relationship_notes=[
            RelationshipNoteDTO(claim_id=note.claim_id, note=note.note)
            for note in generated.relationship_notes
        ],
        discarded_relationship_notes=generated.discarded_relationship_notes,
        claims=[ArchitecturalClaimDTO.from_domain(claim) for claim in claims],
        supported_count=sum(1 for c in claims if c.support_status == "supported"),
        insufficient_evidence_count=sum(
            1 for c in claims if c.support_status == "insufficient_evidence"
        ),
        run_metadata=DocGenerationRunMetadata(
            provider=provider,
            model=generated.model,
            tokens_in=generated.tokens_in,
            tokens_out=generated.tokens_out,
            latency_ms=generated.latency_ms,
        ),
    )


def _generation_model(request: Request, effective_settings: Settings) -> InvestigationModel:
    """Model used for the documentation-writing call: a test-injection
    hook first (``app.state.docs_generation_model``), else the SAME
    architectural-explanation provider/runtime configuration the claim
    proposer uses (``make_arch_explanation_model`` + the Settings-UI
    runtime credential) -- deliberately never a second provider system."""
    injected = getattr(request.app.state, "docs_generation_model", None)
    if injected is not None:
        return injected
    if (
        effective_settings.environment != "test"
        and effective_settings.arch_explanation_llm_configured
    ):
        runtime = request.app.state.arch_explanation_runtime_config
        api_key = runtime.resolve_api_key(request.app.state.settings)
        return make_arch_explanation_model(effective_settings, api_key_override=api_key)
    return NoConfiguredModel()


def _resolve_generation_target(
    request: Request, job: AnalysisJob, store: InMemoryRunStore, component_id: str
) -> tuple[list[str], str]:
    """Resolve a hierarchy component id to (claim target symbol ids,
    deterministic component-facts text). 404s for unknown components,
    mirroring ``documentation_component``'s resolution order: parsed
    symbol first, then module component."""
    symbol = store.get_symbol(component_id)
    if symbol and symbol.run_id == job.run_id:
        return [symbol.id], _symbol_facts(store, job, symbol)

    overview = store.get_system_overview(job.run_id) or _overview(request, job)
    component = next((item for item in overview.main_components if item.id == component_id), None)
    if not component or component.kind != "module" or not component.related_file_paths:
        raise HTTPException(status_code=404, detail="Documentation component not found.")
    path = component.related_file_paths[0]
    top_level = sorted(
        (s for s in store.get_symbols(job.run_id) if s.path == path and not s.parent_symbol_id),
        key=lambda s: s.start_line,
    )
    targets = [s.id for s in top_level[:_MODULE_TARGET_SYMBOL_LIMIT]]
    return targets, _module_facts(component.summary, path, top_level)


def _symbol_facts(store: InMemoryRunStore, job: AnalysisJob, symbol: ParsedSymbol) -> str:
    lines = [
        f"kind: {symbol.kind}",
        f"name: {symbol.name}",
        f"qualified_name: {symbol.qualified_name}",
        f"path: {symbol.path}",
        f"lines: {symbol.start_line}-{symbol.end_line}",
        f"signature: {symbol.signature or symbol.name}",
    ]
    if symbol.parent_symbol_id:
        parent = store.get_symbol(symbol.parent_symbol_id)
        if parent:
            lines.append(f"declared inside: {parent.kind} {parent.qualified_name}")
    children = sorted(
        (s for s in store.get_symbols(job.run_id) if s.parent_symbol_id == symbol.id),
        key=lambda s: s.start_line,
    )
    if children:
        lines.append("contains:")
        for child in children[:20]:
            lines.append(f"  - {child.kind} {child.name} (lines {child.start_line}-{child.end_line})")
        if len(children) > 20:
            lines.append(f"  - ... and {len(children) - 20} more")
    return "\n".join(lines)


def _module_facts(summary: str, path: str, top_level: list[ParsedSymbol]) -> str:
    lines = [
        "kind: module",
        f"path: {path}",
    ]
    if summary:
        lines.append(f"parser-derived summary: {summary}")
    if top_level:
        lines.append("top-level declarations:")
        for symbol in top_level[:20]:
            lines.append(
                f"  - {symbol.kind} {symbol.name} (lines {symbol.start_line}-{symbol.end_line})"
            )
        if len(top_level) > 20:
            lines.append(f"  - ... and {len(top_level) - 20} more")
    else:
        lines.append("top-level declarations: (none parsed)")
    return "\n".join(lines)


@router.post("/plan")
def plan_docs(request: Request, body: DocPlanRequest, run_id: str | None = None) -> dict:
    if not body.user_request.strip():
        raise HTTPException(422, "user_request is required.")
    normalized_refs = _normalize_references(body.references or [])
    controller = _controller(request, run_id)
    plan = controller.create_plan(
        scope_qn=body.scope_qn,
        artifact_type=body.artifact_type,
        user_request=body.user_request,
        references=normalized_refs,
        max_words=body.max_words,
    )
    plan["_created_at"] = time.time()
    DOC_PLANS[plan["plan_id"]] = plan
    _cleanup_stale_plans()
    return plan


@router.post("/generate")
def generate_docs(request: Request, body: GenerateDocsRequest, run_id: str | None = None) -> dict:
    plan = DOC_PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(404, f"Documentation plan not found: {body.plan_id}")
    plan = _apply_plan_edits(plan, body)
    controller = _controller(request, run_id)
    return controller.generate_from_plan(plan)


def _controller(request: Request, run_id: str | None) -> DocsController:
    job = _resolve_run(request, run_id)
    return DocsController(
        job=job,
        store=_store(request),
        overview=_overview(request, job),
        model=_model(request),
    )


def _overview(request: Request, job: AnalysisJob) -> SystemOverview:
    return SystemOverviewGenerator(
        job=job,
        store=_store(request),
        model=_model(request),
    ).get_or_generate()


def _resolve_run(request: Request, run_id: str | None) -> AnalysisJob:
    return resolve_ready_run(request, run_id)


def _model(request: Request) -> InvestigationModel:
    injected = getattr(request.app.state, "investigation_model", None)
    if injected is not None:
        return injected
    settings = _settings(request)
    if settings.environment == "test":
        return NoConfiguredModel()
    return make_live_model(settings)


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store


def _normalize_references(references: list[Any]) -> list[str]:
    normalized: list[str] = []
    for item in references:
        if isinstance(item, str):
            value = item.strip()
        elif isinstance(item, dict):
            value = str(item.get("qualified_name") or item.get("id") or item.get("label") or "").strip()
        else:
            value = str(item or "").strip()
        if value:
            normalized.append(value)
    return normalized


def _apply_plan_edits(plan: dict, req: GenerateDocsRequest) -> dict:
    updated = dict(plan)
    for field in ("title", "outline", "assumptions", "evidence_targets", "risks"):
        value = getattr(req, field, None)
        if value is not None:
            updated[field] = value
    DOC_PLANS[updated["plan_id"]] = updated
    return updated


def _component_response(
    *,
    job: AnalysisJob,
    component_id: str,
    kind: str,
    name: str,
    qualified_name: str,
    summary: str,
    documentation: str,
    path: str,
    language: str,
    start_line: int,
    end_line: int,
    text: str,
    dependencies: list[dict],
) -> dict:
    return {
        "analysis_run_id": job.run_id,
        "id": component_id,
        "kind": kind,
        "name": name,
        "qualified_name": qualified_name,
        "summary": summary,
        "documentation": documentation,
        "source": {
            "path": path,
            "language": language,
            "start_line": start_line,
            "end_line": end_line,
            "text": text,
        },
        "dependencies": dependencies,
    }


def _module_dependencies(overview: SystemOverview, component_id: str) -> list[dict]:
    components = {component.id: component for component in overview.main_components}
    output: list[dict] = []
    for relationship in overview.relationships:
        if relationship.from_component_id == component_id:
            related_id = relationship.to_component_id
            kind = relationship.label
        elif relationship.to_component_id == component_id:
            related_id = relationship.from_component_id
            kind = f"{relationship.label}_by"
        else:
            continue
        related = components.get(related_id)
        if not related:
            continue
        path = related.related_file_paths[0] if related.related_file_paths else related.label
        output.append({"id": related.id, "kind": kind, "name": related.label, "path": path})
    return output


def _symbol_dependencies(job: AnalysisJob, store: InMemoryRunStore, symbol, source: str) -> list[dict]:
    """Return declaration references visible in this exact source region."""
    source_lower = source.lower()
    output: list[dict] = []
    for candidate in store.get_symbols(job.run_id):
        if candidate.id == symbol.id or len(candidate.name) < 3:
            continue
        if candidate.name.lower() not in source_lower:
            continue
        output.append({
            "id": candidate.id,
            "kind": "references",
            "name": candidate.name,
            "path": candidate.path,
        })
        if len(output) >= 40:
            break
    return output
