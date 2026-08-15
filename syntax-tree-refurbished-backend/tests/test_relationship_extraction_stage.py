"""Integration tests for the "relations" stage added to
``AnalysisController.run()``.

These exercise the real pipeline end-to-end (no ad hoc re-parsing): a
temp-directory Python fixture is analyzed via the same
``AnalysisController.analyze(...)`` entry point a real caller would use, and
the relations produced by the new stage are asserted to be built from the
same ``ParsedSymbol`` set the "parsing" stage already persisted via
``store.put_symbols``/``store.get_symbols``.
"""

from __future__ import annotations

from pathlib import Path

from syntax_tree_refurbished.app.analysis.analysis_controller import AnalysisController
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.config import Settings


def test_relationship_extraction_stage_produces_calls_and_inherits_relations(
    tmp_path: Path,
) -> None:
    # A Controller class that calls a Service class (constructor-then-
    # immediate-call chain, resolvable inline -> "calls"/"resolved"), and a
    # subclass with an explicit, same-file base (-> "inherits"/"resolved").
    write(
        tmp_path / "service.py",
        "class Service:\n"
        "    def run(self) -> str:\n"
        "        return 'ok'\n",
    )
    write(
        tmp_path / "controller.py",
        "from service import Service\n\n\n"
        "class Controller:\n"
        "    def handle(self) -> str:\n"
        "        return Service().run()\n",
    )
    write(
        tmp_path / "models.py",
        "class BaseModel:\n"
        "    def save(self) -> None:\n"
        "        pass\n\n\n"
        "class UserModel(BaseModel):\n"
        "    pass\n",
    )

    settings = Settings(environment="test", database_path=":memory:")
    store = InMemoryRunStore()
    controller = AnalysisController(settings=settings, store=store)

    job = controller.analyze(str(tmp_path))

    # Full pipeline still completes end-to-end with the new stage present.
    assert job.status == "completed"
    assert job.error == ""

    # The "relations" stage is registered and completes like every other
    # stage.
    stages = store.get_stages(job.run_id)
    stage_by_name = {stage.stage_name: stage for stage in stages}
    assert "relations" in stage_by_name
    assert stage_by_name["relations"].status == "completed"
    assert stage_by_name["relations"].display_name == "Relationship Extraction"

    # Every other pre-existing stage still ran and completed too (adding the
    # new stage did not disturb the rest of the pipeline).
    assert {"snapshot", "parsing", "relations", "orientation", "anchors", "structure"} == set(
        stage_by_name
    )
    assert all(stage.status == "completed" for stage in stages)

    # The stage fed the real pipeline's real symbols into the extractors,
    # not some ad hoc re-parse: every relation endpoint that is populated
    # must resolve to a real, run-scoped ParsedSymbol.id already persisted
    # via the parsing stage.
    symbols = store.get_symbols(job.run_id)
    assert symbols
    symbol_ids = {symbol.id for symbol in symbols}

    relations = job.relations
    assert relations

    call_relations = [r for r in relations if r.relation_kind == "calls"]
    inherits_relations = [r for r in relations if r.relation_kind == "inherits"]
    assert call_relations
    assert inherits_relations

    resolved_call = next((r for r in call_relations if r.resolution_status == "resolved"), None)
    assert resolved_call is not None
    assert resolved_call.source_entity_id in symbol_ids
    assert resolved_call.target_entity_id in symbol_ids

    resolved_inherit = next(
        (r for r in inherits_relations if r.resolution_status == "resolved"), None
    )
    assert resolved_inherit is not None
    assert resolved_inherit.source_entity_id in symbol_ids
    assert resolved_inherit.target_entity_id in symbol_ids

    # All relations, regardless of kind/resolution, must always carry a real
    # source_entity_id drawn from this run's own symbol set.
    assert all(r.source_entity_id in symbol_ids for r in relations)


def test_relationship_extraction_stage_resolves_constructor_injected_and_direct_construction_calls_via_normal_pipeline(
    tmp_path: Path,
) -> None:
    """The J3 acceptance requirement: an ORDINARY AnalysisController.analyze()
    run (no direct extractor calls from a test/experiment harness) must
    resolve both:
    - Case A: constructor-parameter-injected dependency access
      (`def __init__(self, x: X): self.x = x` then `self.x.method()`
      elsewhere), via automatic extract_constructor_attribute_bindings ->
      extract_call_relations(..., bindings=...) wiring in the "relations"
      stage; and
    - Case B: direct-construction dependency access
      (`def __init__(self): self.x = X()` then `self.x.method()`
      elsewhere), via python_call_extractor's own built-in Case B logic
      (needs no bindings at all).

    Both relations must be retrievable via `store.get_relations(run_id)`
    after the run completes -- not merely present on `job.relations` --
    proving the full extract -> put_relations -> get_relations path.
    """
    write(
        tmp_path / "notifier.py",
        "class Notifier:\n"
        "    def send(self, message: str) -> None:\n"
        "        pass\n",
    )
    write(
        tmp_path / "logger.py",
        "class Logger:\n"
        "    def record(self, message: str) -> None:\n"
        "        pass\n",
    )
    write(
        tmp_path / "pipeline.py",
        "from notifier import Notifier\n"
        "from logger import Logger\n\n\n"
        "class Pipeline:\n"
        "    # Case A: constructor-parameter injection.\n"
        "    def __init__(self, notifier: Notifier) -> None:\n"
        "        self.notifier = notifier\n"
        "        # Case B: direct construction, no parameter involved.\n"
        "        self.logger = Logger()\n\n"
        "    def run(self, message: str) -> None:\n"
        "        self.notifier.send(message)\n"
        "        self.logger.record(message)\n",
    )

    settings = Settings(environment="test", database_path=":memory:")
    store = InMemoryRunStore()
    controller = AnalysisController(settings=settings, store=store)

    job = controller.analyze(str(tmp_path))
    assert job.status == "completed"

    # Only through the store -- proving persistence, not just job.relations.
    persisted = store.get_relations(job.run_id)
    assert persisted
    assert persisted == job.relations  # sanity: same content, retrieved via the store path

    symbols = store.get_symbols(job.run_id)
    notifier_send = next(s for s in symbols if s.name == "send" and s.kind == "method")
    logger_record = next(s for s in symbols if s.name == "record" and s.kind == "method")

    constructor_binding_resolved = next(
        (
            r
            for r in persisted
            if r.relation_kind == "calls"
            and r.resolution_status == "resolved"
            and r.resolution_basis == "constructor_binding"
            and r.target_entity_id == notifier_send.id
        ),
        None,
    )
    assert constructor_binding_resolved is not None, (
        f"expected a resolved, constructor_binding-based call to Notifier.send; got: "
        f"{[(r.relation_kind, r.resolution_status, r.resolution_basis, r.target_reference) for r in persisted]}"
    )
    assert constructor_binding_resolved.supporting_resolution_spans  # annotation + assignment spans

    direct_construction_resolved = next(
        (
            r
            for r in persisted
            if r.relation_kind == "calls"
            and r.resolution_status == "resolved"
            and r.resolution_basis == "direct_construction"
            and r.target_entity_id == logger_record.id
        ),
        None,
    )
    assert direct_construction_resolved is not None, (
        f"expected a resolved, direct_construction-based call to Logger.record; got: "
        f"{[(r.relation_kind, r.resolution_status, r.resolution_basis, r.target_reference) for r in persisted]}"
    )
    assert direct_construction_resolved.supporting_resolution_spans  # assignment span


def test_relationship_extraction_stage_is_empty_but_non_fatal_with_no_python_files(
    tmp_path: Path,
) -> None:
    write(tmp_path / "app.ts", "export const ready = true;\n")

    settings = Settings(environment="test", database_path=":memory:")
    store = InMemoryRunStore()
    controller = AnalysisController(settings=settings, store=store)

    job = controller.analyze(str(tmp_path))

    assert job.status == "completed"
    stage_by_name = {stage.stage_name: stage for stage in store.get_stages(job.run_id)}
    assert stage_by_name["relations"].status == "completed"
    assert job.relations == ()


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
