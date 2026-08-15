"""Raw, deterministic program-relation contract.

``ObservedProgramRelation`` is the minimal shared shape for a single
structural fact produced *directly* by a deterministic source-code
extractor (a Python AST walk, an import resolver, ...), scoped to one
analysis run: "entity X relates to entity Y in way K, observed here, with
this resolution status."

This is deliberately **not** ``RelationshipEvidence``
(``core.models.provenance``). Conflating the two would be a layering
mistake:

- ``ObservedProgramRelation`` (this module) is a raw fact. It knows nothing
  about claims, evidence chains, or verdicts. An extractor producing these
  has no business knowing what, if anything, they will later be cited to
  support.
- ``RelationshipEvidence`` (``core.models.provenance``) is that same kind of
  fact *reframed as evidence cited in support of a specific
  ArchitecturalClaim* -- it carries claim-facing framing (a ``description``
  of why it's being cited, a ``ProducerInfo`` for the citing process) that
  has no meaning at extraction time, and the same raw relation may end up
  cited as evidence for zero, one, or several different claims.

The intended, one-directional flow (see the "provenance adapter"
workstream) is:

    extractor  --produces-->  ObservedProgramRelation
                                        |
                                        v  (adapter, not this module)
                               RelationshipEvidence -> EvidenceChain
                                        |
                                        v
                               ArchitecturalClaim

Nothing in this module performs extraction or adaptation; it is a
schema/contract layer only, matching the pattern already established by
``core.models.provenance``.

Entity identity: real analyzed entities only, never placeholders
------------------------------------------------------------------
This module deliberately keeps two *different kinds of thing* in two
different fields, rather than one field that sometimes holds a real id and
sometimes holds a stand-in string for something the extractor couldn't
resolve:

- ``target_entity_id``: **only** ever a real, run-scoped
  ``ParsedSymbol.id`` for an entity that was actually analyzed in this run
  (``core.models.parsed_symbol``). This module does not import
  ``ParsedSymbol`` -- it stays decoupled from the parsing layer -- but the
  *contract* is that any value placed here identifies a real symbol an
  extractor can point to, not a guess. An earlier version of this contract
  allowed ``target_entity_id`` to carry a "best-effort placeholder identity"
  for unresolved targets; that was a mistake corrected here, because it let
  an unresolved textual guess masquerade as a real analyzed entity to any
  downstream consumer that only checked "is target_entity_id set?" without
  also checking ``resolution_status``. Placeholder/textual targets now have
  their own field (below) and can never appear here.
- ``target_reference``: the textual/original target expression as written
  in source (e.g. the literal call expression ``"requests.get"``, or a base
  class expression the extractor could not resolve into an analyzed
  symbol). This is presentation/debugging information, never treated as an
  entity identity by any consumer.

``source_entity_id`` is always required and is likewise expected to be a
real, run-scoped ``ParsedSymbol.id`` -- an extractor only ever calls
``ObservedProgramRelation.create`` from the perspective of a real symbol it
is currently examining, so there is no "unresolved source" case to support
symmetrically with the target.

Validation enforces the following per ``resolution_status`` (see
``ObservedProgramRelation.__post_init__`` for the exact checks):

=================  ==================  ===================
resolution_status  target_entity_id    target_reference
=================  ==================  ===================
resolved           required            optional
partial            optional            required
unresolved         must be absent      required
=================  ==================  ===================

Cross-run logical identity
----------------------------
This module has no opinion on cross-run correlation -- that is what
``ParsedSymbol.stable_entity_key`` (``core.models.parsed_symbol``) is for.
Within one analysis run, ``source_entity_id`` / ``target_entity_id`` should
resolve to real, run-scoped ``ParsedSymbol.id`` values wherever possible
(per the table above); a caller that needs to recognize "the same logical
entity" across two separate runs looks up each ``ParsedSymbol.id`` in that
run's symbol store and compares ``stable_entity_key``, rather than expecting
this module's ids to be stable across runs themselves (they are not, by
design -- see ``ParsedSymbol.id``'s own docstring on run isolation).

Resolution provenance: how a target was resolved, not just what it is
-------------------------------------------------------------------------
Some resolution techniques establish a target through more than the call
site alone -- e.g. resolving ``self.dependency.method()`` by tracing
``dependency`` back through a constructor-parameter binding requires two
*additional* source facts (the parameter's type annotation, and the
``self.dependency = dependency`` assignment) beyond the call expression
itself. Two optional fields carry this without disturbing anything that
doesn't need it:

- ``resolution_basis``: names the technique used (``None`` for ordinary
  direct syntactic resolution -- the vast majority of relations, and every
  relation produced before this field existed; that is the backward
  compatibility guarantee).
- ``supporting_resolution_spans``: the extra source spans (beyond the
  relation's own primary ``span_path``/``span_start_line``/``span_end_line``,
  which always remains the call/reference site itself) that justify
  ``resolution_basis``. Required non-empty whenever ``resolution_basis`` is
  set -- a claimed resolution basis with no evidence for it is a
  contradiction in terms.

Deliberately NOT folded into ``compute_relation_id``: identity remains
"what relation, at what site" (run + kind + source + target + primary
span), not "how it was figured out" -- two extractors reaching the same
conclusion via different techniques should be free to agree on one id, and
existing callers/tests that never mention these fields are completely
unaffected (they default to ``None``/``()``).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Literal, get_args


ProgramRelationKind = Literal["contains", "imports", "calls", "inherits"]
"""The initial, deliberately small set of raw relation kinds this contract
covers. Mirrors (a strict subset of) core.models.provenance.RelationshipKind
so that a future extractor's output maps onto RelationshipEvidence without a
kind-name translation table; new kinds should be added here first, only once
a real extractor produces them."""

ResolutionStatus = Literal["resolved", "partial", "unresolved"]
"""How confidently the extractor identified the target entity of a relation.

- "resolved": the target entity is identified with certainty (e.g. a
  same-module function call to a name that resolves unambiguously via
  static analysis alone). ``target_entity_id`` is required.
- "partial": a target was identified, but resolution required a heuristic
  that is not always correct (e.g. resolving through a common but not
  syntactically guaranteed pattern). ``target_entity_id`` MAY be populated
  if the heuristic did land on a real analyzed entity; ``target_reference``
  is always required regardless, since the heuristic nature of the match
  means the textual expression that was actually matched is significant
  provenance in its own right.
- "unresolved": no specific target entity could be identified (e.g. a call
  through dynamic dispatch, or an import whose source could not be located
  in the analyzed repository). ``target_entity_id`` must be absent --
  extractors must never invent or guess a target entity id when resolution
  is ambiguous. ``target_reference`` is required instead, carrying the
  literal, as-written target expression, so the fact that *something* was
  observed (even if unidentified) is not lost.
"""


ResolutionBasis = Literal["constructor_binding", "direct_construction", "inherited_self_method"]
"""The technique used to resolve a relation's target, beyond ordinary
direct syntactic resolution (which leaves ``resolution_basis`` unset).
New bases are added here only once a real producer emits them, matching
``ProgramRelationKind``'s own add-on-demand convention.

- "constructor_binding": the target was resolved by tracing a
  ``self.<attribute>`` access back through a ``ConstructorAttributeBinding``
  (``core.models.constructor_binding``) -- a constructor parameter's type
  annotation plus its ``self.attribute = parameter`` assignment -- rather
  than from the call expression's own syntax alone.
- "direct_construction": the target was resolved by tracing a
  ``self.<attribute>`` access back to a bare ``self.<attribute> =
  <ClassExpr>(...)`` direct-instantiation assignment in the owning class's
  own ``__init__`` (no constructor parameter or type annotation involved
  at all -- the attribute's type comes from the constructor call written
  directly on the right-hand side), rather than from the call expression's
  own syntax alone. Produced by ``app.analysis.python_call_extractor``'s
  own AST walk (no separate supporting-facts contract, unlike
  "constructor_binding").
- "inherited_self_method": the target of a ``self.method()`` call was
  resolved not on the calling class itself, but on a base class reached by
  walking caller-supplied, already-resolved ``inherits`` relations
  (``core.models.program_relation``, ``relation_kind="inherits"``,
  produced by ``app.analysis.python_inheritance_extractor``) -- never a
  ``super().method()`` call, never an ambiguous or partially-resolved
  inheritance chain. ``supporting_resolution_spans`` carries the
  ``inherits`` relation's own span (the base-class declaration this
  resolution walked through)."""


def _validate_literal(value: str, allowed: tuple[str, ...], field_name: str) -> None:
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of {allowed}, got {value!r}")


@dataclass(frozen=True)
class ResolutionEvidenceSpan:
    """A single supporting source span justifying a relation's
    ``resolution_basis`` -- distinct from the relation's own primary span,
    which always remains the call/reference site itself. E.g. for
    ``resolution_basis="constructor_binding"``, one span for the
    constructor parameter's type annotation and one for the
    ``self.attribute = parameter`` assignment.
    """

    path: str
    start_line: int
    end_line: int
    description: str = ""

    def __post_init__(self) -> None:
        if not self.path:
            raise ValueError("ResolutionEvidenceSpan requires a non-empty path")
        if self.end_line < self.start_line:
            raise ValueError("ResolutionEvidenceSpan end_line must be >= start_line")


def compute_relation_id(
    *,
    run_id: str,
    relation_kind: str,
    source_entity_id: str,
    target_entity_id: str | None,
    target_reference: str | None,
    span_path: str | None,
    span_start_line: int | None,
    span_end_line: int | None,
) -> str:
    """Deterministic id for an ObservedProgramRelation.

    Identity = the run, the relation kind, the source entity, the target
    (both ``target_entity_id`` and ``target_reference``, whichever are
    populated -- see below for why both are included), and the source span
    (or its absence).

    Both target fields are folded into identity, not just whichever one
    happens to be set, because two relations can share every other
    identity component yet still be genuinely distinct: e.g. two different
    "unresolved" calls from the same function with no span information
    (``target_entity_id`` absent on both) must still produce different ids
    if their ``target_reference`` text differs -- otherwise one would
    silently overwrite the other under a shared id. Same inputs always
    yield the same id; changing any input changes it.
    """
    span_key = "none" if span_path is None else f"{span_path}:{span_start_line}:{span_end_line}"
    target_key = f"{target_entity_id or ''}|{target_reference or ''}"
    raw = "|".join([run_id, relation_kind, source_entity_id, target_key, span_key])
    return f"relation:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


@dataclass(frozen=True)
class ObservedProgramRelation:
    """A single raw structural fact observed by a deterministic extractor.

    See the module docstring for the full rationale behind splitting target
    identity into ``target_entity_id`` (real analyzed entity only) versus
    ``target_reference`` (textual/original expression, for partial or
    unresolved targets) and the validation table per ``resolution_status``.

    The source span is optional as a *group*: either all three of
    ``span_path``/``span_start_line``/``span_end_line`` are set (the
    extractor pinpointed an exact location) or none are (e.g. a relation
    inferred at a coarser granularity with no single defining span) --
    never a partial span.

    ``confidence`` is populated only when ``resolution_status`` is
    ``"partial"`` or ``"unresolved"``: a fully ``"resolved"`` relation is a
    deterministic fact, not a probabilistic guess, so attaching a
    confidence score to it would misrepresent its certainty.
    """

    id: str
    run_id: str
    relation_kind: ProgramRelationKind
    source_entity_id: str
    extractor_name: str
    extractor_version: str
    resolution_status: ResolutionStatus
    target_entity_id: str | None = None
    target_reference: str | None = None
    span_path: str | None = None
    span_start_line: int | None = None
    span_end_line: int | None = None
    confidence: float | None = None
    resolution_basis: ResolutionBasis | None = None
    supporting_resolution_spans: tuple[ResolutionEvidenceSpan, ...] = ()

    def __post_init__(self) -> None:
        _validate_literal(self.relation_kind, get_args(ProgramRelationKind), "relation_kind")
        _validate_literal(self.resolution_status, get_args(ResolutionStatus), "resolution_status")
        if not self.id:
            raise ValueError("ObservedProgramRelation requires a non-empty id")
        if not self.run_id:
            raise ValueError("ObservedProgramRelation requires a non-empty run_id")
        if not self.source_entity_id:
            raise ValueError("ObservedProgramRelation requires a non-empty source_entity_id")
        if not self.extractor_name:
            raise ValueError("ObservedProgramRelation requires a non-empty extractor_name")
        if not self.extractor_version:
            raise ValueError("ObservedProgramRelation requires a non-empty extractor_version")

        span_fields = (self.span_path, self.span_start_line, self.span_end_line)
        if any(f is not None for f in span_fields) and any(f is None for f in span_fields):
            raise ValueError(
                "ObservedProgramRelation span fields must be all-or-nothing "
                "(span_path, span_start_line, span_end_line)"
            )
        if (
            self.span_start_line is not None
            and self.span_end_line is not None
            and self.span_end_line < self.span_start_line
        ):
            raise ValueError("ObservedProgramRelation span_end_line must be >= span_start_line")

        if self.resolution_status == "resolved":
            if not self.target_entity_id:
                raise ValueError(
                    "ObservedProgramRelation with resolution_status='resolved' requires a "
                    "non-empty target_entity_id (a real analyzed entity, not a placeholder)"
                )
        elif self.resolution_status == "unresolved":
            if self.target_entity_id:
                raise ValueError(
                    "ObservedProgramRelation with resolution_status='unresolved' must NOT set "
                    "target_entity_id -- an unresolved target has no real analyzed entity to "
                    "point at; use target_reference for the textual/original expression instead"
                )
            if not self.target_reference:
                raise ValueError(
                    "ObservedProgramRelation with resolution_status='unresolved' requires a "
                    "non-empty target_reference"
                )
        elif self.resolution_status == "partial":
            if not self.target_reference:
                raise ValueError(
                    "ObservedProgramRelation with resolution_status='partial' requires a "
                    "non-empty target_reference (the textual expression the heuristic matched), "
                    "even if target_entity_id is also populated"
                )
            # target_entity_id is optional for "partial": the heuristic may or may not have
            # landed on a real analyzed entity in addition to matching some text.

        if self.confidence is not None and not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"ObservedProgramRelation.confidence must be in [0, 1], got {self.confidence!r}")
        if self.resolution_status == "resolved" and self.confidence is not None:
            raise ValueError(
                "ObservedProgramRelation.confidence must be unset when resolution_status is 'resolved' "
                f"(got confidence={self.confidence!r}); confidence is only meaningful for 'partial'/'unresolved'"
            )

        if self.resolution_basis is not None:
            _validate_literal(self.resolution_basis, get_args(ResolutionBasis), "resolution_basis")
            if not self.supporting_resolution_spans:
                raise ValueError(
                    "ObservedProgramRelation.supporting_resolution_spans must be non-empty when "
                    f"resolution_basis={self.resolution_basis!r} is set -- a claimed resolution "
                    "basis requires evidence for it"
                )

    @staticmethod
    def create(
        *,
        run_id: str,
        relation_kind: ProgramRelationKind,
        source_entity_id: str,
        extractor_name: str,
        extractor_version: str,
        resolution_status: ResolutionStatus,
        target_entity_id: str | None = None,
        target_reference: str | None = None,
        span_path: str | None = None,
        span_start_line: int | None = None,
        span_end_line: int | None = None,
        confidence: float | None = None,
        resolution_basis: ResolutionBasis | None = None,
        supporting_resolution_spans: tuple[ResolutionEvidenceSpan, ...] = (),
    ) -> "ObservedProgramRelation":
        """Build an ObservedProgramRelation, computing its deterministic id.

        ``resolution_basis``/``supporting_resolution_spans`` do not affect
        the computed id (see the module docstring) -- omit them entirely
        for ordinary direct syntactic resolution.
        """
        relation_id = compute_relation_id(
            run_id=run_id,
            relation_kind=relation_kind,
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            target_reference=target_reference,
            span_path=span_path,
            span_start_line=span_start_line,
            span_end_line=span_end_line,
        )
        return ObservedProgramRelation(
            id=relation_id,
            run_id=run_id,
            relation_kind=relation_kind,
            source_entity_id=source_entity_id,
            extractor_name=extractor_name,
            extractor_version=extractor_version,
            resolution_status=resolution_status,
            target_entity_id=target_entity_id,
            target_reference=target_reference,
            span_path=span_path,
            span_start_line=span_start_line,
            span_end_line=span_end_line,
            confidence=confidence,
            resolution_basis=resolution_basis,
            supporting_resolution_spans=supporting_resolution_spans,
        )
