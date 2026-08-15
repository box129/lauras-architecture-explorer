"""Tests for the raw ObservedProgramRelation contract
(core.models.program_relation): deterministic id generation and model
validation, including the resolution_status-dependent target identity
rules (target_entity_id vs target_reference)."""

from __future__ import annotations

import pytest

from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ResolutionEvidenceSpan,
    compute_relation_id,
)


# ---------------------------------------------------------------------------
# Deterministic id generation
# ---------------------------------------------------------------------------


def test_relation_id_deterministic_for_identical_inputs():
    kwargs = dict(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.Foo.bar",
        target_entity_id="pkg.mod.Baz.qux",
        target_reference=None,
        span_path="pkg/mod.py",
        span_start_line=10,
        span_end_line=10,
    )
    assert compute_relation_id(**kwargs) == compute_relation_id(**kwargs)


@pytest.mark.parametrize(
    "field,override",
    [
        ("run_id", "run-2"),
        ("relation_kind", "imports"),
        ("source_entity_id", "pkg.mod.Other.bar"),
        ("target_entity_id", "pkg.mod.Baz.other"),
        ("span_path", "pkg/other.py"),
        ("span_start_line", 11),
        ("span_end_line", 12),
    ],
)
def test_relation_id_changes_when_any_identity_field_changes(field, override):
    base = dict(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.Foo.bar",
        target_entity_id="pkg.mod.Baz.qux",
        target_reference=None,
        span_path="pkg/mod.py",
        span_start_line=10,
        span_end_line=10,
    )
    varied = dict(base, **{field: override})
    assert compute_relation_id(**base) != compute_relation_id(**varied)


def test_relation_id_changes_when_target_reference_changes_alone():
    """target_reference is part of identity too, not just target_entity_id --
    this matters for partial relations, which can have the same
    target_entity_id (or none) but a different matched text."""
    base = dict(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.Foo.bar",
        target_entity_id=None,
        span_path="pkg/mod.py",
        span_start_line=10,
        span_end_line=10,
    )
    id_a = compute_relation_id(**base, target_reference="requests.get")
    id_b = compute_relation_id(**base, target_reference="requests.post")
    assert id_a != id_b


def test_relation_id_distinguishes_same_edge_at_different_call_sites():
    """A calls B twice, on two different lines, must be two distinct
    relation ids -- the span is part of identity, not just metadata."""
    common = dict(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.A.f",
        target_entity_id="pkg.mod.B.g",
        target_reference=None,
        span_path="pkg/mod.py",
    )
    id_a = compute_relation_id(**common, span_start_line=5, span_end_line=5)
    id_b = compute_relation_id(**common, span_start_line=9, span_end_line=9)
    assert id_a != id_b


def test_relation_id_no_target_entity_no_span_still_distinguishes_by_reference():
    """Two unresolved calls from the same source, with no span info at all
    (identity would otherwise collide), must still get different ids purely
    from differing target_reference text -- this is the scenario the
    compute_relation_id docstring calls out explicitly."""
    common = dict(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.A.f",
        target_entity_id=None,
        span_path=None,
        span_start_line=None,
        span_end_line=None,
    )
    id_a = compute_relation_id(**common, target_reference="dynamic_call_1")
    id_b = compute_relation_id(**common, target_reference="dynamic_call_2")
    assert id_a != id_b


def test_relation_id_no_span_differs_from_has_span():
    common = dict(
        run_id="run-1",
        relation_kind="inherits",
        source_entity_id="pkg.mod.A",
        target_entity_id="pkg.mod.B",
        target_reference=None,
    )
    with_span = compute_relation_id(**common, span_path="pkg/mod.py", span_start_line=1, span_end_line=1)
    without_span = compute_relation_id(**common, span_path=None, span_start_line=None, span_end_line=None)
    assert with_span != without_span


def test_create_populates_deterministic_id():
    relation = ObservedProgramRelation.create(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.A.f",
        target_entity_id="pkg.mod.B.g",
        extractor_name="python_call_extractor",
        extractor_version="0.1.0",
        resolution_status="resolved",
        span_path="pkg/mod.py",
        span_start_line=5,
        span_end_line=5,
    )
    expected_id = compute_relation_id(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.A.f",
        target_entity_id="pkg.mod.B.g",
        target_reference=None,
        span_path="pkg/mod.py",
        span_start_line=5,
        span_end_line=5,
    )
    assert relation.id == expected_id


# ---------------------------------------------------------------------------
# Model validation: basic required fields / span / relation_kind / status
# ---------------------------------------------------------------------------


def _resolved_kwargs(**overrides):
    kwargs = dict(
        run_id="run-1",
        relation_kind="calls",
        source_entity_id="pkg.mod.A.f",
        extractor_name="python_call_extractor",
        extractor_version="0.1.0",
        resolution_status="resolved",
        target_entity_id="pkg.mod.B.g",
        span_path="pkg/mod.py",
        span_start_line=5,
        span_end_line=5,
        confidence=None,
    )
    kwargs.update(overrides)
    return kwargs


def test_valid_resolved_relation_constructs_via_create():
    relation = ObservedProgramRelation.create(**_resolved_kwargs())
    assert relation.relation_kind == "calls"
    assert relation.resolution_status == "resolved"
    assert relation.target_entity_id == "pkg.mod.B.g"


@pytest.mark.parametrize("bad_kind", ["invokes", "", "CALLS", "extends"])
def test_rejects_invalid_relation_kind(bad_kind):
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(**_resolved_kwargs(relation_kind=bad_kind))


@pytest.mark.parametrize("bad_status", ["confirmed", "", "guessed"])
def test_rejects_invalid_resolution_status(bad_status):
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(**_resolved_kwargs(resolution_status=bad_status))


@pytest.mark.parametrize(
    "field",
    ["run_id", "source_entity_id", "extractor_name", "extractor_version"],
)
def test_rejects_empty_required_string_fields(field):
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(**_resolved_kwargs(**{field: ""}))


@pytest.mark.parametrize(
    "overrides",
    [
        {"span_path": None, "span_start_line": 5, "span_end_line": 5},
        {"span_path": "pkg/mod.py", "span_start_line": None, "span_end_line": 5},
        {"span_path": "pkg/mod.py", "span_start_line": 5, "span_end_line": None},
    ],
)
def test_rejects_partial_span(overrides):
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(**_resolved_kwargs(**overrides))


def test_allows_fully_absent_span():
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(span_path=None, span_start_line=None, span_end_line=None)
    )
    assert relation.span_path is None


def test_rejects_span_end_before_start():
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(**_resolved_kwargs(span_start_line=10, span_end_line=5))


@pytest.mark.parametrize("bad_confidence", [-0.1, 1.1, 2.0])
def test_rejects_out_of_range_confidence(bad_confidence):
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(
            **_resolved_kwargs(
                resolution_status="partial",
                target_entity_id=None,
                target_reference="requests.get",
                confidence=bad_confidence,
            )
        )


def test_rejects_confidence_on_resolved_relation():
    """A fully resolved relation is a deterministic fact, not a guess --
    attaching a confidence score to it is disallowed."""
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(**_resolved_kwargs(confidence=0.9))


# ---------------------------------------------------------------------------
# Model validation: resolution_status-dependent target identity rules
# (the core of the Phase 2 contract revision)
# ---------------------------------------------------------------------------


def test_resolved_requires_target_entity_id():
    with pytest.raises(ValueError, match="resolved.*target_entity_id"):
        ObservedProgramRelation.create(**_resolved_kwargs(target_entity_id=None))


def test_resolved_allows_missing_target_reference():
    relation = ObservedProgramRelation.create(**_resolved_kwargs(target_reference=None))
    assert relation.target_reference is None


def test_resolved_allows_a_target_reference_too():
    """target_reference is optional (not forbidden) on a resolved relation
    -- an extractor may still want to record the literal expression for
    debugging even though it fully resolved the target."""
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(target_reference="Baz.qux(...)")
    )
    assert relation.target_entity_id == "pkg.mod.B.g"
    assert relation.target_reference == "Baz.qux(...)"


def test_unresolved_must_not_set_target_entity_id():
    """The core fix: an unresolved target must never carry something in
    target_entity_id, even a placeholder -- that field means 'real analyzed
    entity' and nothing else."""
    with pytest.raises(ValueError, match="unresolved.*target_entity_id"):
        ObservedProgramRelation.create(
            **_resolved_kwargs(
                resolution_status="unresolved",
                target_entity_id="unresolved:requests.get",
                target_reference="requests.get",
                confidence=None,
            )
        )


def test_unresolved_requires_target_reference():
    with pytest.raises(ValueError, match="unresolved.*target_reference"):
        ObservedProgramRelation.create(
            **_resolved_kwargs(
                resolution_status="unresolved",
                target_entity_id=None,
                target_reference=None,
                confidence=None,
            )
        )


def test_valid_unresolved_relation():
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(
            resolution_status="unresolved",
            target_entity_id=None,
            target_reference="requests.get",
            confidence=0.0,
        )
    )
    assert relation.target_entity_id is None
    assert relation.target_reference == "requests.get"
    assert relation.resolution_status == "unresolved"


def test_partial_requires_target_reference_even_with_target_entity_id():
    with pytest.raises(ValueError, match="partial.*target_reference"):
        ObservedProgramRelation.create(
            **_resolved_kwargs(
                resolution_status="partial",
                target_entity_id="pkg.mod.B.g",
                target_reference=None,
                confidence=0.6,
            )
        )


def test_partial_requires_target_reference_without_target_entity_id():
    with pytest.raises(ValueError, match="partial.*target_reference"):
        ObservedProgramRelation.create(
            **_resolved_kwargs(
                resolution_status="partial",
                target_entity_id=None,
                target_reference=None,
                confidence=0.6,
            )
        )


def test_partial_allows_target_entity_id_present_alongside_reference():
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(
            resolution_status="partial",
            target_entity_id="pkg.mod.B.g",
            target_reference="obj.method(...)",
            confidence=0.8,
        )
    )
    assert relation.target_entity_id == "pkg.mod.B.g"
    assert relation.target_reference == "obj.method(...)"


def test_partial_allows_target_entity_id_absent():
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(
            resolution_status="partial",
            target_entity_id=None,
            target_reference="obj.method(...)",
            confidence=0.5,
        )
    )
    assert relation.target_entity_id is None
    assert relation.target_reference == "obj.method(...)"


@pytest.mark.parametrize("status", ["partial", "unresolved"])
def test_allows_confidence_on_uncertain_relation(status):
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(
            resolution_status=status,
            target_entity_id=None if status == "unresolved" else "pkg.mod.B.g",
            target_reference="ref",
            confidence=0.5,
        )
    )
    assert relation.confidence == 0.5


@pytest.mark.parametrize("status", ["partial", "unresolved"])
def test_confidence_optional_even_when_uncertain(status):
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(
            resolution_status=status,
            target_entity_id=None if status == "unresolved" else "pkg.mod.B.g",
            target_reference="ref",
            confidence=None,
        )
    )
    assert relation.confidence is None


# ---------------------------------------------------------------------------
# Resolution provenance: resolution_basis / supporting_resolution_spans
# (backward compatibility + validation)
# ---------------------------------------------------------------------------


def test_resolution_basis_defaults_to_none_and_spans_to_empty():
    """Backward compatibility: a relation built exactly as every
    pre-existing caller does (no resolution_basis kwarg at all) is
    unaffected by these new fields."""
    relation = ObservedProgramRelation.create(**_resolved_kwargs())
    assert relation.resolution_basis is None
    assert relation.supporting_resolution_spans == ()


def test_resolution_basis_requires_supporting_spans():
    with pytest.raises(ValueError, match="supporting_resolution_spans"):
        ObservedProgramRelation.create(
            **_resolved_kwargs(resolution_basis="constructor_binding", supporting_resolution_spans=())
        )


def test_resolution_basis_with_supporting_spans_constructs():
    spans = (
        ResolutionEvidenceSpan(path="pkg/mod.py", start_line=3, end_line=3, description="parameter annotation"),
        ResolutionEvidenceSpan(path="pkg/mod.py", start_line=4, end_line=4, description="attribute assignment"),
    )
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(resolution_basis="constructor_binding", supporting_resolution_spans=spans)
    )
    assert relation.resolution_basis == "constructor_binding"
    assert relation.supporting_resolution_spans == spans


def test_rejects_invalid_resolution_basis():
    with pytest.raises(ValueError):
        ObservedProgramRelation.create(
            **_resolved_kwargs(
                resolution_basis="magic",  # type: ignore[arg-type]
                supporting_resolution_spans=(ResolutionEvidenceSpan(path="p.py", start_line=1, end_line=1),),
            )
        )


def test_direct_construction_basis_requires_supporting_spans():
    """The new ``"direct_construction"`` ResolutionBasis value must follow
    the exact same validation rule as ``"constructor_binding"``: a claimed
    basis with no supporting evidence is a contradiction in terms."""
    with pytest.raises(ValueError, match="supporting_resolution_spans"):
        ObservedProgramRelation.create(
            **_resolved_kwargs(resolution_basis="direct_construction", supporting_resolution_spans=())
        )


def test_direct_construction_basis_with_supporting_spans_constructs():
    spans = (
        ResolutionEvidenceSpan(
            path="pkg/mod.py", start_line=8, end_line=8, description="direct construction assignment"
        ),
    )
    relation = ObservedProgramRelation.create(
        **_resolved_kwargs(resolution_basis="direct_construction", supporting_resolution_spans=spans)
    )
    assert relation.resolution_basis == "direct_construction"
    assert relation.supporting_resolution_spans == spans


def test_resolution_basis_does_not_affect_relation_id():
    """Identity is 'what relation, at what site', not 'how it was figured
    out' -- two calls differing only in resolution_basis/supporting spans
    must produce the SAME id (compute_relation_id doesn't take these as
    inputs at all)."""
    without_basis = ObservedProgramRelation.create(**_resolved_kwargs())
    with_basis = ObservedProgramRelation.create(
        **_resolved_kwargs(
            resolution_basis="constructor_binding",
            supporting_resolution_spans=(ResolutionEvidenceSpan(path="p.py", start_line=1, end_line=1),),
        )
    )
    assert without_basis.id == with_basis.id


def test_resolution_evidence_span_rejects_empty_path():
    with pytest.raises(ValueError):
        ResolutionEvidenceSpan(path="", start_line=1, end_line=1)


def test_resolution_evidence_span_rejects_end_before_start():
    with pytest.raises(ValueError):
        ResolutionEvidenceSpan(path="p.py", start_line=5, end_line=1)
