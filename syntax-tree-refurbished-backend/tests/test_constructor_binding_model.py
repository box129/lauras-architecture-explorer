"""Tests for the ConstructorAttributeBinding contract
(core.models.constructor_binding): deterministic id generation and model
validation."""

from __future__ import annotations

import pytest

from syntax_tree_refurbished.core.models.constructor_binding import (
    ConstructorAttributeBinding,
    compute_binding_id,
)


def _valid_kwargs(**overrides):
    kwargs = dict(
        run_id="run-1",
        owning_class_entity_id="symbol:controller",
        attribute_name="order_service",
        parameter_name="order_service",
        declared_type_reference="OrderService",
        resolution_status="resolved",
        target_type_entity_id="symbol:order-service-class",
        annotation_span_path="controllers/order_controller.py",
        annotation_span_start_line=17,
        annotation_span_end_line=17,
        assignment_span_path="controllers/order_controller.py",
        assignment_span_start_line=18,
        assignment_span_end_line=18,
    )
    kwargs.update(overrides)
    return kwargs


# ---------------------------------------------------------------------------
# Deterministic id generation
# ---------------------------------------------------------------------------


def test_binding_id_deterministic_for_identical_inputs():
    kwargs = dict(
        run_id="run-1",
        owning_class_entity_id="symbol:controller",
        attribute_name="order_service",
        parameter_name="order_service",
        declared_type_reference="OrderService",
    )
    assert compute_binding_id(**kwargs) == compute_binding_id(**kwargs)


@pytest.mark.parametrize(
    "field,override",
    [
        ("run_id", "run-2"),
        ("owning_class_entity_id", "symbol:other"),
        ("attribute_name", "svc"),
        ("parameter_name", "svc"),
        ("declared_type_reference", "OtherService"),
    ],
)
def test_binding_id_changes_when_any_identity_field_changes(field, override):
    base = dict(
        run_id="run-1",
        owning_class_entity_id="symbol:controller",
        attribute_name="order_service",
        parameter_name="order_service",
        declared_type_reference="OrderService",
    )
    varied = dict(base, **{field: override})
    assert compute_binding_id(**base) != compute_binding_id(**varied)


def test_create_populates_deterministic_id():
    binding = ConstructorAttributeBinding.create(**_valid_kwargs())
    expected_id = compute_binding_id(
        run_id="run-1",
        owning_class_entity_id="symbol:controller",
        attribute_name="order_service",
        parameter_name="order_service",
        declared_type_reference="OrderService",
    )
    assert binding.id == expected_id


# ---------------------------------------------------------------------------
# Model validation
# ---------------------------------------------------------------------------


def test_valid_resolved_binding_constructs():
    binding = ConstructorAttributeBinding.create(**_valid_kwargs())
    assert binding.resolution_status == "resolved"
    assert binding.target_type_entity_id == "symbol:order-service-class"


@pytest.mark.parametrize("bad_status", ["guessed", "", "maybe"])
def test_rejects_invalid_resolution_status(bad_status):
    with pytest.raises(ValueError):
        ConstructorAttributeBinding.create(**_valid_kwargs(resolution_status=bad_status))


@pytest.mark.parametrize(
    "field",
    [
        "run_id",
        "owning_class_entity_id",
        "attribute_name",
        "parameter_name",
        "declared_type_reference",
    ],
)
def test_rejects_empty_required_string_fields(field):
    with pytest.raises(ValueError):
        ConstructorAttributeBinding.create(**_valid_kwargs(**{field: ""}))


def test_resolved_requires_target_type_entity_id():
    with pytest.raises(ValueError, match="resolved.*target_type_entity_id"):
        ConstructorAttributeBinding.create(**_valid_kwargs(target_type_entity_id=None))


def test_unresolved_must_not_set_target_type_entity_id():
    with pytest.raises(ValueError, match="unresolved.*target_type_entity_id"):
        ConstructorAttributeBinding.create(
            **_valid_kwargs(resolution_status="unresolved", target_type_entity_id="symbol:guessed")
        )


def test_valid_unresolved_binding():
    binding = ConstructorAttributeBinding.create(
        **_valid_kwargs(resolution_status="unresolved", target_type_entity_id=None)
    )
    assert binding.target_type_entity_id is None
    assert binding.declared_type_reference == "OrderService"  # textual reference always retained


@pytest.mark.parametrize(
    "overrides",
    [
        {"annotation_span_path": None, "annotation_span_start_line": 1, "annotation_span_end_line": 1},
        {"annotation_span_path": "p.py", "annotation_span_start_line": None, "annotation_span_end_line": 1},
        {"annotation_span_path": "p.py", "annotation_span_start_line": 1, "annotation_span_end_line": None},
    ],
)
def test_rejects_partial_annotation_span(overrides):
    with pytest.raises(ValueError):
        ConstructorAttributeBinding.create(**_valid_kwargs(**overrides))


@pytest.mark.parametrize(
    "overrides",
    [
        {"assignment_span_path": None, "assignment_span_start_line": 1, "assignment_span_end_line": 1},
        {"assignment_span_path": "p.py", "assignment_span_start_line": None, "assignment_span_end_line": 1},
        {"assignment_span_path": "p.py", "assignment_span_start_line": 1, "assignment_span_end_line": None},
    ],
)
def test_rejects_partial_assignment_span(overrides):
    with pytest.raises(ValueError):
        ConstructorAttributeBinding.create(**_valid_kwargs(**overrides))


def test_allows_fully_absent_spans():
    binding = ConstructorAttributeBinding.create(
        **_valid_kwargs(
            annotation_span_path=None,
            annotation_span_start_line=None,
            annotation_span_end_line=None,
            assignment_span_path=None,
            assignment_span_start_line=None,
            assignment_span_end_line=None,
        )
    )
    assert binding.annotation_span_path is None
    assert binding.assignment_span_path is None


def test_annotation_and_assignment_spans_are_independent_groups():
    """One span group can be present while the other is absent -- they're
    validated independently."""
    binding = ConstructorAttributeBinding.create(
        **_valid_kwargs(
            assignment_span_path=None,
            assignment_span_start_line=None,
            assignment_span_end_line=None,
        )
    )
    assert binding.annotation_span_path is not None
    assert binding.assignment_span_path is None


def test_rejects_annotation_span_end_before_start():
    with pytest.raises(ValueError):
        ConstructorAttributeBinding.create(
            **_valid_kwargs(annotation_span_start_line=10, annotation_span_end_line=5)
        )
