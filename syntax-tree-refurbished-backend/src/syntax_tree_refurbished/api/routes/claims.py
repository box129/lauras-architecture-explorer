"""EXPERIMENTAL — claim-level provenance route stub.

This router is intentionally NOT imported/registered in api/app.py. It
exists to prove out the ``GET /api/query-lenses/{lens_id}/claims`` contract
documented in api/dto/provenance.py against real lens data, without wiring
a new, not-yet-reviewed route into the live application surface.

What it does: resolves a run + lens exactly like the sibling
``/query-lenses/{lens_id}/evidence`` and ``.../implementation`` routes in
api/routes/query.py, then reshapes whatever GroundedClaim data that lens
already carries into ArchitecturalClaim/EvidenceChain records via
app/provenance/claim_projection.py. It does not discover new claims and it
does not call an LLM.

What it deliberately does NOT handle: lenses produced by the degraded
(no-LLM) local-search fallback are plain dicts (see
app/query/local_search.py LocalSearchEngine.lens_for_subject) rather than
core.models.lens.Lens instances, and carry claim data in a different, less
structured shape. For those, this stub returns an empty claims list rather
than guessing at a mapping — that reshaping is future work, not something
this contract-definition task should invent.

To wire this in for real:
    from syntax_tree_refurbished.api.routes.claims import router as claims_router
    app.include_router(claims_router, prefix="/api")
in api/app.py. Register it *after* the existing query_router registration,
consistent with the {lens_id:path} greedy-match ordering note already
documented in api/routes/query.py (a bare .../{lens_id:path} route must not
be registered ahead of more specific suffixed routes it would otherwise
swallow). This route's own path already carries the /claims suffix so it
does not itself introduce a new ordering hazard; the note is about not
placing it accidentally ahead of some future bare route.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.provenance import ArchitecturalClaimDTO, LensClaimsResponse
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.investigation.llm_model import NoConfiguredModel
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.app.provenance.claim_projection import architectural_claims_for_lens
from syntax_tree_refurbished.app.query.query_controller import QueryController
from syntax_tree_refurbished.core.models.lens import Lens


router = APIRouter(tags=["provenance-experimental"])


@router.get("/query-lenses/{lens_id:path}/claims", response_model=LensClaimsResponse)
def get_query_lens_claims(lens_id: str, request: Request, run_id: str | None = None) -> LensClaimsResponse:
    job = resolve_ready_run(request, run_id)
    store = _store(request)
    controller = QueryController(
        job=job,
        store=store,
        overview=_overview(job, store),
        model=NoConfiguredModel(),
    )
    lens = controller.get_lens(lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Question lens not found.")

    if not isinstance(lens, Lens):
        # Degraded (no-LLM) local-search lens shape — see module docstring.
        return LensClaimsResponse(analysis_run_id=job.run_id, lens_id=lens_id, claims=[], total=0)

    claims = architectural_claims_for_lens(
        lens.claims, run_id=job.run_id, store=store, lens_id=lens_id
    )
    dtos = [ArchitecturalClaimDTO.from_domain(claim) for claim in claims]
    return LensClaimsResponse(analysis_run_id=job.run_id, lens_id=lens_id, claims=dtos, total=len(dtos))


def _overview(job: AnalysisJob, store: InMemoryRunStore):
    return SystemOverviewGenerator(job=job, store=store, model=NoConfiguredModel()).get_or_generate()


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store
