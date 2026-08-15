from __future__ import annotations

import json
from fastapi import APIRouter, Request

from syntax_tree_refurbished.api.dto.cluster_interpretation import ClusterInterpretationResponse
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.architecture_clusters.projection import ArchitectureClusterProjector
from syntax_tree_refurbished.app.architecture_cluster_interpretation.service import interpret_cluster
from syntax_tree_refurbished.app.investigation.llm_model import NoConfiguredModel, make_arch_explanation_model
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.api.routes.architectural_explanation import _settings
from fastapi import HTTPException

router = APIRouter(tags=["architecture-graph"])


@router.post("/architecture-graph/clusters/{cluster_id:path}/interpretation", response_model=ClusterInterpretationResponse)
def post_cluster_interpretation(cluster_id: str, request: Request, run_id: str | None = None) -> ClusterInterpretationResponse:
    job = resolve_ready_run(request, run_id)
    store = request.app.state.run_store
    overview = SystemOverviewGenerator(job=job, store=store, model=NoConfiguredModel()).get_or_generate()
    projection = ArchitectureClusterProjector(job=job, store=store, overview=overview).project()
    cluster = next((value for value in projection.clusters if value.id == cluster_id and value.analysis_run_id == job.run_id), None)
    if cluster is None:
        raise HTTPException(status_code=404, detail="Deterministic cluster not found in this analysis run.")
    injected = getattr(request.app.state, "cluster_interpretation_model", None)
    if injected is not None:
        model = injected
    else:
        settings = _settings(request)
        if settings.environment != "test" and settings.arch_explanation_llm_configured:
            runtime = request.app.state.arch_explanation_runtime_config
            model = make_arch_explanation_model(settings, api_key_override=runtime.resolve_api_key(request.app.state.settings))
        else:
            model = NoConfiguredModel()
    try:
        interpretation = interpret_cluster(job=job, store=store, overview=overview, cluster=cluster, model=model)
    except (RuntimeError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        interpretation = None
    return ClusterInterpretationResponse(analysis_run_id=job.run_id, cluster_id=cluster.id, status="available" if interpretation else "unavailable", interpretation=interpretation)
