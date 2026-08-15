"""Analysis orchestration for early refurbished backend PRs."""

from __future__ import annotations

import uuid

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import (
    InMemoryRunStore,
    normalize_repository_path,
)
from syntax_tree_refurbished.app.architecture_map.projection import ArchitectureMapProjector
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.app.indexing.build_orientation_inventory import build_orientation_inventory
from syntax_tree_refurbished.app.indexing.discover_semantic_anchors import discover_semantic_anchors
from syntax_tree_refurbished.app.analysis.constructor_binding_extractor import (
    extract_constructor_attribute_bindings,
)
from syntax_tree_refurbished.app.analysis.python_call_extractor import extract_call_relations
from syntax_tree_refurbished.app.analysis.python_inheritance_extractor import (
    extract_inheritance_relations,
)
from syntax_tree_refurbished.app.investigation.llm_model import NoConfiguredModel
from syntax_tree_refurbished.app.overview.system_overview_generator import SystemOverviewGenerator
from syntax_tree_refurbished.app.parsing.parse_supported_files import parse_supported_files
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.analysis_stage import AnalysisStage
from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader


class AnalysisController:
    def __init__(self, *, settings: Settings, store: InMemoryRunStore):
        self._settings = settings
        self._store = store

    def analyze(self, repository_path: str) -> AnalysisJob:
        job, created = self.start_or_reuse(repository_path)
        if created:
            self.run(job)
        return job

    def start(self, repository_path: str) -> AnalysisJob:
        job, _ = self.start_or_reuse(repository_path)
        return job

    def start_or_reuse(self, repository_path: str) -> tuple[AnalysisJob, bool]:
        repository_path = normalize_repository_path(repository_path)
        run_id = f"run:{uuid.uuid4().hex}"
        job_id = f"job:{uuid.uuid4().hex}"
        job = AnalysisJob(job_id=job_id, run_id=run_id, repository_path=repository_path)
        job.start()
        return self._store.claim_job(job)

    def run(self, job: AnalysisJob) -> None:
        run_id = job.run_id
        stages = [
            ("snapshot", "Repository Snapshot", 1),
            ("parsing", "File Parsing", 2),
            ("relations", "Relationship Extraction", 3),
            ("orientation", "Orientation Inventory", 4),
            ("anchors", "Semantic Anchors", 5),
            ("structure", "Static Architecture Structure", 6),
        ]

        try:
            self._start_stage(run_id, "snapshot", "Repository Snapshot", 1)
            snapshot = LocalRepoReader(self._settings).build_snapshot(
                run_id=run_id,
                repo_path=job.repository_path,
            )
            self._store.set_snapshot(job, snapshot)
            self._complete_stage(run_id, "snapshot", can_render=True)

            self._start_stage(run_id, "parsing", "File Parsing", 2)
            symbols = parse_supported_files(job)
            self._store.put_symbols(run_id, symbols)
            source_reader = SourceReader(job)
            symbol_regions = []
            for symbol in symbols:
                try:
                    symbol_regions.append(
                        source_reader.read_range(symbol.path, symbol.start_line, symbol.end_line)
                    )
                except SourceReadError:
                    continue
            self._store.put_regions(tuple(symbol_regions))
            self._complete_stage(run_id, "parsing")

            # Positioned right after "parsing" (needs the same `symbols` tuple
            # the parsing stage just produced) and before "orientation"/
            # "anchors"/"structure": those later stages don't depend on
            # relations, so running relation extraction as early as its one
            # real dependency (symbols) allows a relations failure to surface
            # before the rest of the pipeline does more work. Python-only
            # for now, matching both extractors' current scope -- no JS/TS
            # relation extraction is attempted here.
            #
            # Pipeline within this stage: the SAME authoritative `symbols`
            # tuple (from "parsing", no re-parse) feeds THREE steps in order:
            #   1. extract_constructor_attribute_bindings(job, symbols) --
            #      real ConstructorAttributeBinding facts (constructor-
            #      parameter-injection pattern), from the same real symbols.
            #   2. extract_inheritance_relations(job, symbols) -- moved ahead
            #      of call extraction (D4) so its already-resolved `inherits`
            #      relations can be handed to the call extractor as a third,
            #      strictly additive fallback input (self.method() resolved
            #      through a base class -- see
            #      python_call_extractor.py's "Inheritance-aware
            #      self.method() fallback resolution"). Does not depend on
            #      call relations, so this reordering changes nothing about
            #      its own output.
            #   3. extract_call_relations(job, symbols, bindings=bindings,
            #      inherits=inheritance_relations) -- the call extractor
            #      consumes the real constructor bindings to resolve
            #      self.<attr>.<method>() call sites it couldn't resolve from
            #      syntax alone (Case A), on top of its own already-built-in
            #      direct-construction resolution (Case B), the new
            #      inheritance-aware self.method() fallback (D4), and
            #      ordinary direct-syntax resolution (Case C stays
            #      unresolved, never guessed) -- this is the SAME
            #      function/logic already unit-tested end-to-end by the
            #      L/M/D3/D4 workstreams, called here from the normal
            #      production path instead of only from an experiment
            #      harness. No second resolver is implemented.
            self._start_stage(run_id, "relations", "Relationship Extraction", 3)
            # Per-extractor tolerance (narrow, deliberate exception to "let
            # it propagate"): parse_supported_files already tolerates a
            # syntactically-broken Python file in the repo (its own per-file
            # `except Exception: continue`), so the rest of this pipeline
            # completes normally around it. python_call_extractor's own
            # module-index build re-parses file content with `ast.parse` and
            # does NOT catch SyntaxError per file the way parse_supported_files
            # and python_inheritance_extractor's own AST pass do -- so, without
            # a guard here, one broken file would abort relation extraction
            # for the *entire* run, a strictly worse degradation than every
            # other stage exhibits for the same input. Each extractor call is
            # therefore individually guarded and degrades to "no relations/
            # bindings from this step" (recorded as a stage warning) rather
            # than failing the whole analysis run. Conservative by
            # construction either way: a failed or skipped binding-extraction
            # step means `bindings=()` is passed to the call extractor, which
            # is EXACTLY its own documented backward-compatible default --
            # the call extractor never fabricates a resolved relationship
            # for a binding it didn't actually receive; it simply leaves the
            # affected call sites unresolved/partial, same as always. This is
            # the one exception noted in the task: the two stage-setup lines
            # themselves (_start_stage/_complete_stage) are deliberately left
            # unguarded, matching every other stage's convention -- only the
            # extractor calls get this tolerance.
            relation_warnings: list[str] = []
            try:
                constructor_bindings = extract_constructor_attribute_bindings(job, symbols)
            except Exception as exc:  # noqa: BLE001 - intentional, see comment above
                constructor_bindings = ()
                relation_warnings.append(f"constructor attribute binding extraction failed: {exc}")
            try:
                inheritance_relations = extract_inheritance_relations(job, symbols)
            except Exception as exc:  # noqa: BLE001 - intentional, see comment above
                inheritance_relations = ()
                relation_warnings.append(f"inheritance relation extraction failed: {exc}")
            try:
                call_relations = extract_call_relations(
                    job, symbols, bindings=constructor_bindings, inherits=inheritance_relations
                )
            except Exception as exc:  # noqa: BLE001 - intentional, see comment above
                call_relations = ()
                relation_warnings.append(f"call relation extraction failed: {exc}")
            relations = tuple(call_relations) + tuple(inheritance_relations)
            # Attach directly to the job (as before) AND persist via the run
            # store's `put_relations`, now that it exists (see
            # app/analysis/run_store.py / sqlite_run_store.py) -- this is the
            # integration step the relations-stage docstring previously
            # deferred, completed now that both land together.
            job.relations = relations
            self._store.put_relations(run_id, relations)
            self._complete_stage(
                run_id,
                "relations",
                can_render=False,
                warnings=relation_warnings or None,
            )

            self._start_stage(run_id, "orientation", "Orientation Inventory", 4)
            self._store.put_orientation_items(run_id, build_orientation_inventory(job))
            self._complete_stage(run_id, "orientation")

            self._start_stage(run_id, "anchors", "Semantic Anchors", 5)
            anchor_result = discover_semantic_anchors(job, symbols)
            self._store.put_anchors(run_id, anchor_result.anchors)
            self._store.put_regions(anchor_result.source_regions)
            self._complete_stage(run_id, "anchors")

            self._start_stage(run_id, "structure", "Static Architecture Structure", 6)
            model = NoConfiguredModel()
            overview = SystemOverviewGenerator(
                job=job,
                store=self._store,
                model=model,
            ).get_or_generate()
            ArchitectureMapProjector(
                job=job,
                store=self._store,
                overview=overview,
                model=model,
            ).project()
            self._complete_stage(run_id, "structure", can_render=True)
            self._store.set_completed(job, snapshot)
        except Exception as exc:
            job.fail(str(exc))
            self._store.put_job(job)
            for name, _, _ in stages:
                stage = self._store.get_or_create_stage(run_id, name, name, 0)
                if stage.status == "running":
                    stage.fail(str(exc))
                    self._store.record_stage(run_id, stage)

    def _start_stage(self, run_id: str, name: str, display: str, order: int) -> AnalysisStage:
        job = self._store.get_run(run_id)
        if job is not None:
            self._store.set_job_stage(job, name)
        stage = self._store.get_or_create_stage(run_id, name, display, order)
        stage.start()
        self._store.record_stage(run_id, stage)
        return stage

    def _complete_stage(
        self,
        run_id: str,
        name: str,
        *,
        can_render: bool = False,
        warnings: list[str] | None = None,
    ) -> None:
        stage = self._store.get_or_create_stage(run_id, name, name, 0)
        stage.complete(can_render_frontend=can_render, warnings=warnings)
        self._store.record_stage(run_id, stage)
