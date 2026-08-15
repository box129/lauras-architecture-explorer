#!/usr/bin/env python3
"""First real end-to-end feasibility experiment for the provenance pipeline.

Location / naming note
-----------------------
This module lives at ``research/e2e-evaluation-bridge/`` (parallel to the
existing ``research/provenance-evaluation/`` harness), matching this git
branch's name (``research/e2e-evaluation-bridge``). It is a plain,
importable Python module plus a companion pytest file
(``test_e2e_bridge.py``) rather than a backend integration test under
``syntax-tree-refurbished-backend/tests/``, because this experiment's
subject matter spans *two* independently-versioned trees that do not share
a Python package root: the backend's ``syntax_tree_refurbished`` package
(``syntax-tree-refurbished-backend/src/``) AND the standalone
``research/provenance-evaluation/evaluator`` metrics harness. Keeping it
under ``research/`` -- with its own small ``sys.path`` bootstrap below, the
same pattern already used by ``research/provenance-evaluation/run_example.py``
and ``research/provenance-evaluation/tests/test_metrics_e2e.py`` -- avoids
either package having to depend on, or vendor, the other.

What this proves, end-to-end, with NO hand-built shortcuts at any
evidence-producing step
--------------------------------------------------------------------------
    controlled fixture repository (research/provenance-evaluation/fixtures/python_app/)
      -> normal Laura's analysis: AnalysisController.analyze(repo_path)
      -> actual ParsedSymbols: store.get_symbols(run_id)
      -> actual call/inheritance extractor output (the real "relations" stage
         wired into AnalysisController.run(), calling extract_call_relations
         and extract_inheritance_relations on the SAME parsed symbols)
      -> persisted/retrieved ObservedProgramRelations:
         store.get_relations(run_id) -- this experiment deliberately reads
         relations back OUT of the run store after analysis has completed,
         never from job.relations directly, specifically to exercise the
         real put_relations/get_relations persistence round-trip rather than
         merely trusting the in-process attribute the controller also set.
      -> ClaimPropositions, built here using REAL entity ids resolved out of
         store.get_symbols(run_id) (never invented ids, except the one
         explicitly-synthetic id documented below for the C10 false-target
         case, which is a deliberate, documented exception -- see
         SQL_REPOSITORY_SYNTHETIC_ID).
      -> core.models.provenance.verify_proposition, invoked through
         app.provenance.relation_adapter.claim_from_proposition (never
         reimplemented or bypassed here).
      -> ArchitecturalClaims (real, adapter-produced).
      -> research/provenance-evaluation/evaluator/metrics.py, via a small
         bridge into that module's GroundTruth/CandidateSet/EvidenceItem
         schema (evaluator/schema.py) built from the real ArchitecturalClaim
         results above. This bridge -- turning real ArchitecturalClaim /
         RelationshipEvidence objects into the evaluator's schema shapes --
         is the "bridge" this workstream (and this git branch) is named for.

Nothing here hand-constructs an ObservedProgramRelation as evidence for the
principal run (see run_experiment() below): the only relations ever fed to
claim_from_proposition are exactly what
``store.get_relations(job.run_id)`` returns after a real
``AnalysisController.analyze()`` call against the real fixture directory.

Scoping analysis vs. what the real system actually does (IMPORTANT --
corrects an assumption made before this experiment was run)
--------------------------------------------------------------------------
The task brief that set up this experiment assumed claims C1/C2/C3/C5 (all
"OrderController place_order calls ...", "OrderService.create_order calls
...", chained via the Controller -> Service -> {PaymentService,
OrderRepository} architecture) would come back ``supported`` once run
through the real extractor, because the underlying source code genuinely
does contain those calls. Running the real pipeline against the real
fixture (see the "relations" print-out captured while building this
experiment) shows that assumption was WRONG in one concrete, well-understood
way:

    calls unresolved | OrderController.place_order -> self.order_service.create_order
    calls unresolved | OrderService.create_order    -> self.payment_service.charge
    calls unresolved | OrderService.create_order    -> self.repository.save
    inherits resolved | OrderRepository -> InMemoryRepository

Every call in this fixture is written as ``self.<injected_dependency>.<method>()``,
where ``<injected_dependency>`` (``order_service``, ``payment_service``,
``repository``) is a constructor-injected attribute assigned in ``__init__``
from a parameter -- e.g. ``self.order_service = order_service``. Per
``python_call_extractor``'s own module docstring ("What this extractor
resolves"), only three call shapes resolve: (a) ``self.method()`` where
``method`` is defined directly on the *same* class, (b) a same-expression
constructor-then-call chain (``SomeClass().method()``), or (c) a local
variable directly assigned a constructor call within the *same function*
(``obj = SomeClass(); obj.method()``, tracked via the extractor's
"variable-type tracking" heuristic). ``self.order_service.create_order()``
is none of these: the attribute chain has TWO hops (``self`` ->
``order_service`` -> ``create_order``), and ``order_service`` was never
locally assigned a constructor call anywhere in ``place_order`` (it was
assigned in a *different* method, ``__init__``, from a parameter, not a
constructor call) -- so this extractor's own, explicitly-scoped resolution
logic correctly and deliberately leaves it "unresolved" rather than
guessing. This is not a bug to fix here (the extractor is frozen for this
task); it is a genuine, now-empirically-confirmed precision/recall
limitation of the current extractor's scope when applied to a
dependency-injection-style codebase, and it is exactly the kind of finding
a real end-to-end experiment is supposed to surface that a hand-simulated
one would not.

Consequently, in the run captured by this experiment: C1, C2, C3, and C5
all come back ``insufficient_evidence`` from the REAL system, not
``supported`` -- not because the claims are false (the calls really are
there in the source), but because the real deterministic extractor's
resolution heuristics do not cover this call shape. Only the two C10-derived
propositions (both ``direct_relation``/``inherits``, resolved by the
*inheritance* extractor, which handles explicit same-file base-class
declarations directly and has no equivalent gap for this fixture) come back
with the outcome the original scoping analysis predicted: C10-true
(OrderRepository inherits InMemoryRepository) -> supported; C10-false
(OrderRepository inherits the nonexistent SqlRepository) ->
insufficient_evidence.

This module reports BOTH the pre-run expected outcome (per the original
scoping analysis / the "true fact about the code" a correct system should
ideally recognize) and the actual real-system outcome for every
proposition, so the gap above is visible in the printed summary and in the
bridged metrics (which will show reduced claim_support_recall / increased
insufficient_evidence rate on C1/C2/C3/C5) rather than being papered over.

C4/C6/C7/C8/C9: out of scope (see OUT_OF_SCOPE_CLAIMS below for the
one-line reason for each), per the original scoping analysis, confirmed
correct by inspection of core.models.provenance.ClaimProposition /
ProgramRelationKind -- none of them invoked the pipeline at all, so there is
nothing about the real extractor run that could change their scope status.

C10 contradiction handling
---------------------------
The false C10 proposition (OrderRepository inherits a synthetic
"SqlRepository" id that does not correspond to any real analyzed entity)
is expected -- and, when run, confirmed -- to come back
``insufficient_evidence``, not ``contradicted``. This is CORRECT, not a
failure: ``app/provenance/relation_adapter.py``'s own module docstring
("Scope boundary: contradicted") documents that this adapter never
auto-detects contradictions -- only an explicit, caller-driven
``assert_contradicted=True`` pass-through can produce that status, and nothing
in this experiment invokes it for C10. A missing/absent resolved relation is
consistent with "the proposition is false" OR "the evidence just hasn't
been collected", and the adapter deliberately, conservatively reports the
same "insufficient_evidence" for both rather than guessing which. See
build_c10_propositions() below for the synthetic-id documentation.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

# --- sys.path bootstrap -----------------------------------------------------
# Two independent trees need to be importable: the backend package (for the
# real analysis pipeline / provenance domain model) and the standalone
# evaluator harness (for the metrics bridge). Neither tree depends on the
# other; both are added explicitly rather than relying on any installed
# package or conftest.py magic, so this module runs the same way whether
# invoked as `python experiment.py`, `pytest test_e2e_bridge.py`, or
# `pytest research/e2e-evaluation-bridge` from the repo root.
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "syntax-tree-refurbished-backend" / "src"
EVALUATOR_ROOT = REPO_ROOT / "research" / "provenance-evaluation"
FIXTURE_ROOT = EVALUATOR_ROOT / "fixtures" / "python_app"

for p in (str(BACKEND_SRC), str(EVALUATOR_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from syntax_tree_refurbished.app.analysis.analysis_controller import AnalysisController  # noqa: E402
from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob  # noqa: E402
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore  # noqa: E402
from syntax_tree_refurbished.app.provenance.relation_adapter import claim_from_proposition  # noqa: E402
from syntax_tree_refurbished.config import Settings  # noqa: E402
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol  # noqa: E402
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation  # noqa: E402
from syntax_tree_refurbished.core.models.provenance import (  # noqa: E402
    ArchitecturalClaim,
    ClaimEpistemicType,
    ClaimProposition,
    ProducerInfo,
)

from evaluator.metrics import EvaluationReport, evaluate  # noqa: E402
from evaluator.schema import (  # noqa: E402
    CandidateClaim,
    CandidateSet,
    EvidenceItem,
    GroundTruth,
    GroundTruthClaim,
)


PRODUCER = ProducerInfo(
    producer_type="extractor",
    name="research.e2e_evaluation_bridge.experiment",
    version="v1",
)

# A deliberately synthetic entity id for the C10 false-target proposition:
# "SqlRepository" does not exist anywhere in the fixture or the real
# analysis output (there is no such class), so there is no real
# ParsedSymbol.id to use. ClaimProposition itself does not require
# object_entity_id to correspond to a real analyzed entity (only
# verify_proposition checks whether evidence supports it) -- see
# core.models.program_relation's own docstring on why ObservedProgramRelation
# is stricter about this than ClaimProposition is. The prefix makes it
# obviously not a real content-hash id (real ids look like
# "symbol:<24 hex chars>"), so nobody could mistake this for genuine output.
SQL_REPOSITORY_SYNTHETIC_ID = "synthetic-nonexistent-entity:SqlRepository"

OUT_OF_SCOPE_CLAIMS: tuple[tuple[str, str], ...] = (
    (
        "C4",
        "3rd hop asserts 'operates_on' (OrderRepository.save operates_on Order), a "
        "relation kind the real extractors never produce and that does not exist in "
        "ProgramRelationKind (contains/imports/calls/inherits only). Not expressible "
        "as a ClaimProposition without inventing a new relation kind, which is "
        "explicitly forbidden for this experiment. (A supplementary, genuinely 2-hop, "
        "same-kind 'calls' variant covering just Controller->Service->Repository, "
        "dropping the unexpressible 3rd hop, is built separately below as a labeled "
        "bonus data point -- see build_supplementary_c4_variant().)",
    ),
    ("C6", "Behavioral claim (OAuth2 authentication) -- no relation_kind can express it."),
    ("C7", "Behavioral claim (confirmation email) -- no relation_kind can express it."),
    ("C8", "Behavioral claim (fraud detection) -- no relation_kind can express it."),
    ("C9", "Behavioral claim (SQL persistence) -- no relation_kind can express it."),
)
"""Confirms the original scoping analysis for C4/C6/C7/C8/C9: all five are
correctly out of scope, for the reasons given. No pipeline call is made for
any of them -- there is nothing to run, by construction, since none of them
can even be phrased as a ClaimProposition."""


@dataclass(frozen=True)
class PropositionCase:
    """One proposition this experiment verifies against real evidence, plus
    the bookkeeping needed to report and score it."""

    key: str
    label: str
    proposition: ClaimProposition
    epistemic_type: ClaimEpistemicType
    expected_support_status_per_scoping: Literal["supported", "insufficient_evidence"]
    category: Literal["supported_observed", "supported_multi_hop", "insufficient_evidence"]
    note: str
    included_in_scored_ground_truth: bool = True


@dataclass(frozen=True)
class ExperimentResult:
    run_id: str
    job: AnalysisJob
    symbols: tuple[ParsedSymbol, ...]
    relations_from_store: tuple[ObservedProgramRelation, ...]
    relations_from_job_attr: tuple[ObservedProgramRelation, ...]
    entity_display_names: dict[str, str]
    cases: tuple[PropositionCase, ...]
    claims_by_key: dict[str, ArchitecturalClaim]
    supplementary_case: PropositionCase
    supplementary_claim: ArchitecturalClaim
    ground_truth: GroundTruth
    candidate_set: CandidateSet
    report: EvaluationReport


def _find_symbol(
    symbols: tuple[ParsedSymbol, ...],
    *,
    path_suffix: str,
    name: str,
    kind: str,
) -> ParsedSymbol:
    """Resolve a real ParsedSymbol by (repo-relative path suffix, name, kind)
    out of the REAL symbols the real parsing stage produced -- never a
    guessed/hand-authored qualified_name string (per the task brief: 'find
    the ones matching each named entity... inspect the actual ParsedSymbol
    objects returned to get the exact matching pattern')."""
    matches = [
        s
        for s in symbols
        if s.path.replace("\\", "/").endswith(path_suffix) and s.name == name and s.kind == kind
    ]
    if len(matches) != 1:
        raise AssertionError(
            f"expected exactly one real ParsedSymbol matching path ending "
            f"{path_suffix!r}, name={name!r}, kind={kind!r}; found {len(matches)}: {matches}"
        )
    return matches[0]


def _display_name(symbol: ParsedSymbol) -> str:
    """Human-readable label derived straight from the symbol's own
    qualified_name (format 'python:<path>::<Dotted.Name>'), not a hand-typed
    guess."""
    return symbol.qualified_name.split("::", 1)[1]


def run_real_analysis() -> tuple[InMemoryRunStore, AnalysisJob]:
    """Run the REAL Laura's analysis pipeline (AnalysisController.analyze)
    against the REAL, existing fixture directory. No copying, no mocking, no
    hand-built symbols/relations."""
    settings = Settings(environment="test", database_path=":memory:")
    store = InMemoryRunStore()
    controller = AnalysisController(settings=settings, store=store)
    job = controller.analyze(str(FIXTURE_ROOT))
    if job.status != "completed":
        raise AssertionError(f"real analysis run did not complete: status={job.status} error={job.error!r}")
    return store, job


def build_cases(symbols: tuple[ParsedSymbol, ...]) -> tuple[tuple[PropositionCase, ...], dict[str, str]]:
    """Build the 6 principal ClaimPropositions (C1, C2, C3, C5, C10-true,
    C10-false) using ONLY real entity ids resolved from the real symbol
    set (plus the one documented synthetic id for C10-false's nonexistent
    target)."""
    controller_place_order = _find_symbol(
        symbols, path_suffix="controllers/order_controller.py", name="place_order", kind="method"
    )
    service_create_order = _find_symbol(
        symbols, path_suffix="services/order_service.py", name="create_order", kind="method"
    )
    payment_charge = _find_symbol(
        symbols, path_suffix="services/payment_service.py", name="charge", kind="method"
    )
    repo_save = _find_symbol(
        symbols, path_suffix="repositories/order_repository.py", name="save", kind="method"
    )
    order_repository_class = _find_symbol(
        symbols, path_suffix="repositories/order_repository.py", name="OrderRepository", kind="class"
    )
    in_memory_repository_class = _find_symbol(
        symbols, path_suffix="repositories/base.py", name="InMemoryRepository", kind="class"
    )

    entity_display_names = {
        controller_place_order.id: _display_name(controller_place_order),
        service_create_order.id: _display_name(service_create_order),
        payment_charge.id: _display_name(payment_charge),
        repo_save.id: _display_name(repo_save),
        order_repository_class.id: _display_name(order_repository_class),
        in_memory_repository_class.id: _display_name(in_memory_repository_class),
        SQL_REPOSITORY_SYNTHETIC_ID: "SqlRepository (synthetic -- does not exist in fixture)",
    }

    cases = (
        PropositionCase(
            key="C1",
            label="OrderController.place_order calls OrderService.create_order",
            proposition=ClaimProposition(
                kind="direct_relation",
                subject_entity_id=controller_place_order.id,
                relation_kind="calls",
                object_entity_id=service_create_order.id,
            ),
            epistemic_type="observed",
            expected_support_status_per_scoping="supported",
            category="supported_observed",
            note="Ground-truth C1.",
        ),
        PropositionCase(
            key="C2",
            label="OrderService.create_order calls PaymentService.charge",
            proposition=ClaimProposition(
                kind="direct_relation",
                subject_entity_id=service_create_order.id,
                relation_kind="calls",
                object_entity_id=payment_charge.id,
            ),
            epistemic_type="observed",
            expected_support_status_per_scoping="supported",
            category="supported_observed",
            note="Ground-truth C2.",
        ),
        PropositionCase(
            key="C3",
            label="OrderService.create_order calls OrderRepository.save",
            proposition=ClaimProposition(
                kind="direct_relation",
                subject_entity_id=service_create_order.id,
                relation_kind="calls",
                object_entity_id=repo_save.id,
            ),
            epistemic_type="observed",
            expected_support_status_per_scoping="supported",
            category="supported_observed",
            note="Ground-truth C3.",
        ),
        PropositionCase(
            key="C5",
            label="OrderController.place_order reaches PaymentService.charge via a call path",
            proposition=ClaimProposition(
                kind="reachability",
                subject_entity_id=controller_place_order.id,
                relation_kind="calls",
                object_entity_id=payment_charge.id,
                path_entity_ids=(controller_place_order.id, service_create_order.id, payment_charge.id),
            ),
            epistemic_type="inferred",
            expected_support_status_per_scoping="supported",
            category="supported_multi_hop",
            note="Ground-truth C5 (2-hop reachability, both hops 'calls').",
        ),
        PropositionCase(
            key="C10-true",
            label="OrderRepository inherits InMemoryRepository (the TRUE base class)",
            proposition=ClaimProposition(
                kind="direct_relation",
                subject_entity_id=order_repository_class.id,
                relation_kind="inherits",
                object_entity_id=in_memory_repository_class.id,
            ),
            epistemic_type="observed",
            expected_support_status_per_scoping="supported",
            category="supported_observed",
            note="TRUE contrast half of ground-truth C10 (the real base class).",
        ),
        PropositionCase(
            key="C10-false",
            label="OrderRepository inherits SqlRepository (the FALSE claim from ground-truth C10)",
            proposition=ClaimProposition(
                kind="direct_relation",
                subject_entity_id=order_repository_class.id,
                relation_kind="inherits",
                object_entity_id=SQL_REPOSITORY_SYNTHETIC_ID,
            ),
            epistemic_type="observed",
            # Expected REAL-SYSTEM outcome for a false claim, given this
            # adapter's documented "no auto-contradiction-detection" scope
            # boundary (see module docstring): insufficient_evidence, NOT
            # supported. (Not "contradicted" either -- that would require
            # assert_contradicted=True, which this experiment never passes
            # for a proposition-verified claim.)
            expected_support_status_per_scoping="insufficient_evidence",
            category="insufficient_evidence",
            note=(
                "Ground-truth C10's FALSE claim, verified as a direct_relation proposition "
                "against real evidence. object_entity_id is the documented synthetic id "
                f"{SQL_REPOSITORY_SYNTHETIC_ID!r} (see module docstring)."
            ),
        ),
    )
    return cases, entity_display_names


def build_supplementary_c4_variant(
    symbols: tuple[ParsedSymbol, ...], entity_display_names: dict[str, str]
) -> PropositionCase:
    """Bonus/supplementary data point (NOT a stand-in for ground-truth C4,
    and NOT part of the scored 6-item principal set): a genuinely 2-hop,
    same-kind ('calls') reachability proposition covering just
    Controller -> Service -> Repository, dropping C4's unexpressible 3rd
    ('operates_on') hop. Uses claim_id 'novel:...' when bridged into the
    evaluator schema so it is reported but automatically excluded from
    precision/recall/etc (see evaluator/schema.py's CandidateClaim.is_novel
    and evaluator/metrics.py's handling of unmatched claim ids)."""
    controller_place_order = _find_symbol(
        symbols, path_suffix="controllers/order_controller.py", name="place_order", kind="method"
    )
    service_create_order = _find_symbol(
        symbols, path_suffix="services/order_service.py", name="create_order", kind="method"
    )
    repo_save = _find_symbol(
        symbols, path_suffix="repositories/order_repository.py", name="save", kind="method"
    )
    return PropositionCase(
        key="novel:C4-2hop-calls-only",
        label=(
            "[supplementary, modified from C4] OrderController.place_order reaches "
            "OrderRepository.save via a call path (drops C4's unexpressible 3rd "
            "'operates_on' hop)"
        ),
        proposition=ClaimProposition(
            kind="reachability",
            subject_entity_id=controller_place_order.id,
            relation_kind="calls",
            object_entity_id=repo_save.id,
            path_entity_ids=(controller_place_order.id, service_create_order.id, repo_save.id),
        ),
        epistemic_type="inferred",
        expected_support_status_per_scoping="supported",
        category="supported_multi_hop",
        note=(
            "NOT ground-truth C4 (which requires an unexpressible 'operates_on' 3rd hop). "
            "Reported as a labeled bonus data point only; excluded from the scored "
            "principal 6-proposition set and from the bridged ground truth."
        ),
        included_in_scored_ground_truth=False,
    )


def build_ground_truth(cases: tuple[PropositionCase, ...], relations: tuple[ObservedProgramRelation, ...]) -> GroundTruth:
    """Bridge the 6 principal PropositionCases into evaluator.schema.GroundTruth.

    expected_evidence is built from REAL span data pulled out of the real,
    persisted-and-retrieved `relations` pool -- even for C1/C2/C3/C5, whose
    calls the real extractor left 'unresolved' (see module docstring): the
    call site itself is still a real, located fact (span_path/span_start_line/
    span_end_line on the real ObservedProgramRelation the extractor emitted
    for that call expression), we just don't get to cite it as PROOF via
    verify_proposition because the extractor didn't attach a resolved
    target_entity_id to it. Using its real span for the ground-truth's
    'what a fully-resolving extractor would have cited' expectation keeps
    this bridge honest -- no fabricated line numbers.
    """
    gt_claims = []
    for case in cases:
        if not case.included_in_scored_ground_truth:
            continue
        expected_evidence: tuple[EvidenceItem, ...]
        if case.expected_support_status_per_scoping != "supported":
            expected_evidence = ()
        elif case.proposition.kind == "direct_relation":
            rel = _find_span_for_edge(
                relations,
                relation_kind=case.proposition.relation_kind,
                source_entity_id=case.proposition.subject_entity_id,
                target_entity_id_if_resolved=case.proposition.object_entity_id,
            )
            expected_evidence = (_evidence_item_from_relation_span(case.proposition, rel),) if rel else ()
        else:  # reachability
            items = []
            path = case.proposition.path_entity_ids
            for left, right in zip(path, path[1:]):
                rel = _find_span_for_edge(
                    relations,
                    relation_kind=case.proposition.relation_kind,
                    source_entity_id=left,
                    target_entity_id_if_resolved=right,
                )
                if rel:
                    items.append(
                        EvidenceItem(
                            evidence_type="relationship",
                            file=rel.span_path or "unknown",
                            start_line=rel.span_start_line or 0,
                            end_line=rel.span_end_line or 0,
                            relationship_type=case.proposition.relation_kind,
                            source_symbol_id=left,
                            target_symbol_id=right,
                        )
                    )
            expected_evidence = tuple(items)

        gt_claims.append(
            GroundTruthClaim(
                claim_id=case.key,
                text=case.label,
                category=case.category,
                expected_support_status=case.expected_support_status_per_scoping,
                expected_epistemic_type=case.epistemic_type,
                expected_evidence=expected_evidence,
                note=case.note,
            )
        )
    return GroundTruth(fixture_root="python_app", claims=tuple(gt_claims))


def _find_span_for_edge(
    relations: tuple[ObservedProgramRelation, ...],
    *,
    relation_kind: str,
    source_entity_id: str,
    target_entity_id_if_resolved: str,
) -> ObservedProgramRelation | None:
    """Find the real ObservedProgramRelation the extractor actually emitted
    for this (source, relation_kind) edge -- regardless of whether it ended
    up resolved to target_entity_id_if_resolved -- so the ground truth's
    expected_evidence can cite the REAL call-site span. Prefers an exact
    resolved match; falls back to any relation of the right kind from the
    right source (there is at most one call site per hop in this fixture)."""
    exact = [
        r
        for r in relations
        if r.relation_kind == relation_kind
        and r.source_entity_id == source_entity_id
        and r.target_entity_id == target_entity_id_if_resolved
    ]
    if exact:
        return exact[0]
    same_source = [r for r in relations if r.relation_kind == relation_kind and r.source_entity_id == source_entity_id]
    return same_source[0] if same_source else None


def _evidence_item_from_relation_span(proposition: ClaimProposition, rel: ObservedProgramRelation) -> EvidenceItem:
    return EvidenceItem(
        evidence_type="relationship",
        file=rel.span_path or "unknown",
        start_line=rel.span_start_line or 0,
        end_line=rel.span_end_line or 0,
        relationship_type=proposition.relation_kind,
        source_symbol_id=proposition.subject_entity_id,
        target_symbol_id=proposition.object_entity_id,
    )


def build_candidate_set(
    cases: tuple[PropositionCase, ...],
    claims_by_key: dict[str, ArchitecturalClaim],
    relations: tuple[ObservedProgramRelation, ...],
    supplementary_case: PropositionCase | None = None,
    supplementary_claim: ArchitecturalClaim | None = None,
) -> CandidateSet:
    """Bridge the real ArchitecturalClaim results (produced by
    claim_from_proposition against the real, persisted-and-retrieved
    relations pool) into evaluator.schema.CandidateSet -- this is the
    'real analyzer-produced evidence' half of the metrics comparison."""
    candidate_claims = []
    all_cases = list(cases)
    all_claims = dict(claims_by_key)
    if supplementary_case is not None and supplementary_claim is not None:
        all_cases.append(supplementary_case)
        all_claims[supplementary_case.key] = supplementary_claim

    for case in all_cases:
        claim = all_claims[case.key]
        evidence_items = tuple(
            _evidence_item_from_relationship_evidence(item, relations) for item in claim.evidence_chain.items
        )
        candidate_claims.append(
            CandidateClaim(
                claim_id=case.key,
                text=claim.statement,
                support_status=claim.support_status,
                epistemic_type=claim.epistemic_type,
                evidence=evidence_items,
            )
        )
    return CandidateSet(
        claims=tuple(candidate_claims),
        description="Real ArchitecturalClaim results from claim_from_proposition, verified against store.get_relations(run_id).",
    )


def _evidence_item_from_relationship_evidence(evidence_item, relations: tuple[ObservedProgramRelation, ...]) -> EvidenceItem:
    """Recover file/line span for a RelationshipEvidence item (which itself
    carries no span -- see relation_adapter.py's relationship_evidence_from_relations,
    which sets source_region_id=None) by matching it back to the real
    ObservedProgramRelation it was built from in the candidate pool. This is
    a lookup against real data, not a fabrication: from_symbol_id/to_symbol_id/
    relationship_kind together identify the exact relation that produced
    this evidence item (see compute_relationship_evidence_id's identity
    fields)."""
    match = next(
        (
            r
            for r in relations
            if r.relation_kind == evidence_item.relationship_kind
            and r.source_entity_id == evidence_item.from_symbol_id
            and r.target_entity_id == evidence_item.to_symbol_id
        ),
        None,
    )
    return EvidenceItem(
        evidence_type="relationship",
        file=(match.span_path if match and match.span_path else "unknown"),
        start_line=(match.span_start_line if match and match.span_start_line else 0),
        end_line=(match.span_end_line if match and match.span_end_line else 0),
        relationship_type=evidence_item.relationship_kind,
        source_symbol_id=evidence_item.from_symbol_id,
        target_symbol_id=evidence_item.to_symbol_id,
    )


def run_experiment() -> ExperimentResult:
    """Run the full, real, end-to-end experiment and return every
    intermediate + final artifact for inspection/assertion."""
    store, job = run_real_analysis()
    run_id = job.run_id

    # Real symbols, from the real store.
    symbols = store.get_symbols(run_id)
    if not symbols:
        raise AssertionError("real analysis produced no symbols for the fixture")

    # Real relations -- deliberately read back OUT of the store (proving the
    # put_relations/get_relations persistence round-trip is real), not from
    # job.relations directly. Cross-checked against job.relations below for
    # extra rigor, but never used as the primary source.
    relations_from_store = store.get_relations(run_id)
    relations_from_job_attr = job.relations
    if relations_from_store != relations_from_job_attr:
        raise AssertionError(
            "persisted relations (store.get_relations) diverged from the in-process "
            "job.relations attribute -- persistence round-trip is not faithful"
        )
    if not relations_from_store:
        raise AssertionError("real analysis produced no relations for the fixture")

    cases, entity_display_names = build_cases(symbols)
    supplementary_case = build_supplementary_c4_variant(symbols, entity_display_names)

    claims_by_key: dict[str, ArchitecturalClaim] = {}
    for case in cases:
        claims_by_key[case.key] = claim_from_proposition(
            case.proposition,
            relations_from_store,  # the REAL persisted-and-retrieved pool; verify_proposition does the searching
            run_id=run_id,
            epistemic_type=case.epistemic_type,
            producer=PRODUCER,
            entity_display_names=entity_display_names,
        )

    supplementary_claim = claim_from_proposition(
        supplementary_case.proposition,
        relations_from_store,
        run_id=run_id,
        epistemic_type=supplementary_case.epistemic_type,
        producer=PRODUCER,
        entity_display_names=entity_display_names,
    )

    ground_truth = build_ground_truth(cases, relations_from_store)
    candidate_set = build_candidate_set(
        cases, claims_by_key, relations_from_store, supplementary_case, supplementary_claim
    )
    report = evaluate(ground_truth, candidate_set)

    return ExperimentResult(
        run_id=run_id,
        job=job,
        symbols=symbols,
        relations_from_store=relations_from_store,
        relations_from_job_attr=relations_from_job_attr,
        entity_display_names=entity_display_names,
        cases=cases,
        claims_by_key=claims_by_key,
        supplementary_case=supplementary_case,
        supplementary_claim=supplementary_claim,
        ground_truth=ground_truth,
        candidate_set=candidate_set,
        report=report,
    )


def format_summary(result: ExperimentResult) -> str:
    lines: list[str] = []
    lines.append("=" * 88)
    lines.append("End-to-end feasibility experiment: real analysis -> real relations -> real claims")
    lines.append("=" * 88)
    lines.append(f"run_id: {result.run_id}")
    lines.append(f"fixture: {FIXTURE_ROOT}")
    lines.append(f"real symbols produced: {len(result.symbols)}")
    lines.append(
        f"real relations persisted+retrieved via store.get_relations(run_id): {len(result.relations_from_store)} "
        f"(matches job.relations attribute: {result.relations_from_store == result.relations_from_job_attr})"
    )
    lines.append("")
    lines.append("-" * 88)
    lines.append("Principal 6 propositions (real evidence, real verify_proposition/claim_from_proposition):")
    lines.append("-" * 88)
    for case in result.cases:
        claim = result.claims_by_key[case.key]
        match = "MATCH" if claim.support_status == case.expected_support_status_per_scoping else "MISMATCH"
        lines.append(f"[{case.key}] {case.label}")
        lines.append(f"    statement (rendered from proposition): {claim.statement!r}")
        lines.append(f"    epistemic_type: {claim.epistemic_type}")
        lines.append(
            f"    expected (per scoping): {case.expected_support_status_per_scoping:<20} "
            f"actual (real system): {claim.support_status:<20} [{match}]"
        )
        lines.append(f"    evidence_chain.hop_count: {claim.evidence_chain.hop_count}")
        if claim.evidence_chain.reasoning:
            lines.append(f"    reasoning: {claim.evidence_chain.reasoning}")
        lines.append("")

    lines.append("-" * 88)
    lines.append("Supplementary (bonus, NOT scored, modified-from-C4) proposition:")
    lines.append("-" * 88)
    sc, scl = result.supplementary_case, result.supplementary_claim
    lines.append(f"[{sc.key}] {sc.label}")
    lines.append(f"    statement: {scl.statement!r}")
    lines.append(f"    support_status: {scl.support_status} (expected: {sc.expected_support_status_per_scoping})")
    lines.append("")

    lines.append("-" * 88)
    lines.append("Out-of-scope ground-truth claims (no proposition constructed; reason given):")
    lines.append("-" * 88)
    for claim_id, reason in OUT_OF_SCOPE_CLAIMS:
        lines.append(f"[{claim_id}] OUT OF SCOPE: {reason}")
    lines.append("")

    lines.append("-" * 88)
    lines.append("Bridged metrics (research/provenance-evaluation/evaluator/metrics.py), computed")
    lines.append("over the real ArchitecturalClaim results above:")
    lines.append("-" * 88)
    lines.append(result.report.format_report())
    lines.append("=" * 88)
    return "\n".join(lines)


def main() -> None:
    result = run_experiment()
    print(format_summary(result))


if __name__ == "__main__":
    main()
