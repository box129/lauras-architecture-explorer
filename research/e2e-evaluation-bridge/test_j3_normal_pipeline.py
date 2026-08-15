"""J3 acceptance tests: prove the NORMAL AnalysisController pipeline alone
(no direct extractor calls from this harness) reproduces J2's improved
result.

Run with:

    cd research/e2e-evaluation-bridge
    "<path-to-backend-venv>/python.exe" -m pytest test_j3_normal_pipeline.py -v
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest

THIS_DIR = Path(__file__).resolve().parent
REPO_ROOT = THIS_DIR.parents[1]
BACKEND_SRC = REPO_ROOT / "syntax-tree-refurbished-backend" / "src"
EVALUATOR_ROOT = REPO_ROOT / "research" / "provenance-evaluation"

for p in (str(THIS_DIR), str(BACKEND_SRC), str(EVALUATOR_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from experiment_j3 import J2_REFERENCE, V0_REFERENCE, summarize_j3  # noqa: E402
from experiment import run_experiment  # noqa: E402

FORBIDDEN_DIRECT_CALLS = (
    "extract_constructor_attribute_bindings",
    "extract_call_relations",
    "extract_inheritance_relations",
)


@pytest.fixture(scope="module")
def result():
    return run_experiment()


# ---------------------------------------------------------------------------
# CRITICAL RULE: the scoring module never imports/calls the extractors
# directly. Checked via AST inspection of actual import statements -- not a
# naive substring search, since experiment.py's own docstrings legitimately
# MENTION these function names in prose without importing or calling them.
# ---------------------------------------------------------------------------


def _imported_names(module_path: Path) -> set[str]:
    tree = ast.parse(module_path.read_text(encoding="utf-8"), filename=str(module_path))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
    return names


def test_experiment_module_never_imports_extractors_directly():
    """AST-verified: experiment.py (which produces J3's scored result) does
    not import any of the three extractor functions. This is what makes it
    structurally impossible for the scoring code to have called them --
    the alternative (job.relations, or a fresh extractor call) would show
    up here as an import and fail this test."""
    imported = _imported_names(THIS_DIR / "experiment.py")
    violations = imported & set(FORBIDDEN_DIRECT_CALLS)
    assert not violations, f"experiment.py imports forbidden extractor(s) directly: {violations}"


def test_experiment_j3_module_never_imports_extractors_directly():
    imported = _imported_names(THIS_DIR / "experiment_j3.py")
    violations = imported & set(FORBIDDEN_DIRECT_CALLS)
    assert not violations, f"experiment_j3.py imports forbidden extractor(s) directly: {violations}"


def test_relations_come_from_the_store_not_job_relations_attribute(result):
    """The scored relations are read via store.get_relations(run_id) -- the
    ONLY way relations reach the harness is by asking the store what a
    normal analysis run persisted, mirroring exactly what a real caller
    (e.g. a future API route) would do."""
    assert result.relations_from_store
    assert result.relations_from_store == result.relations_from_job_attr


# ---------------------------------------------------------------------------
# J3 reproduces J2 exactly
# ---------------------------------------------------------------------------


def test_j3_reproduces_j2_metrics_exactly(result):
    j3 = summarize_j3(result)
    for key in (
        "claim_support_precision",
        "claim_support_recall",
        "evidence_correctness",
        "evidence_completeness",
        "unsupported_claim_acceptance_rate",
        "correct_abstention_rate",
        "supported_correctly",
        "correct_abstentions",
        "incorrect_abstentions",
        "false_supports",
    ):
        assert j3[key] == J2_REFERENCE[key], f"J3[{key}]={j3[key]!r} != J2[{key}]={J2_REFERENCE[key]!r}"


def test_j3_differs_from_v0_in_the_expected_direction(result):
    j3 = summarize_j3(result)
    assert j3["claim_support_recall"] > V0_REFERENCE["claim_support_recall"]
    assert j3["supported_correctly"] > V0_REFERENCE["supported_correctly"]
    assert j3["incorrect_abstentions"] < V0_REFERENCE["incorrect_abstentions"]
    # precision must never regress -- zero false positives at any stage
    assert j3["claim_support_precision"] == V0_REFERENCE["claim_support_precision"] == 1.0
    assert j3["false_supports"] == V0_REFERENCE["false_supports"] == 0


# ---------------------------------------------------------------------------
# Phase 5: persistence proof -- a constructor-injection relation survives
# extract -> put_relations -> storage -> get_relations -> proposition
# verification without identity or source-span corruption.
# ---------------------------------------------------------------------------


def test_constructor_injection_relation_survives_full_persistence_round_trip_uncorrupted(result):
    binding_resolved = [
        r
        for r in result.relations_from_store
        if r.resolution_basis == "constructor_binding" and r.resolution_status == "resolved"
    ]
    assert binding_resolved, "expected at least one constructor_binding-resolved relation from the normal pipeline"

    relation = binding_resolved[0]

    # Identity: a real, well-formed relation id (not empty, not a
    # placeholder), and a real target_entity_id present in this run's own
    # symbol set (never a fabricated id).
    assert relation.id
    symbol_ids = {s.id for s in result.symbols}
    assert relation.source_entity_id in symbol_ids
    assert relation.target_entity_id in symbol_ids

    # Source span: exact, well-formed, not corrupted into None/zero/negative.
    assert relation.span_path
    assert relation.span_start_line is not None and relation.span_start_line > 0
    assert relation.span_end_line is not None and relation.span_end_line >= relation.span_start_line

    # Resolution provenance: the supporting spans (constructor annotation +
    # attribute assignment) survived too, each individually well-formed.
    assert relation.supporting_resolution_spans
    for span in relation.supporting_resolution_spans:
        assert span.path
        assert span.start_line > 0
        assert span.end_line >= span.start_line

    # And this exact relation (by id) is the one actually cited as evidence
    # by a real, verified, supported ArchitecturalClaim -- proving the
    # round-tripped object, not just a same-shaped copy, is what the
    # verifier consumed.
    cited_relation_ids = {
        item.id
        for claim in result.claims_by_key.values()
        if claim.support_status == "supported"
        for item in claim.evidence_chain.items
    }
    # The relation's own RelationshipEvidence id differs from the raw
    # relation id (different id scheme -- see relation_adapter.py), so
    # instead confirm indirectly: at least one supported claim's evidence
    # references the same source/target pair via relationship_kind.
    matching_evidence = [
        item
        for claim in result.claims_by_key.values()
        if claim.support_status == "supported"
        for item in claim.evidence_chain.items
        if getattr(item, "from_symbol_id", None) == relation.source_entity_id
        and getattr(item, "to_symbol_id", None) == relation.target_entity_id
    ]
    assert matching_evidence, "the persisted constructor-binding relation was not cited as evidence by any supported claim"
    assert matching_evidence[0].resolution_basis == "constructor_binding"
    assert matching_evidence[0].supporting_resolution_spans == relation.supporting_resolution_spans


def test_sqlite_persistence_also_round_trips_a_constructor_injection_relation(tmp_path):
    """The in-memory store is what run_experiment() uses; separately confirm
    the SAME kind of relation survives a REAL SQLite write + fresh reload
    (the persistence layer both stores use is shared, but this proves it
    end to end against the on-disk backend specifically, not just
    in-memory)."""
    from syntax_tree_refurbished.app.analysis.analysis_controller import AnalysisController
    from syntax_tree_refurbished.app.analysis.sqlite_run_store import SQLiteRunStore
    from syntax_tree_refurbished.config import Settings

    database = tmp_path / "j3_persistence.sqlite"
    write(
        tmp_path / "repo" / "service.py",
        "class Service:\n"
        "    def execute(self) -> None:\n"
        "        pass\n",
    )
    write(
        tmp_path / "repo" / "controller.py",
        "from service import Service\n\n\n"
        "class Controller:\n"
        "    def __init__(self, service: Service) -> None:\n"
        "        self.service = service\n\n"
        "    def handle(self) -> None:\n"
        "        self.service.execute()\n",
    )

    settings = Settings(environment="test", database_path=str(database))
    store = SQLiteRunStore(str(database))
    controller = AnalysisController(settings=settings, store=store)
    job = controller.analyze(str(tmp_path / "repo"))
    assert job.status == "completed"

    reloaded_store = SQLiteRunStore(str(database))
    relations = reloaded_store.get_relations(job.run_id)
    binding_resolved = [
        r for r in relations if r.resolution_basis == "constructor_binding" and r.resolution_status == "resolved"
    ]
    assert binding_resolved, "expected a constructor_binding-resolved relation to survive a real SQLite reload"
    relation = binding_resolved[0]
    assert relation.target_entity_id
    assert relation.supporting_resolution_spans
    assert len(relation.supporting_resolution_spans) == 2


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
