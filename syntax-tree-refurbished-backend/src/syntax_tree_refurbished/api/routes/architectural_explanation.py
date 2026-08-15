"""V2 vertical-slice routes: verified claims + full architectural
explanations for one target entity.

Integrated (Phase 6) from three independently-built, independently-tested
workstreams:
    L1 app.architectural_explanation.llm_claim_proposer.LLMClaimProposer
    L2 app.architectural_explanation.verification_service.verify_target_entity
    L3 app.architectural_explanation.explanation_composer.compose_architectural_explanation
Integration added here is thin glue only: proposer selection (mirroring
``api/routes/query.py``'s existing ``_model(request)`` pattern) and
chaining L2's output straight into L3 -- no new business logic, no new
verification/composition rules.

Two routes:

- ``POST /api/entities/{entity_id:path}/claims`` (L2's own route, unchanged
  from that workstream): verified claims only, no narrative.
- ``POST /api/entities/{entity_id:path}/architectural-explanation``: the
  full contract documented in ``api/dto/architectural_explanation.py``'s
  module docstring -- calls the same L2 pipeline, then L3's composer, and
  returns claims + narrative together. This is the endpoint the L4
  frontend slice calls.

``{entity_id:path}`` is the greedy path converter (real symbol ids can
contain ``:`` and other characters the plain-string converter would
mis-split), matching the ``{lens_id:path}`` convention already used by
``api/routes/query.py``/``api/routes/claims.py``. Both of this router's
routes carry their own distinguishing suffix (``/claims`` and
``/architectural-explanation``), so neither introduces a greedy-route-
ordering hazard of its own.

Registered in ``api/app.py`` as of this integration -- no longer an
unregistered experimental stub.
"""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, HTTPException, Request

from syntax_tree_refurbished.api.dto.architectural_explanation import (
    ArchitecturalExplanationResponse,
    EntityClaimsResponse,
)
from syntax_tree_refurbished.api.dto.provenance import ArchitecturalClaimDTO
from syntax_tree_refurbished.api.run_resolution import resolve_ready_run
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.architectural_explanation.claim_proposer import (
    ClaimProposer,
    NullClaimProposer,
)
from syntax_tree_refurbished.app.architectural_explanation.explanation_composer import (
    compose_architectural_explanation,
)
from syntax_tree_refurbished.app.architectural_explanation.llm_claim_proposer import LLMClaimProposer
from syntax_tree_refurbished.app.architectural_explanation.verification_service import (
    verify_target_entity,
)
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.app.investigation.llm_model import make_arch_explanation_model
from syntax_tree_refurbished.app.provenance.relation_adapter import SourceRegionResolver
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.provenance import ArchitecturalClaim, ProducerInfo


router = APIRouter(tags=["architectural-explanation"])

#: producer name recorded on every ArchitecturalClaim these routes produce.
#: Distinct from any particular LLM model id (that lives on
#: ProducerInfo.name via the proposer's own model_name when a live model IS
#: configured) -- kept as a fixed, stable label identifying which service
#: produced the claim, matching the pattern other producers in this
#: codebase already use (e.g. "python_call_extractor").
PRODUCER_NAME = "architectural-explanation-verification-service"


@router.post("/entities/{entity_id:path}/claims", response_model=EntityClaimsResponse)
def post_entity_claims(entity_id: str, request: Request, run_id: str | None = None) -> EntityClaimsResponse:
    job = resolve_ready_run(request, run_id)
    store = _store(request)
    symbols = _require_known_entity(store, job.run_id, entity_id)
    relations = store.get_relations(job.run_id)
    proposer = _proposer(request)

    claims = _verify_claims_or_503(
        run_id=job.run_id,
        target_entity_id=entity_id,
        symbols=symbols,
        relations=relations,
        proposer=proposer,
        source_region_resolver=_source_region_resolver(store, job),
    )

    dtos = [ArchitecturalClaimDTO.from_domain(claim) for claim in claims]
    supported_count = sum(1 for claim in claims if claim.support_status == "supported")
    insufficient_evidence_count = sum(
        1 for claim in claims if claim.support_status == "insufficient_evidence"
    )
    return EntityClaimsResponse(
        analysis_run_id=job.run_id,
        target_id=entity_id,
        claims=dtos,
        supported_count=supported_count,
        insufficient_evidence_count=insufficient_evidence_count,
    )


@router.post(
    "/entities/{entity_id:path}/architectural-explanation",
    response_model=ArchitecturalExplanationResponse,
)
def post_entity_architectural_explanation(
    entity_id: str, request: Request, run_id: str | None = None
) -> ArchitecturalExplanationResponse:
    job = resolve_ready_run(request, run_id)
    store = _store(request)
    symbols = _require_known_entity(store, job.run_id, entity_id)
    relations = store.get_relations(job.run_id)
    proposer = _proposer(request)

    claims = _verify_claims_or_503(
        run_id=job.run_id,
        target_entity_id=entity_id,
        symbols=symbols,
        relations=relations,
        proposer=proposer,
        source_region_resolver=_source_region_resolver(store, job),
    )

    explanation_id = _explanation_id(run_id=job.run_id, target_id=entity_id, claims=claims)
    explanation = compose_architectural_explanation(
        explanation_id=explanation_id,
        run_id=job.run_id,
        target_kind="entity",
        target_id=entity_id,
        claims=claims,
        producer=ProducerInfo(producer_type="llm", name=PRODUCER_NAME, version=""),
    )
    return ArchitecturalExplanationResponse.from_domain(explanation)


def _verify_claims_or_503(
    *,
    run_id: str,
    target_entity_id: str,
    symbols: tuple[ParsedSymbol, ...],
    relations: tuple[ObservedProgramRelation, ...],
    proposer: ClaimProposer,
    source_region_resolver: SourceRegionResolver,
) -> tuple[ArchitecturalClaim, ...]:
    """Wraps ``verify_target_entity`` so a genuinely-configured-but-failing
    live LLM (network error, timeout, HTTP error -- ``LLMClaimProposer
    .propose_claims`` re-raises these as ``RuntimeError``, per its own
    docstring) surfaces as a distinguishable 503, not an unhandled 500.

    This is what lets the frontend show "Architectural explanation
    unavailable" with Retry/Open Settings instead of a blank panel or a
    raw stack trace (task requirement: LLM failure must never disable
    repository analysis or architecture exploration, and must never
    crash/blank the UI). A disabled/unconfigured proposer never reaches
    this path at all -- ``NullClaimProposer``/``_proposer`` already
    degrade to zero proposals without raising, which is a normal 200
    response, not an error.
    """
    try:
        return verify_target_entity(
            run_id=run_id,
            target_entity_id=target_entity_id,
            symbols=symbols,
            relations=relations,
            proposer=proposer,
            producer_name=PRODUCER_NAME,
            source_region_resolver=source_region_resolver,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "architectural_explanation_unavailable",
                "message": "The configured language-model provider could not be reached.",
            },
        ) from exc


def _require_known_entity(
    store: InMemoryRunStore, run_id: str, entity_id: str
) -> tuple[ParsedSymbol, ...]:
    symbols = store.get_symbols(run_id)
    if not any(symbol.id == entity_id for symbol in symbols):
        raise HTTPException(status_code=404, detail="Entity not found in this analysis run.")
    return symbols


def _explanation_id(*, run_id: str, target_id: str, claims: tuple[ArchitecturalClaim, ...]) -> str:
    """Deterministic id: same run/target/claim-set always yields the same
    id, mirroring the short-sha1-based scheme already used throughout
    ``core.models.provenance`` (``_stable_id``) -- duplicated inline here
    rather than importing that private helper."""
    raw = "|".join([run_id, target_id, *(claim.id for claim in claims)])
    return f"explanation:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


def _source_region_resolver(store: InMemoryRunStore, job: AnalysisJob) -> SourceRegionResolver:
    """Build the production ``SourceRegionResolver`` (see
    ``app.provenance.relation_adapter``'s docstring for the contract):
    resolves a relation's raw ``(path, start_line, end_line)`` span into a
    real, persisted ``SourceRegion`` id via the SAME ``SourceReader``
    abstraction ``POST /api/evidence/read-range`` already uses (see
    ``api/routes/source.py``) -- no second source-location model, no
    fabrication. Persisting the region (``store.put_region``) is what makes
    the id the frontend later requests via ``GET /api/source-regions/{id}``
    actually resolvable; ``stable_region_id`` is deterministic per
    (run_id, path, start_line, end_line, content_hash, region_type), so
    resolving the same span twice (e.g. two relations sharing one call
    site) is a safe, idempotent no-op re-persist, not a duplicate.

    Returns ``None`` (never raises) when the span can't be read -- e.g. the
    file was deleted between analysis and this request, or the span is out
    of range -- so a relation with a genuinely unusable span degrades to
    "no source navigation for this item", never a 500 or a fabricated
    region.
    """
    reader = SourceReader(job)

    def resolve(path: str, start_line: int, end_line: int) -> str | None:
        try:
            region = reader.read_range(path, start_line, end_line)
        except SourceReadError:
            return None
        store.put_region(region)
        return region.id

    return resolve


def _proposer(request: Request) -> ClaimProposer:
    """Mirrors api/routes/query.py's ``_model(request)`` selection logic:
    a test-injection hook on ``request.app.state`` first (so tests never
    need a live model), else a real ``LLMClaimProposer`` wrapping
    ``make_arch_explanation_model(settings)`` when architectural
    explanations are independently enabled and configured (Phase 3 --
    ``Settings.arch_explanation_llm_configured``, deliberately NOT the
    legacy ``settings.live_llm_configured`` that gates architecture-map/
    investigation-engine generation), else ``NullClaimProposer`` (zero
    proposals, never an error).

    ``settings`` here is the EFFECTIVE settings (env vars merged with any
    Settings-UI runtime override -- see ``_settings``), so a value saved
    through the Settings screen takes effect immediately without a
    process restart, exactly like an env var would. The matching
    runtime-stored API key (if any) is passed as ``api_key_override``.
    """
    injected = getattr(request.app.state, "claim_proposer", None)
    if injected is not None:
        return injected
    settings = _settings(request)
    if settings.environment != "test" and settings.arch_explanation_llm_configured:
        runtime = request.app.state.arch_explanation_runtime_config
        api_key = runtime.resolve_api_key(request.app.state.settings)
        return LLMClaimProposer(make_arch_explanation_model(settings, api_key_override=api_key))
    return NullClaimProposer()


def _settings(request: Request) -> Settings:
    """Effective settings: the env-loaded base merged with any saved
    Settings-UI runtime override (``ArchExplanationRuntimeConfig
    .effective_settings``). Falls back to the raw base unchanged when
    nothing has been saved, which is what keeps env-var configuration
    working (this route's LLM failure/availability behavior is otherwise
    unaffected by this round)."""
    runtime = getattr(request.app.state, "arch_explanation_runtime_config", None)
    base = request.app.state.settings
    if runtime is None:
        return base
    return runtime.effective_settings(base)


def _store(request: Request) -> InMemoryRunStore:
    return request.app.state.run_store
