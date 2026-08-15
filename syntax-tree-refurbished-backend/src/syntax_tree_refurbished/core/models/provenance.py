"""Claim-level architectural provenance domain model.

This module defines a narrow contract layer for *claim-level* architectural
verification: given an ``ArchitecturalClaim`` such as "module A depends on
module B" or "``AuthMiddleware`` enforces the auth boundary", what concrete
evidence backs it, how was that evidence produced, and how strong is the
resulting chain (including multi-hop chains, e.g. A calls B which inherits
from C)?

It deliberately builds on the existing grounding primitives in
``core.models.grounding`` and ``core.models.source_region`` rather than
duplicating them:

- ``SourceRegion`` (``core.models.source_region``) already represents an
  inspected span of source text, identified by id, with its own content
  hash. ``SourceSpanEvidence`` below does **not** copy those fields; it
  references a ``SourceRegion`` by id (``source_region_id``) and adds only
  the framing that is specific to evidence-for-a-claim (why this span
  supports the claim, who produced that judgement, and when). The
  ``content_hash`` carried on ``SourceSpanEvidence`` is not a duplicate of
  truth — it is a staleness guard baked into the evidence item's own
  deterministic id, so a claim's evidence can be later revalidated against
  a freshly-read region without re-deriving the whole claim.
- ``Citation`` / ``GroundedClaim`` / ``SupportStatus``
  (``core.models.grounding``) already model citation-level validation for
  the existing lens/investigation pipeline: a single citation is checked
  against a resolvable region and classified as verified / inferred /
  orientation_only / uncertain / unsupported / not_inspected. That is a
  *per-citation* grounding check performed by the existing grounding
  validator (``app/grounding``).

  ``ArchitecturalClaim`` here is a coarser, distinct unit sitting one layer
  above that: an architectural assertion that may require *multiple*,
  possibly heterogeneous, pieces of evidence (an ``EvidenceChain`` — e.g. a
  source span plus a call-relationship plus another source span, for a
  claim like "the payment flow reaches the audit logger") to be considered
  supported. Its outcome vocabulary (``ClaimSupportStatus``:
  supported / insufficient_evidence / contradicted) is intentionally not
  the same as ``SupportStatus``: those two extra states
  (``insufficient_evidence``, ``contradicted``) describe an aggregate
  chain-level verdict that does not map 1:1 onto a single citation's
  grounding state. Nothing here re-implements citation resolution; the
  intent is that a future claim verifier composes ``SourceRegion``
  resolution (as already implemented in ``app/grounding``) with this
  module's chain/claim shapes.

Nothing in this module performs analysis or discovers claims. It is a
schema/contract layer only — see the module docstring note at the bottom of
this file, and ``api/dto/provenance.py``, for the intended
``GET /api/query-lenses/{lens_id}/claims`` contract that consumes it.

Machine-verifiable claim semantics (ClaimProposition)
-------------------------------------------------------
An ``ArchitecturalClaim.statement`` is human-readable presentation text --
"AuthMiddleware enforces the auth boundary" -- and nothing about the text
itself is machine-checkable against evidence. Verifying that an
``EvidenceChain`` is non-empty and internally connected (as an earlier
version of the provenance adapter did) proves the chain is *coherent*, but
proves nothing about whether the chain actually entails the specific thing
the statement asserts: a real, connected chain "Controller -> Service ->
PaymentService" does not make "PaymentService performs fraud detection"
true, even though a naive "chain exists and connects" check would have no
way to notice the mismatch.

``ClaimProposition`` closes that gap: a small, structured, machine-checkable
assertion -- built only from entity ids and a ``ProgramRelationKind`` drawn
from the exact same vocabulary ``ObservedProgramRelation`` evidence uses --
that a verifier (``verify_proposition`` below) can check mechanically
against real evidence, with no natural-language interpretation involved.
``ArchitecturalClaim.statement`` remains for presentation; when a claim
carries a ``proposition``, that proposition -- not the statement text -- is
the source of truth ``verify_proposition`` checks against.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal, Mapping, get_args

from syntax_tree_refurbished.core.models.program_relation import (
    ObservedProgramRelation,
    ProgramRelationKind,
    ResolutionBasis,
    ResolutionEvidenceSpan,
)


ClaimEpistemicType = Literal["observed", "inferred"]
"""How an ArchitecturalClaim was arrived at.

- "observed": read directly off a single structural fact (e.g. "function X
  calls function Y", backed by one parsed call-site / containment edge).
- "inferred": derived by combining multiple observations and/or applying
  judgement across them (e.g. "module A is the auth boundary", inferred
  from naming, imports, and route decorators taken together; or any claim
  whose evidence chain has more than one hop).
"""

ClaimSupportStatus = Literal["supported", "insufficient_evidence", "contradicted"]
"""Aggregate verification outcome for an ArchitecturalClaim's EvidenceChain,
as computed by a verifier that is out of scope for this module (this module
only defines the vocabulary and where the value lives).

- "supported": the evidence chain, taken as a whole, backs the claim.
- "insufficient_evidence": no evidence was found, or the evidence present
  does not reach far enough to support the claim (e.g. a multi-hop claim
  missing an intermediate hop).
- "contradicted": evidence was found that is inconsistent with the claim.
"""

EvidenceKind = Literal["source_span", "relationship"]
"""Discriminator for EvidenceItem variants, so an EvidenceChain can hold a
heterogeneous, ordered sequence of evidence without callers needing an
isinstance check to read the fields common to every variant."""

RelationshipKind = Literal[
    "calls",
    "contains",
    "inherits",
    "imports",
    "implements",
    "references",
    "other",
]
"""Structural relationship kinds a RelationshipEvidence item can reference.
Deliberately mirrors the relationship vocabulary already produced by the
static-analysis layer (see app/analysis/static_structure.py "imports",
app/architecture_map/projection.py "contains", app/query/local_search.py
"call") rather than inventing a parallel taxonomy. "other" is an escape
valve for relationship kinds not yet enumerated here."""

ProducerType = Literal["extractor", "llm", "manual"]
"""What kind of process produced a claim or evidence item."""

PropositionKind = Literal["direct_relation", "reachability"]
"""The initial, deliberately small set of machine-verifiable proposition
shapes a ClaimProposition can take.

- "direct_relation": subject_entity_id is directly related to
  object_entity_id by exactly one relation_kind edge (e.g. "A calls B").
- "reachability": subject_entity_id reaches object_entity_id through an
  ordered chain of relation_kind edges (path_entity_ids), e.g. "A
  transitively depends on C via B" backed by A-calls-B, B-calls-C.

Not (yet) supported: propositions about anything outside this repo's
structural relation vocabulary (ProgramRelationKind: contains/imports/
calls/inherits) -- e.g. a behavioral claim like "performs fraud detection"
has no relation_kind to express it as, so it cannot be phrased as a
ClaimProposition at all. That is a deliberate safety property, not a gap:
it is structurally impossible for verify_proposition to mark a behavioral
claim "supported" from structural relation evidence, because there is no
way to construct a ClaimProposition asserting it in the first place.
"""


def _validate_literal(value: str, allowed: tuple[str, ...], field_name: str) -> None:
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of {allowed}, got {value!r}")


def _stable_id(prefix: str, *parts: str) -> str:
    """Deterministic content-hash id, matching the scheme already used
    throughout this codebase (see app/analysis/static_structure.py,
    app/architecture_map/projection.py, app/parsing/*_symbol_parser.py):
    a short, human-legible prefix plus the first 24 hex chars of the SHA-1
    of the '|'-joined identity parts. Same parts (in the same order) always
    yield the same id; changing any part changes the id.
    """
    raw = "|".join(parts)
    return f"{prefix}:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"


def compute_source_span_evidence_id(
    *, run_id: str, source_region_id: str, content_hash: str, description: str
) -> str:
    """Deterministic id for a SourceSpanEvidence item.

    Identity = the run it was captured in, the source region it points at,
    the content hash of that region *at capture time* (so a later content
    change is detectable as a mismatch rather than silently reusing the old
    id), and the description of why this span is being cited (so the same
    region cited for two different reasons within one claim yields distinct
    evidence items).
    """
    return _stable_id("evidence-span", run_id, source_region_id, content_hash, description)


def compute_relationship_evidence_id(
    *,
    run_id: str,
    relationship_kind: str,
    from_symbol_id: str,
    to_symbol_id: str,
    description: str,
) -> str:
    """Deterministic id for a RelationshipEvidence item.

    Identity = the run, the relationship kind, the ordered (from, to)
    symbol pair, and the description. Order matters: A-calls-B and
    B-calls-A are different edges and must not collide.
    """
    return _stable_id(
        "evidence-rel", run_id, relationship_kind, from_symbol_id, to_symbol_id, description
    )


def compute_evidence_chain_id(*, run_id: str, claim_id: str, evidence_ids: tuple[str, ...]) -> str:
    """Deterministic id for an EvidenceChain.

    Identity = the run, the claim it supports, and the ordered sequence of
    evidence item ids. Order is part of identity: a chain is a *sequence*
    (relevant for multi-hop claims where hop order matters), so reordering
    the same evidence produces a different chain id.
    """
    return _stable_id("evidence-chain", run_id, claim_id, *evidence_ids)


@dataclass(frozen=True)
class ClaimProposition:
    """A minimal, structured, machine-checkable assertion -- see the module
    docstring's "Machine-verifiable claim semantics" section for the full
    rationale. Built entirely from entity ids and a ``ProgramRelationKind``,
    never from free text, so a verifier can check it mechanically.

    - ``kind="direct_relation"``: ``path_entity_ids`` must be empty; the
      proposition is exactly "subject --relation_kind--> object".
    - ``kind="reachability"``: ``path_entity_ids`` must hold the full
      ordered path from subject to object inclusive (i.e.
      ``path_entity_ids[0] == subject_entity_id`` and
      ``path_entity_ids[-1] == object_entity_id``, with at least 2
      entries); the proposition is "subject reaches object via a chain of
      relation_kind edges following exactly this path". ``relation_kind``
      applies uniformly to every hop in a v1 reachability proposition
      (e.g. every hop is a "calls" edge) -- mixed-kind paths are not yet
      supported.
    """

    kind: PropositionKind
    subject_entity_id: str
    relation_kind: ProgramRelationKind
    object_entity_id: str
    path_entity_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _validate_literal(self.kind, get_args(PropositionKind), "kind")
        _validate_literal(self.relation_kind, get_args(ProgramRelationKind), "relation_kind")
        if not self.subject_entity_id:
            raise ValueError("ClaimProposition requires a non-empty subject_entity_id")
        if not self.object_entity_id:
            raise ValueError("ClaimProposition requires a non-empty object_entity_id")

        if self.kind == "direct_relation":
            if self.path_entity_ids:
                raise ValueError(
                    "ClaimProposition kind='direct_relation' must not set path_entity_ids "
                    "(use kind='reachability' for multi-hop claims)"
                )
        elif self.kind == "reachability":
            if len(self.path_entity_ids) < 2:
                raise ValueError(
                    "ClaimProposition kind='reachability' requires path_entity_ids with at "
                    "least 2 entries: [subject_entity_id, ..., object_entity_id]"
                )
            if self.path_entity_ids[0] != self.subject_entity_id:
                raise ValueError(
                    "ClaimProposition kind='reachability' path_entity_ids must start with "
                    "subject_entity_id"
                )
            if self.path_entity_ids[-1] != self.object_entity_id:
                raise ValueError(
                    "ClaimProposition kind='reachability' path_entity_ids must end with "
                    "object_entity_id"
                )

    def _identity_key(self) -> str:
        """Stable string encoding this proposition's identity, for folding
        into compute_claim_id. Not itself a public id -- just a hash input."""
        return "|".join(
            [
                self.kind,
                self.subject_entity_id,
                self.relation_kind,
                self.object_entity_id,
                ",".join(self.path_entity_ids),
            ]
        )


def compute_claim_id(
    *,
    run_id: str,
    statement: str,
    epistemic_type: str,
    subject_symbol_ids: tuple[str, ...] = (),
    proposition: ClaimProposition | None = None,
) -> str:
    """Deterministic id for an ArchitecturalClaim.

    Two entirely different identity schemes apply, selected by whether
    ``proposition`` is given -- this is deliberate, not an oversight:

    - **``proposition`` present**: identity = the run, the epistemic type,
      and the structured proposition's own identity (kind, subject,
      relation_kind, object, path) -- and NOTHING derived from
      ``statement``. For a proposition-backed claim, the proposition *is*
      the claim's semantic content; ``statement`` is rendered presentation
      text generated from that same proposition (see
      ``render_proposition_statement``) and must never affect identity,
      or two claims asserting the exact same verified fact in different
      words would wrongly be treated as different claims -- and, more
      importantly, differently-worded prose could never be used to sneak a
      different claim past verification under the same id.
    - **``proposition`` absent** (legacy path, e.g. the citation-based
      ``claim_projection`` reshaping, which has no ObservedProgramRelation
      evidence to build a proposition from): identity = the run, epistemic
      type, statement text, and the (order-independent) set of subject
      symbol ids -- exactly the pre-existing scheme, unchanged, for
      backward compatibility. Subject ids are sorted before hashing so the
      same claim about the same symbols yields the same id regardless of
      the order callers happen to list them in.
    """
    if proposition is not None:
        return _stable_id("claim", run_id, epistemic_type, proposition._identity_key())
    return _stable_id(
        "claim", run_id, epistemic_type, statement, *sorted(subject_symbol_ids)
    )


_RELATION_VERB_PHRASE: dict[str, str] = {
    "calls": "calls",
    "contains": "contains",
    "imports": "imports",
    "inherits": "inherits from",
}
"""Verb phrase used by render_proposition_statement for a direct_relation
proposition, keyed by ProgramRelationKind. Falls back to the raw
relation_kind string for anything not listed (keeps rendering total --
never raising -- even if ProgramRelationKind grows a kind this table
hasn't caught up to yet)."""

_RELATION_PATH_NOUN: dict[str, str] = {
    "calls": "call",
    "contains": "containment",
    "imports": "import",
    "inherits": "inheritance",
}
"""Noun used by render_proposition_statement for a reachability
proposition's "... through a <noun> path" phrasing."""


def render_proposition_statement(
    proposition: ClaimProposition,
    *,
    entity_display_names: Mapping[str, str] | None = None,
) -> str:
    """Deterministically render a ClaimProposition as human-readable
    presentation text.

    This is the ONLY sanctioned way to produce the ``statement`` for a
    proposition-backed ArchitecturalClaim -- see ``ArchitecturalClaim.create``,
    which calls this internally and rejects a caller-supplied ``statement``
    whenever a ``proposition`` is given. The wording is derived exclusively
    from the proposition's own fields and, optionally, a caller-supplied
    entity-id -> display-name lookup for readability; no free-form input is
    accepted or consulted. The same proposition (and the same
    ``entity_display_names``) always renders the same statement, and the
    statement can never assert anything the proposition itself doesn't --
    which is the whole point: a supported proposition-backed claim's
    displayed text is now guaranteed to match what was actually verified.

    ``entity_display_names`` is optional and purely cosmetic: entity ids
    absent from it (or the mapping being omitted entirely) render as their
    raw id string. This function has no dependency on any particular
    symbol-store implementation -- a caller wanting readable names (e.g.
    "OrderController" instead of a run-scoped ParsedSymbol.id hash)
    resolves them itself and passes the mapping in.

    Examples (see the module docstring / Phase 3 spec this implements):
        direct_relation(A, "calls", B)              -> "A calls B."
        reachability(A, "calls", C, path=[A, B, C])  -> "A reaches C through
                                                          a call path."
    """

    def _name(entity_id: str) -> str:
        if entity_display_names is not None and entity_id in entity_display_names:
            return entity_display_names[entity_id]
        return entity_id

    if proposition.kind == "direct_relation":
        verb = _RELATION_VERB_PHRASE.get(proposition.relation_kind, proposition.relation_kind)
        return f"{_name(proposition.subject_entity_id)} {verb} {_name(proposition.object_entity_id)}."

    if proposition.kind == "reachability":
        noun = _RELATION_PATH_NOUN.get(proposition.relation_kind, proposition.relation_kind)
        return (
            f"{_name(proposition.subject_entity_id)} reaches "
            f"{_name(proposition.object_entity_id)} through a {noun} path."
        )

    raise AssertionError(  # pragma: no cover - unreachable given ClaimProposition.__post_init__
        f"unhandled ClaimProposition.kind {proposition.kind!r}"
    )


@dataclass(frozen=True)
class ProducerInfo:
    """Records what produced a claim or evidence item, and when.

    - Deterministic static-analysis extractors: producer_type="extractor",
      name is the extractor module/function (e.g.
      "static_structure.build_static_structure" or
      "provenance.claims_projection" for the reshaping helper in this
      package), version is a short revision tag the caller controls.
    - LLM-assisted layers: producer_type="llm", name is the model
      identifier (e.g. "claude-sonnet-4-5"), version is the prompt/version
      tag (e.g. "claim-extraction-v1") — pair with a prompt hash in the
      caller's own metadata if exact prompt reproduction matters.
    - Manual/curated: producer_type="manual", name is a free-form curator
      identifier, version is unused ("" is fine).
    """

    producer_type: ProducerType
    name: str
    version: str
    produced_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def __post_init__(self) -> None:
        _validate_literal(self.producer_type, get_args(ProducerType), "producer_type")
        if not self.name:
            raise ValueError("ProducerInfo requires a non-empty name")


@dataclass(frozen=True)
class EvidenceItem:
    """Base shape shared by every evidence variant.

    Not intended to be the concrete type callers construct claims from —
    use SourceSpanEvidence or RelationshipEvidence — but it is what
    EvidenceChain.items is typed as, so a chain can hold a heterogeneous,
    ordered mix of evidence variants and every element still exposes
    id/run_id/kind/producer/description without an isinstance check.
    """

    id: str
    run_id: str
    kind: EvidenceKind
    producer: ProducerInfo
    description: str

    def __post_init__(self) -> None:
        _validate_literal(self.kind, get_args(EvidenceKind), "kind")
        if not self.id:
            raise ValueError("EvidenceItem requires a non-empty id")
        if not self.run_id:
            raise ValueError("EvidenceItem requires a non-empty run_id")


@dataclass(frozen=True)
class SourceSpanEvidence(EvidenceItem):
    """Evidence that is a single inspected span of source text.

    References a SourceRegion by id (source_region_id) instead of
    duplicating its path/line/text fields. content_hash is the region's
    content hash *at the time this evidence was captured*; a caller
    revalidating the claim later can compare it against the region store's
    current hash for that id to detect drift.
    """

    source_region_id: str = ""
    content_hash: str = ""

    def __post_init__(self) -> None:
        super().__post_init__()
        if self.kind != "source_span":
            raise ValueError(f"SourceSpanEvidence.kind must be 'source_span', got {self.kind!r}")
        if not self.source_region_id:
            raise ValueError("SourceSpanEvidence requires source_region_id")
        if not self.content_hash:
            raise ValueError("SourceSpanEvidence requires content_hash")

    @staticmethod
    def create(
        *,
        run_id: str,
        source_region_id: str,
        content_hash: str,
        description: str,
        producer: ProducerInfo,
    ) -> "SourceSpanEvidence":
        evidence_id = compute_source_span_evidence_id(
            run_id=run_id,
            source_region_id=source_region_id,
            content_hash=content_hash,
            description=description,
        )
        return SourceSpanEvidence(
            id=evidence_id,
            run_id=run_id,
            kind="source_span",
            producer=producer,
            description=description,
            source_region_id=source_region_id,
            content_hash=content_hash,
        )


@dataclass(frozen=True)
class RelationshipEvidence(EvidenceItem):
    """Evidence that is a structural relationship between two symbols (a
    call edge, a containment edge, an inheritance edge, ...), as already
    discovered by the static-analysis layer (ParsedSymbol ids /
    architecture_map edges). References the two symbol ids and the
    relationship kind rather than re-deriving the relationship itself.
    source_region_id is optional: some relationships (e.g. a containment
    edge derived purely from symbol nesting) may not have one extra span of
    text beyond the two symbols' own regions.

    ``resolution_basis``/``supporting_resolution_spans`` mirror the same
    fields on ``ObservedProgramRelation`` (``core.models.program_relation``)
    -- when the relation this evidence was built from was resolved via a
    technique that needed more than the call site alone (e.g.
    ``"constructor_binding"``), that basis and its supporting spans (the
    constructor parameter annotation, the attribute assignment, ...) carry
    through here so a claim's evidence can expose *how* the relation was
    resolved, not just that it was. Both default to ``None``/``()`` for
    backward compatibility with evidence built from relations that needed
    no additional resolution evidence.
    """

    relationship_kind: RelationshipKind = "other"
    from_symbol_id: str = ""
    to_symbol_id: str = ""
    source_region_id: str | None = None
    resolution_basis: ResolutionBasis | None = None
    supporting_resolution_spans: tuple[ResolutionEvidenceSpan, ...] = ()

    def __post_init__(self) -> None:
        super().__post_init__()
        if self.kind != "relationship":
            raise ValueError(f"RelationshipEvidence.kind must be 'relationship', got {self.kind!r}")
        _validate_literal(self.relationship_kind, get_args(RelationshipKind), "relationship_kind")
        if not self.from_symbol_id or not self.to_symbol_id:
            raise ValueError("RelationshipEvidence requires from_symbol_id and to_symbol_id")

    @staticmethod
    def create(
        *,
        run_id: str,
        relationship_kind: RelationshipKind,
        from_symbol_id: str,
        to_symbol_id: str,
        description: str,
        producer: ProducerInfo,
        source_region_id: str | None = None,
        resolution_basis: ResolutionBasis | None = None,
        supporting_resolution_spans: tuple[ResolutionEvidenceSpan, ...] = (),
    ) -> "RelationshipEvidence":
        evidence_id = compute_relationship_evidence_id(
            run_id=run_id,
            relationship_kind=relationship_kind,
            from_symbol_id=from_symbol_id,
            to_symbol_id=to_symbol_id,
            description=description,
        )
        return RelationshipEvidence(
            id=evidence_id,
            run_id=run_id,
            kind="relationship",
            producer=producer,
            description=description,
            relationship_kind=relationship_kind,
            from_symbol_id=from_symbol_id,
            to_symbol_id=to_symbol_id,
            source_region_id=source_region_id,
            resolution_basis=resolution_basis,
            supporting_resolution_spans=supporting_resolution_spans,
        )


@dataclass(frozen=True)
class EvidenceChain:
    """An ordered collection of EvidenceItems supporting one
    ArchitecturalClaim. Order is significant for multi-hop claims (e.g.
    "request handler -> service -> repository -> audit log" is a 4-hop
    chain where the hops must connect in sequence); a chain with zero items
    is a valid representation of a claim for which no evidence was found
    (paired with ClaimSupportStatus "insufficient_evidence").
    """

    id: str
    run_id: str
    claim_id: str
    items: tuple[EvidenceItem, ...]
    reasoning: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("EvidenceChain requires a non-empty id")
        if not self.claim_id:
            raise ValueError("EvidenceChain requires a non-empty claim_id")
        mismatched = [item.run_id for item in self.items if item.run_id != self.run_id]
        if mismatched:
            raise ValueError(
                f"EvidenceChain items must share run_id {self.run_id!r}, found {mismatched!r}"
            )

    @property
    def hop_count(self) -> int:
        return len(self.items)

    @property
    def is_multi_hop(self) -> bool:
        return self.hop_count > 1

    @staticmethod
    def create(
        *, run_id: str, claim_id: str, items: tuple[EvidenceItem, ...], reasoning: str = ""
    ) -> "EvidenceChain":
        chain_id = compute_evidence_chain_id(
            run_id=run_id, claim_id=claim_id, evidence_ids=tuple(item.id for item in items)
        )
        return EvidenceChain(
            id=chain_id, run_id=run_id, claim_id=claim_id, items=items, reasoning=reasoning
        )


@dataclass(frozen=True)
class ArchitecturalClaim:
    """A claim-level architectural assertion, scoped to one analysis run,
    carrying its own epistemic type, aggregate support status, and the
    EvidenceChain that backs (or fails to back) it.

    related_symbol_ids / related_lens_ids are cross-reference conveniences
    (e.g. so a claim can be looked up per ParsedSymbol.id or per Lens.id)
    and are not part of the claim's identity — only run_id, statement,
    epistemic_type, subject_symbol_ids, and proposition (passed to
    compute_claim_id) are. That keeps the id stable if a claim later gets
    attached to an additional lens without changing what the claim asserts.

    ``proposition`` is optional: claims produced through the new
    proposition-verified pathway (see ``verify_proposition`` below) always
    carry one, and it is what a verifier checks against real
    ObservedProgramRelation evidence -- ``statement`` is presentation only
    for those claims, never the source of truth. It is ``None`` for claims
    produced by pathways that predate this contract (e.g. the citation-based
    ``app/provenance/claim_projection.py`` reshaping of pre-existing
    GroundedClaim data, which has no ObservedProgramRelation evidence to
    build a structured proposition from) -- this module does not force
    every ArchitecturalClaim to have one, only claims that actually went
    through proposition-based verification.
    """

    id: str
    run_id: str
    statement: str
    epistemic_type: ClaimEpistemicType
    support_status: ClaimSupportStatus
    confidence: float | None
    producer: ProducerInfo
    evidence_chain: EvidenceChain
    proposition: ClaimProposition | None = None
    subject_symbol_ids: tuple[str, ...] = ()
    related_lens_ids: tuple[str, ...] = ()
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def __post_init__(self) -> None:
        _validate_literal(self.epistemic_type, get_args(ClaimEpistemicType), "epistemic_type")
        _validate_literal(self.support_status, get_args(ClaimSupportStatus), "support_status")
        if not self.id:
            raise ValueError("ArchitecturalClaim requires a non-empty id")
        if not self.run_id:
            raise ValueError("ArchitecturalClaim requires a non-empty run_id")
        if not self.statement.strip():
            raise ValueError("ArchitecturalClaim requires a non-empty statement")
        if self.confidence is not None and not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"ArchitecturalClaim.confidence must be in [0, 1], got {self.confidence!r}")
        if self.evidence_chain.run_id != self.run_id:
            raise ValueError("ArchitecturalClaim.evidence_chain.run_id must match the claim's run_id")
        if self.evidence_chain.claim_id != self.id:
            raise ValueError("ArchitecturalClaim.evidence_chain.claim_id must match the claim's id")

    @staticmethod
    def create(
        *,
        run_id: str,
        epistemic_type: ClaimEpistemicType,
        support_status: ClaimSupportStatus,
        confidence: float | None,
        producer: ProducerInfo,
        evidence_items: tuple[EvidenceItem, ...],
        proposition: ClaimProposition | None = None,
        statement: str | None = None,
        entity_display_names: Mapping[str, str] | None = None,
        subject_symbol_ids: tuple[str, ...] = (),
        related_lens_ids: tuple[str, ...] = (),
        reasoning: str = "",
    ) -> "ArchitecturalClaim":
        """Build an ArchitecturalClaim and its EvidenceChain together,
        computing both deterministic ids in the correct order (the claim id
        does not depend on the chain, but the chain id incorporates the
        claim id, so the claim id is computed first).

        ``statement`` handling depends on whether ``proposition`` is given:

        - ``proposition`` present: ``statement`` MUST NOT be supplied
          (passing one raises ``ValueError``) -- the displayed text is
          generated deterministically via ``render_proposition_statement``
          instead, so a proposition-backed claim's presentation can never
          diverge from, or assert more than, what was actually verified.
          Pass ``entity_display_names`` for readable names in the
          generated text.
        - ``proposition`` absent (legacy path, e.g. the citation-based
          ``claim_projection`` reshaping): ``statement`` is required, as
          before.
        """
        if proposition is not None:
            if statement is not None:
                raise ValueError(
                    "ArchitecturalClaim.create: 'statement' must not be supplied when "
                    "'proposition' is given -- the statement is generated deterministically "
                    "from the proposition (see render_proposition_statement) so a supported "
                    "claim's displayed text always matches what was actually verified, never "
                    "arbitrary caller-supplied prose. Pass entity_display_names= instead for "
                    "readable names in the generated text."
                )
            resolved_statement = render_proposition_statement(
                proposition, entity_display_names=entity_display_names
            )
        else:
            if not statement:
                raise ValueError(
                    "ArchitecturalClaim.create: 'statement' is required when no 'proposition' "
                    "is given"
                )
            resolved_statement = statement

        claim_id = compute_claim_id(
            run_id=run_id,
            statement=resolved_statement,
            epistemic_type=epistemic_type,
            subject_symbol_ids=subject_symbol_ids,
            proposition=proposition,
        )
        chain = EvidenceChain.create(
            run_id=run_id, claim_id=claim_id, items=evidence_items, reasoning=reasoning
        )
        return ArchitecturalClaim(
            id=claim_id,
            run_id=run_id,
            statement=resolved_statement,
            epistemic_type=epistemic_type,
            support_status=support_status,
            confidence=confidence,
            producer=producer,
            evidence_chain=chain,
            proposition=proposition,
            subject_symbol_ids=subject_symbol_ids,
            related_lens_ids=related_lens_ids,
        )


@dataclass(frozen=True)
class PropositionVerification:
    """Result of checking whether a ClaimProposition is entailed by a given
    tuple of ObservedProgramRelation evidence. Returned by
    verify_proposition; never raises for an unsupported proposition -- an
    unsupported result is an ordinary, expected outcome (most candidate
    claims about a codebase are NOT supported by any given evidence set),
    not an error.
    """

    supported: bool
    matched_relation_ids: tuple[str, ...]
    reason: str


def verify_proposition(
    proposition: ClaimProposition,
    relations: tuple[ObservedProgramRelation, ...],
) -> PropositionVerification:
    """Deterministically check whether ``relations`` entail ``proposition``.
    This is the machine-verifiable core the module docstring's
    "Machine-verifiable claim semantics" section describes: no natural
    language is examined here at all, only entity ids and relation kinds.

    Support policy (first, precision-first feasibility prototype):

    - Only relations with ``resolution_status == "resolved"`` can prove a
      definite, target-specific proposition. A "partial" relation's target
      was reached via a heuristic that is not always correct, and an
      "unresolved" relation has no confirmed target entity at all -- using
      either to mark a proposition "supported" would let an uncertain guess
      stand in as fact. Both kinds of relations are still valid, useful
      *evidence to retain* (e.g. for a future, separately-designed
      inferred/probabilistic claim pathway) -- verify_proposition simply
      never treats them as sufficient, on their own, to prove a proposition
      true. A relation with a non-"resolved" status is never even
      considered as a candidate match below; it neither helps nor hurts the
      other candidates, it is just skipped.
    - "direct_relation": requires *exactly one* resolved relation whose
      (source_entity_id, relation_kind, target_entity_id) triple exactly
      equals (subject_entity_id, relation_kind, object_entity_id). A
      multi-hop path that *does* connect subject to object through
      intermediate entities does NOT satisfy a direct_relation proposition,
      even if every hop is individually resolved -- this is the precision
      property that prevents a real, connected, but unrelated-to-the-claim
      evidence chain (e.g. "Controller calls Service, Service calls
      PaymentService") from being mistaken for support of a direct claim
      about entities at the ends of that chain (e.g. "Controller calls
      PaymentService", which was never actually observed -- only reachable
      through Service).
    - "reachability": requires a resolved relation of ``relation_kind`` for
      EVERY consecutive pair in ``path_entity_ids``, connecting all the way
      from subject to object in order. Any single missing or
      non-resolved-only hop fails the whole proposition (returns
      unsupported, not partially supported -- ClaimSupportStatus has no
      partial-support state, only supported/insufficient_evidence/
      contradicted).

    A proposition asserting something outside the ProgramRelationKind
    vocabulary (e.g. a behavioral claim like "performs fraud detection")
    cannot even be constructed as a ClaimProposition in the first place
    (see PropositionKind's docstring) -- so there is no code path here that
    could mark such a claim "supported" from structural relation evidence.
    """
    resolved = tuple(r for r in relations if r.resolution_status == "resolved")

    if proposition.kind == "direct_relation":
        for r in resolved:
            if (
                r.relation_kind == proposition.relation_kind
                and r.source_entity_id == proposition.subject_entity_id
                and r.target_entity_id == proposition.object_entity_id
            ):
                return PropositionVerification(
                    supported=True,
                    matched_relation_ids=(r.id,),
                    reason=(
                        f"found a resolved '{proposition.relation_kind}' relation directly "
                        f"connecting {proposition.subject_entity_id!r} to "
                        f"{proposition.object_entity_id!r}"
                    ),
                )
        return PropositionVerification(
            supported=False,
            matched_relation_ids=(),
            reason=(
                f"no resolved '{proposition.relation_kind}' relation directly connects "
                f"{proposition.subject_entity_id!r} to {proposition.object_entity_id!r} "
                "(a multi-hop path, or a partial/unresolved relation, does not satisfy a "
                "direct_relation proposition)"
            ),
        )

    if proposition.kind == "reachability":
        path = proposition.path_entity_ids
        matched: list[str] = []
        for left, right in zip(path, path[1:]):
            hop = next(
                (
                    r
                    for r in resolved
                    if r.relation_kind == proposition.relation_kind
                    and r.source_entity_id == left
                    and r.target_entity_id == right
                ),
                None,
            )
            if hop is None:
                return PropositionVerification(
                    supported=False,
                    matched_relation_ids=tuple(matched),
                    reason=(
                        f"no resolved '{proposition.relation_kind}' relation found for hop "
                        f"{left!r} -> {right!r}; {len(matched)}/{len(path) - 1} preceding hop(s) "
                        "were matched before this gap"
                    ),
                )
            matched.append(hop.id)
        return PropositionVerification(
            supported=True,
            matched_relation_ids=tuple(matched),
            reason=f"all {len(matched)} hop(s) in the path are resolved and connected in order",
        )

    raise AssertionError(  # pragma: no cover - unreachable given ClaimProposition.__post_init__
        f"unhandled ClaimProposition.kind {proposition.kind!r}"
    )
