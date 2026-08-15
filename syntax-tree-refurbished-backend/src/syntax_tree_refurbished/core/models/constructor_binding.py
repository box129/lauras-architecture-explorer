"""Constructor attribute-binding contract.

``ConstructorAttributeBinding`` is the minimal shared shape for a single,
deterministic raw fact about one specific, conservative dependency-
injection idiom:

    def __init__(self, <parameter>: <Type>):
        self.<attribute> = <parameter>

This is a *supporting* raw fact for call resolution, not a replacement for
anything: it says nothing about calls itself. A separate call-resolution
step (outside this module) can consult a set of these bindings to resolve
``self.<attribute>.<method>()`` call sites that direct syntactic analysis
alone cannot -- the constructor parameter's declared type tells you what
``self.<attribute>`` actually is.

Scope, deliberately narrow for this first version
-----------------------------------------------------
Only the exact pattern above is recognized. Explicitly OUT of scope (no
attempt is made to detect or partially resolve any of these -- a binding
for these situations should simply not be produced):

- factories / builder functions (``self.x = make_x()``)
- service locators / registries (``self.x = container.get(X)``)
- arbitrary expressions on the right-hand side (anything that is not
  *exactly* a bare reference to a constructor parameter)
- dynamic rebinding (``self.x`` reassigned anywhere outside ``__init__``)
- an unannotated parameter (no declared type to resolve against)
- name-based guessing of any kind: a binding is only ever "resolved" when
  the parameter's own type annotation resolves uniquely to a real class
  ``ParsedSymbol`` -- never because ``attribute_name``/``parameter_name``
  happens to look like a class name.

Relationship to ``ObservedProgramRelation``
------------------------------------------------
Distinct, one-directional flow (mirroring the existing
``ObservedProgramRelation`` -> ``RelationshipEvidence`` layering):

    extractor  --produces-->  ConstructorAttributeBinding
                                        |
                                        v  (a call-resolution step, not this module)
                               ObservedProgramRelation
                               (relation_kind="calls",
                                resolution_basis="constructor_binding",
                                supporting_resolution_spans=[...])

Nothing in this module performs extraction or call resolution; it is a
schema/contract layer only, matching the pattern already established by
``core.models.program_relation``.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Literal, get_args


BindingResolutionStatus = Literal["resolved", "partial", "unresolved"]
"""How confidently the binding's declared type was resolved to a real
analyzed class.

- "resolved": the constructor parameter has an explicit type annotation,
  and that annotation resolves *uniquely* to a real class ``ParsedSymbol``
  in the analyzed run. ``target_type_entity_id`` is required.
- "partial": reserved for a future, more permissive resolution technique
  (e.g. an annotation that resolves to more than one plausible match under
  some future heuristic). Not produced by this first version's extractor
  -- see the module docstring's "no name-based guessing" rule -- but kept
  in the vocabulary now so a future extension doesn't require a shape
  change here. ``target_type_entity_id`` MAY be populated.
- "unresolved": the assignment matches the conservative shape (constructor
  parameter, direct ``self.attribute = parameter`` assignment) but the
  parameter has no annotation, or the annotation does not resolve to a
  real analyzed class (external/third-party type, unresolved import,
  ambiguous match, etc.). ``target_type_entity_id`` must be absent --
  never a guess.
"""


def _validate_literal(value: str, allowed: tuple[str, ...], field_name: str) -> None:
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of {allowed}, got {value!r}")


def compute_binding_id(
    *,
    run_id: str,
    owning_class_entity_id: str,
    attribute_name: str,
    parameter_name: str,
    declared_type_reference: str,
) -> str:
    """Deterministic id for a ConstructorAttributeBinding.

    Identity = the run, the owning class, the attribute name, the
    parameter name, and the declared type reference text. A class has at
    most one ``__init__``, so (owning class, attribute name) alone would
    likely already be unique in practice, but the parameter name and
    declared type are included too so identity is fully determined by
    what was actually observed, not by an assumption about uniqueness
    elsewhere. Same inputs always yield the same id; changing any input
    changes it.
    """
    raw = "|".join(
        [run_id, owning_class_entity_id, attribute_name, parameter_name, declared_type_reference]
    )
    return f"ctor-binding:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


@dataclass(frozen=True)
class ConstructorAttributeBinding:
    """A single raw fact: ``self.<attribute_name> = <parameter_name>`` in
    some class's ``__init__``, where ``parameter_name`` carries the type
    annotation ``declared_type_reference``.

    ``owning_class_entity_id`` is the real, run-scoped ``ParsedSymbol.id``
    of the class whose ``__init__`` this binding was found in (never a
    placeholder -- same "real entities only" discipline as
    ``ObservedProgramRelation.source_entity_id``).

    ``target_type_entity_id`` is the real, run-scoped ``ParsedSymbol.id``
    of the resolved type when ``resolution_status="resolved"`` -- also
    never a placeholder; ``declared_type_reference`` (always present, the
    literal annotation text as written) is the textual fallback for
    "partial"/"unresolved" bindings, exactly mirroring
    ``ObservedProgramRelation.target_reference``'s role.

    ``annotation_span_*`` locates the parameter's type annotation in
    source; ``assignment_span_*`` locates the ``self.attribute =
    parameter`` statement. Each span group is optional as a group
    (all-or-nothing), independently of the other.
    """

    id: str
    run_id: str
    owning_class_entity_id: str
    attribute_name: str
    parameter_name: str
    declared_type_reference: str
    resolution_status: BindingResolutionStatus
    target_type_entity_id: str | None = None
    annotation_span_path: str | None = None
    annotation_span_start_line: int | None = None
    annotation_span_end_line: int | None = None
    assignment_span_path: str | None = None
    assignment_span_start_line: int | None = None
    assignment_span_end_line: int | None = None

    def __post_init__(self) -> None:
        _validate_literal(
            self.resolution_status, get_args(BindingResolutionStatus), "resolution_status"
        )
        if not self.id:
            raise ValueError("ConstructorAttributeBinding requires a non-empty id")
        if not self.run_id:
            raise ValueError("ConstructorAttributeBinding requires a non-empty run_id")
        if not self.owning_class_entity_id:
            raise ValueError("ConstructorAttributeBinding requires a non-empty owning_class_entity_id")
        if not self.attribute_name:
            raise ValueError("ConstructorAttributeBinding requires a non-empty attribute_name")
        if not self.parameter_name:
            raise ValueError("ConstructorAttributeBinding requires a non-empty parameter_name")
        if not self.declared_type_reference:
            raise ValueError("ConstructorAttributeBinding requires a non-empty declared_type_reference")

        self._check_span_group(
            "annotation", self.annotation_span_path, self.annotation_span_start_line, self.annotation_span_end_line
        )
        self._check_span_group(
            "assignment", self.assignment_span_path, self.assignment_span_start_line, self.assignment_span_end_line
        )

        if self.resolution_status == "resolved":
            if not self.target_type_entity_id:
                raise ValueError(
                    "ConstructorAttributeBinding with resolution_status='resolved' requires a "
                    "non-empty target_type_entity_id (a real analyzed class, not a placeholder)"
                )
        elif self.resolution_status == "unresolved":
            if self.target_type_entity_id:
                raise ValueError(
                    "ConstructorAttributeBinding with resolution_status='unresolved' must NOT set "
                    "target_type_entity_id -- an unresolved type has no real analyzed entity to "
                    "point at; declared_type_reference already carries the textual annotation"
                )

    @staticmethod
    def _check_span_group(
        label: str, path: str | None, start_line: int | None, end_line: int | None
    ) -> None:
        fields = (path, start_line, end_line)
        if any(f is not None for f in fields) and any(f is None for f in fields):
            raise ValueError(
                f"ConstructorAttributeBinding {label}_span fields must be all-or-nothing "
                f"({label}_span_path, {label}_span_start_line, {label}_span_end_line)"
            )
        if start_line is not None and end_line is not None and end_line < start_line:
            raise ValueError(f"ConstructorAttributeBinding {label}_span_end_line must be >= {label}_span_start_line")

    @staticmethod
    def create(
        *,
        run_id: str,
        owning_class_entity_id: str,
        attribute_name: str,
        parameter_name: str,
        declared_type_reference: str,
        resolution_status: BindingResolutionStatus,
        target_type_entity_id: str | None = None,
        annotation_span_path: str | None = None,
        annotation_span_start_line: int | None = None,
        annotation_span_end_line: int | None = None,
        assignment_span_path: str | None = None,
        assignment_span_start_line: int | None = None,
        assignment_span_end_line: int | None = None,
    ) -> "ConstructorAttributeBinding":
        """Build a ConstructorAttributeBinding, computing its deterministic id."""
        binding_id = compute_binding_id(
            run_id=run_id,
            owning_class_entity_id=owning_class_entity_id,
            attribute_name=attribute_name,
            parameter_name=parameter_name,
            declared_type_reference=declared_type_reference,
        )
        return ConstructorAttributeBinding(
            id=binding_id,
            run_id=run_id,
            owning_class_entity_id=owning_class_entity_id,
            attribute_name=attribute_name,
            parameter_name=parameter_name,
            declared_type_reference=declared_type_reference,
            resolution_status=resolution_status,
            target_type_entity_id=target_type_entity_id,
            annotation_span_path=annotation_span_path,
            annotation_span_start_line=annotation_span_start_line,
            annotation_span_end_line=annotation_span_end_line,
            assignment_span_path=assignment_span_path,
            assignment_span_start_line=assignment_span_start_line,
            assignment_span_end_line=assignment_span_end_line,
        )
