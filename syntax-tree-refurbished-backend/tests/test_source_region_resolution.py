"""Tests for source-backed evidence navigation (Phase 1 of the "final
product hardening" round): every RelationshipEvidence built from a relation
that has a real source span must carry a resolvable ``source_region_id``,
via the ``source_region_resolver`` hook threaded through
``relationship_evidence_from_relations`` -> ``claim_from_proposition`` ->
``verify_target_entity``.

These tests exercise the resolver contract directly with fake resolvers
(no filesystem, no FastAPI) -- the production resolver
(``api.routes.architectural_explanation._source_region_resolver``, backed
by ``SourceReader``/the run store) is exercised end-to-end by
``test_architectural_explanation_route.py``'s
``test_architectural_explanation_endpoint_supported_claim_has_navigable_source``.
"""

from __future__ import annotations

from syntax_tree_refurbished.app.provenance.relation_adapter import (
    claim_from_proposition,
    relationship_evidence_from_relations,
)
from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ResolutionEvidenceSpan,
)
from syntax_tree_refurbished.core.models.provenance import ClaimProposition, ProducerInfo


PRODUCER = ProducerInfo(producer_type="extractor", name="test.source_region_resolution", version="v1")
RUN_ID = "run-1"
CALLER = "pkg.Caller.run"
CALLEE = "pkg.Callee.work"


def _relation(**overrides) -> ObservedProgramRelation:
    kwargs = dict(
        run_id=RUN_ID,
        relation_kind="calls",
        source_entity_id=CALLER,
        target_entity_id=CALLEE,
        extractor_name="python_call_extractor",
        extractor_version="0.3.0",
        resolution_status="resolved",
        span_path="pkg/caller.py",
        span_start_line=42,
        span_end_line=42,
    )
    kwargs.update(overrides)
    return ObservedProgramRelation.create(**kwargs)


def _recording_resolver(calls: list[tuple[str, int, int]], *, region_id: str = "region:fixed") -> callable:
    def resolve(path: str, start_line: int, end_line: int) -> str | None:
        calls.append((path, start_line, end_line))
        return region_id

    return resolve


# ---------------------------------------------------------------------------
# relationship_evidence_from_relations
# ---------------------------------------------------------------------------


def test_relation_with_span_and_resolver_yields_navigable_evidence() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls, region_id="region:abc123")
    relation = _relation()

    items = relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolver
    )

    assert len(items) == 1
    assert items[0].source_region_id == "region:abc123"
    assert calls == [("pkg/caller.py", 42, 42)]


def test_exact_line_range_is_preserved_when_calling_the_resolver() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls)
    relation = _relation(span_path="pkg/multi_line.py", span_start_line=100, span_end_line=104)

    relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolver
    )

    assert calls == [("pkg/multi_line.py", 100, 104)]


def test_relation_without_span_never_calls_the_resolver_and_stays_unavailable() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls)
    relation = _relation(span_path=None, span_start_line=None, span_end_line=None)

    items = relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolver
    )

    assert items[0].source_region_id is None
    assert calls == []


def test_resolver_returning_none_is_not_fabricated_into_a_region_id() -> None:
    """The file may have become unreadable between analysis and this
    request -- the resolver honestly returns None, and evidence must stay
    unavailable rather than inventing a placeholder id."""

    def resolve(path: str, start_line: int, end_line: int) -> str | None:
        return None

    relation = _relation()
    items = relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolve
    )

    assert items[0].source_region_id is None


def test_omitting_the_resolver_keeps_source_region_id_unset() -> None:
    """Backward compatibility: callers (e.g. most existing tests) that
    don't pass a resolver at all still get the old, pre-Phase-1 behavior."""
    relation = _relation()
    items = relationship_evidence_from_relations((relation,), run_id=RUN_ID, producer=PRODUCER)
    assert items[0].source_region_id is None


# ---------------------------------------------------------------------------
# Relation-kind-specific coverage: D4 inherited self.method, constructor
# binding, direct construction, inheritance -- all real, extractor-emitted
# resolution shapes that Phase 1 requires to retain navigable provenance.
# The extractors themselves (python_call_extractor,
# constructor_binding_extractor, python_inheritance_extractor) already
# populate span_path/span_start_line/span_end_line on every relation they
# emit (verified by inspection); these tests confirm the adapter carries
# that span through to a navigable source_region_id regardless of
# relation_kind/resolution_basis.
# ---------------------------------------------------------------------------


def test_d4_inherited_self_method_evidence_preserves_call_site_source() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls, region_id="region:d4-call-site")
    relation = _relation(
        resolution_basis="inherited_self_method",
        span_path="pkg/subclass.py",
        span_start_line=7,
        span_end_line=7,
        supporting_resolution_spans=(
            ResolutionEvidenceSpan(path="pkg/base.py", start_line=20, end_line=21, description="base method def"),
        ),
    )

    items = relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolver
    )

    assert items[0].source_region_id == "region:d4-call-site"
    assert items[0].resolution_basis == "inherited_self_method"
    assert calls == [("pkg/subclass.py", 7, 7)]


def test_constructor_binding_evidence_remains_navigable() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls, region_id="region:ctor-binding")
    relation = _relation(
        resolution_basis="constructor_binding",
        span_path="pkg/factory.py",
        span_start_line=15,
        span_end_line=15,
        supporting_resolution_spans=(
            ResolutionEvidenceSpan(path="pkg/factory.py", start_line=5, end_line=5, description="param annotation"),
        ),
    )

    items = relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolver
    )

    assert items[0].source_region_id == "region:ctor-binding"


def test_direct_construction_evidence_remains_navigable() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls, region_id="region:direct-construction")
    relation = _relation(
        resolution_basis="direct_construction",
        span_path="pkg/builder.py",
        span_start_line=3,
        span_end_line=3,
        supporting_resolution_spans=(
            ResolutionEvidenceSpan(path="pkg/builder.py", start_line=3, end_line=3, description="constructor call"),
        ),
    )

    items = relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolver
    )

    assert items[0].source_region_id == "region:direct-construction"


def test_inheritance_relation_evidence_remains_navigable() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls, region_id="region:inherits")
    relation = _relation(
        relation_kind="inherits", span_path="pkg/subclass.py", span_start_line=1, span_end_line=1
    )

    items = relationship_evidence_from_relations(
        (relation,), run_id=RUN_ID, producer=PRODUCER, source_region_resolver=resolver
    )

    assert items[0].source_region_id == "region:inherits"
    assert items[0].relationship_kind == "inherits"


# ---------------------------------------------------------------------------
# claim_from_proposition: the resolver threads through the full verify path.
# ---------------------------------------------------------------------------


def test_claim_from_proposition_threads_the_resolver_into_evidence() -> None:
    calls: list[tuple[str, int, int]] = []
    resolver = _recording_resolver(calls, region_id="region:claim-level")
    relation = _relation()
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CALLER, relation_kind="calls", object_entity_id=CALLEE
    )

    claim = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
        subject_symbol_ids=(CALLER, CALLEE),
        source_region_resolver=resolver,
    )

    assert claim.support_status == "supported"
    assert claim.evidence_chain.items[0].source_region_id == "region:claim-level"
    assert calls == [("pkg/caller.py", 42, 42)]


def test_claim_from_proposition_without_resolver_keeps_prior_behavior() -> None:
    relation = _relation()
    proposition = ClaimProposition(
        kind="direct_relation", subject_entity_id=CALLER, relation_kind="calls", object_entity_id=CALLEE
    )

    claim = claim_from_proposition(
        proposition,
        (relation,),
        run_id=RUN_ID,
        epistemic_type="observed",
        producer=PRODUCER,
        subject_symbol_ids=(CALLER, CALLEE),
    )

    assert claim.evidence_chain.items[0].source_region_id is None
