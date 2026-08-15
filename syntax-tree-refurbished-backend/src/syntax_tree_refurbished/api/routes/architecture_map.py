"""Architecture-map compatibility routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from syntax_tree_refurbished.api.dto.architecture_map import (
    ArchitectureMapChildrenResponse,
    ArchitectureMapEdgeDTO,
    ArchitectureMapEvidenceDTO,
    ArchitectureMapEvidenceResponse,
    ArchitectureMapNeighborhoodResponse,
    ArchitectureMapNodeDTO,
    ArchitectureMapResponse,
    ArchitectureNodeExplanationDTO,
    ExplanationClaimDTO,
    ExplanationFileDTO,
    ExplanationRelationshipDTO,
    ImplementationSliceDTO,
)
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.architecture_map.projection import ArchitectureMapProjector
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.core.models.system_overview import SystemOverview


router = APIRouter(tags=["architecture-map"])


@router.get("/architecture-map", response_model=ArchitectureMapResponse)
def architecture_map(request: Request, run_id: str | None = None) -> ArchitectureMapResponse:
    projection = _projector(request, run_id).project()
    return ArchitectureMapResponse.from_domain(projection)


@router.get("/architecture-map/nodes/{node_id:path}/children", response_model=ArchitectureMapChildrenResponse)
def architecture_map_node_children(
    node_id: str,
    request: Request,
    run_id: str | None = None,
) -> ArchitectureMapChildrenResponse:
    projector = _projector(request, run_id)
    if not projector.node(node_id):
        raise HTTPException(status_code=404, detail="Architecture map node not found.")
    children, edges = projector.children(node_id)
    job = _resolve_run(request, run_id)
    return ArchitectureMapChildrenResponse(
        analysis_run_id=job.run_id,
        node_id=node_id,
        children=[ArchitectureMapNodeDTO.from_domain(node) for node in children],
        edges=[ArchitectureMapEdgeDTO.from_domain(edge) for edge in edges],
        total=len(children),
    )


@router.get("/architecture-map/nodes/{node_id:path}/neighborhood", response_model=ArchitectureMapNeighborhoodResponse)
def architecture_map_node_neighborhood(
    node_id: str,
    request: Request,
    run_id: str | None = None,
) -> ArchitectureMapNeighborhoodResponse:
    projector = _projector(request, run_id)
    if not projector.node(node_id):
        raise HTTPException(status_code=404, detail="Architecture map node not found.")
    dependencies, dependents, edges = projector.neighborhood(node_id)
    job = _resolve_run(request, run_id)
    return ArchitectureMapNeighborhoodResponse(
        analysis_run_id=job.run_id,
        node_id=node_id,
        dependencies=[ArchitectureMapNodeDTO.from_domain(node) for node in dependencies],
        dependents=[ArchitectureMapNodeDTO.from_domain(node) for node in dependents],
        edges=[ArchitectureMapEdgeDTO.from_domain(edge) for edge in edges],
    )


@router.get("/architecture-map/nodes/{node_id:path}/evidence", response_model=ArchitectureMapEvidenceResponse)
def architecture_map_node_evidence(
    node_id: str,
    request: Request,
    run_id: str | None = None,
    limit: int = Query(default=40, ge=1, le=100),
) -> ArchitectureMapEvidenceResponse:
    projector = _projector(request, run_id)
    node = projector.node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Architecture map node not found.")
    evidence = projector.evidence(node_id, limit=limit)
    return ArchitectureMapEvidenceResponse(
        analysis_run_id=node.analysis_run_id,
        node_id=node.id,
        node=ArchitectureMapNodeDTO.from_domain(node),
        evidence=[ArchitectureMapEvidenceDTO.from_domain(item) for item in evidence],
        total=len(evidence),
        limit=limit,
    )


@router.get("/architecture-map/nodes/{node_id:path}/explanation", response_model=ArchitectureNodeExplanationDTO)
def architecture_map_node_explanation(
    node_id: str,
    request: Request,
    run_id: str | None = None,
) -> ArchitectureNodeExplanationDTO:
    projector = _projector(request, run_id)
    node = projector.node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Architecture map node not found.")
    overview = _overview(request, _resolve_run(request, run_id))
    evidence = projector.evidence(node_id, limit=40)
    component = next((item for item in overview.main_components if item.id == node_id), None)
    evidence_ids = [item.id for item in evidence]
    responsibilities = [
        ExplanationClaimDTO(text=text, support=node.status if node.status != "candidate" else "inferred", evidence_ids=evidence_ids)
        for text in (component.responsibilities if component else ())
    ]
    if not responsibilities and node.description:
        responsibilities = [ExplanationClaimDTO(text=node.description, support=node.status if evidence_ids else "insufficient", evidence_ids=evidence_ids)]
    relationships = [
        ExplanationRelationshipDTO(label=edge.label or edge.kind, reason=edge.summary, target_id=edge.to_component_id)
        for edge in overview.relationships
        if edge.from_component_id == node_id
    ]
    key_files = [
        ExplanationFileDTO(file_path=path, reason="Primary source evidence for this architecture node.", evidence_ids=evidence_ids)
        for path in node.primary_files[:8]
    ]
    return ArchitectureNodeExplanationDTO(
        analysis_run_id=node.analysis_run_id,
        node_id=node.id,
        status=node.status,
        generation_status="cached" if overview.metrics.llm_used else "fallback_no_llm",
        model=overview.metrics.model,
        summary=node.description,
        simple_explanation=node.description,
        technical_explanation=node.description,
        responsibilities=responsibilities,
        what_happens=[
            ExplanationClaimDTO(
                text=f"{node.evidence_count} source-backed evidence item(s) support this node.",
                support="verified" if evidence_ids else "insufficient",
                evidence_ids=evidence_ids,
            )
        ],
        key_files=key_files,
        relationships=relationships,
        gaps=list(node.warnings),
        warnings=list(node.warnings),
        suggested_questions=list(overview.suggested_questions[:6]),
        evidence_ids=evidence_ids,
        prompt_hash="system-overview",
        input_hash=overview.input_hash,
        reason=None if evidence_ids else "No source evidence was attached to this node.",
    )


@router.get("/architecture-map/nodes/{node_id:path}/implementation", response_model=ImplementationSliceDTO)
def architecture_map_node_implementation(
    node_id: str,
    request: Request,
    run_id: str | None = None,
) -> ImplementationSliceDTO:
    projector = _projector(request, run_id)
    if not projector.node(node_id):
        raise HTTPException(status_code=404, detail="Architecture map node not found.")
    return ImplementationSliceDTO.from_domain(
        projector.implementation_slice(subject_type="architecture_node", subject_id=node_id)
    )


@router.get("/implementation-slices", response_model=ImplementationSliceDTO)
def implementation_slice(
    request: Request,
    subject_type: str,
    subject_id: str,
    run_id: str | None = None,
) -> ImplementationSliceDTO:
    return ImplementationSliceDTO.from_domain(
        _projector(request, run_id).implementation_slice(subject_type=subject_type, subject_id=subject_id)
    )


@router.get("/architecture-map/nodes/{node_id:path}", response_model=ArchitectureMapNodeDTO)
def architecture_map_node(node_id: str, request: Request, run_id: str | None = None) -> ArchitectureMapNodeDTO:
    node = _projector(request, run_id).node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Architecture map node not found.")
    return ArchitectureMapNodeDTO.from_domain(node)


def _projector(request: Request, run_id: str | None) -> ArchitectureMapProjector:
    job = _resolve_run(request, run_id)
    return ArchitectureMapProjector(job=job, store=_store(request), overview=_overview(request, job), model=_model(request))


def _overview(request: Request, job: AnalysisJob) -> SystemOverview:
    return SystemOverviewGenerator(
        job=job,
        store=_store(request),
        model=_model(request),
    ).get_or_generate()


def _resolve_run(request: Request, run_id: str | None) -> AnalysisJob:
    return resolve_ready_run(request, run_id)


def _model(request: Request) -> InvestigationModel:
    """Every route in this file reads through here -- the main map, every
    ``/children`` drilldown, evidence, node lookup, AND the "Simple
    explanation" panel (``/nodes/{id}/explanation``), which the frontend
    fetches automatically the instant any node is selected/entered
    (ObservatoryShell.tsx's ``explanationNode = lens.selectedNode ??
    lens.focalNode`` feeding ``useNodeExplanation``), not only on some
    separate explicit "explain this" action. Previously this resolved
    ``make_live_model(settings)`` outside test mode, so merely opening the
    map or clicking through it would silently fire a real request at
    whatever legacy provider happened to be configured (see qa-audit's
    live-openai-validation blocker: a stale legacy model producing a raw
    HTTP 400 in the Simple explanation panel from ordinary navigation, not
    a deliberate "explain" click). AnalysisController already made a
    deliberate choice to keep the architecture-map structure stage on
    NoConfiguredModel(); this route file now applies that same choice
    consistently to every read it serves, so map navigation can never
    trigger legacy provider traffic on its own. The real,
    OpenAI-configurable architectural-explanation path
    (make_arch_explanation_model, api/routes/architectural_explanation.py)
    is untouched -- it is a separate, explicitly user-triggered feature.
    """
    injected = getattr(request.app.state, "investigation_model", None)
    if injected is not None:
        return injected
    return NoConfiguredModel()


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store
