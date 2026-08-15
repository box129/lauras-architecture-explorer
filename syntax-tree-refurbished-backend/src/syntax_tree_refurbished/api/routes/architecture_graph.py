"""Read-only deterministic architecture graph endpoint (G0)."""
from fastapi import APIRouter, Request
from syntax_tree_refurbished.api.dto.architecture_graph import ArchitectureGraphResponse
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.architecture_graph.projection import ArchitectureGraphProjector
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.app.investigation.llm_model import NoConfiguredModel

router = APIRouter(tags=["architecture-graph"])

@router.get("/architecture-graph", response_model=ArchitectureGraphResponse)
def architecture_graph(request: Request, run_id: str | None = None) -> ArchitectureGraphResponse:
    job = resolve_ready_run(request, run_id)
    store = request.app.state.run_store
    overview = SystemOverviewGenerator(job=job, store=store, model=NoConfiguredModel()).get_or_generate()
    return ArchitectureGraphResponse.from_domain(ArchitectureGraphProjector(job=job, store=store, overview=overview).project())
