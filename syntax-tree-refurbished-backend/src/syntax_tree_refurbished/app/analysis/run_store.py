"""Simple in-memory run store for early PRs."""

from __future__ import annotations

import os
from threading import RLock

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.core.models.orientation import OrientationItem
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol
from syntax_tree_refurbished.core.models.program_relation import ObservedProgramRelation
from syntax_tree_refurbished.core.models.repo_snapshot import RepoSnapshot
from syntax_tree_refurbished.core.models.semantic_anchor import SemanticAnchor
from syntax_tree_refurbished.core.models.source_region import SourceRegion
from syntax_tree_refurbished.core.models.system_overview import SystemOverview
from syntax_tree_refurbished.core.models.architecture_map import ArchitectureMapProjection
from syntax_tree_refurbished.core.models.analysis_stage import AnalysisStage
from syntax_tree_refurbished.core.models.lens import Lens


class InMemoryRunStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._jobs: dict[str, AnalysisJob] = {}
        self._runs: dict[str, AnalysisJob] = {}
        self._regions: dict[str, SourceRegion] = {}
        self._symbols_by_run: dict[str, list[ParsedSymbol]] = {}
        self._relations_by_run: dict[str, list[ObservedProgramRelation]] = {}
        self._orientation_by_run: dict[str, list[OrientationItem]] = {}
        self._anchors_by_run: dict[str, list[SemanticAnchor]] = {}
        self._system_overviews_by_run: dict[str, SystemOverview] = {}
        self._architecture_maps_by_run: dict[str, ArchitectureMapProjection] = {}
        self._lenses_by_parent: dict[tuple[str, str], Lens] = {}
        self._stages_by_run: dict[str, list[AnalysisStage]] = {}
        self._active_run_id: str | None = None

    def put_job(self, job: AnalysisJob) -> None:
        with self._lock:
            self._jobs[job.job_id] = job
            self._runs[job.run_id] = job
            if job.status == "completed":
                self._active_run_id = job.run_id

    def claim_job(self, job: AnalysisJob) -> tuple[AnalysisJob, bool]:
        """Atomically add a job unless the same repository is already running."""
        normalized_path = normalize_repository_path(job.repository_path)
        with self._lock:
            for existing in self._jobs.values():
                if (
                    existing.status == "running"
                    and normalize_repository_path(existing.repository_path) == normalized_path
                ):
                    return existing, False
            self._jobs[job.job_id] = job
            self._runs[job.run_id] = job
            return job, True

    def get_job(self, job_id: str) -> AnalysisJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def get_run(self, run_id: str) -> AnalysisJob | None:
        with self._lock:
            return self._runs.get(run_id)

    def set_completed(self, job: AnalysisJob, snapshot: RepoSnapshot) -> None:
        with self._lock:
            job.complete(snapshot)
            self._active_run_id = job.run_id

    def set_snapshot(self, job: AnalysisJob, snapshot: RepoSnapshot) -> None:
        with self._lock:
            job.snapshot = snapshot

    def set_job_stage(self, job: AnalysisJob, stage: str) -> None:
        with self._lock:
            job.stage = stage

    def put_region(self, region: SourceRegion) -> None:
        with self._lock:
            self._regions[region.id] = region

    def put_regions(self, regions: tuple[SourceRegion, ...]) -> None:
        with self._lock:
            for region in regions:
                self._regions[region.id] = region

    def get_region(self, region_id: str) -> SourceRegion | None:
        with self._lock:
            return self._regions.get(region_id)

    def put_symbols(self, run_id: str, symbols: tuple[ParsedSymbol, ...]) -> None:
        with self._lock:
            self._symbols_by_run[run_id] = list(symbols)

    def get_symbols(self, run_id: str) -> tuple[ParsedSymbol, ...]:
        with self._lock:
            return tuple(self._symbols_by_run.get(run_id, ()))

    def get_symbols_for_file(self, run_id: str, path: str) -> tuple[ParsedSymbol, ...]:
        return tuple(symbol for symbol in self.get_symbols(run_id) if symbol.path == path)

    def get_symbol(self, symbol_id: str) -> ParsedSymbol | None:
        with self._lock:
            for symbols in self._symbols_by_run.values():
                for symbol in symbols:
                    if symbol.id == symbol_id:
                        return symbol
        return None

    def put_relations(self, run_id: str, relations: tuple[ObservedProgramRelation, ...]) -> None:
        with self._lock:
            self._relations_by_run[run_id] = list(relations)

    def get_relations(self, run_id: str) -> tuple[ObservedProgramRelation, ...]:
        with self._lock:
            return tuple(self._relations_by_run.get(run_id, ()))

    def put_orientation_items(self, run_id: str, items: tuple[OrientationItem, ...]) -> None:
        with self._lock:
            self._orientation_by_run[run_id] = list(items)

    def get_orientation_items(self, run_id: str) -> tuple[OrientationItem, ...]:
        with self._lock:
            return tuple(self._orientation_by_run.get(run_id, ()))

    def put_anchors(self, run_id: str, anchors: tuple[SemanticAnchor, ...]) -> None:
        with self._lock:
            self._anchors_by_run[run_id] = list(anchors)

    def get_anchors(self, run_id: str) -> tuple[SemanticAnchor, ...]:
        with self._lock:
            return tuple(self._anchors_by_run.get(run_id, ()))

    def put_system_overview(self, overview: SystemOverview) -> None:
        with self._lock:
            self._system_overviews_by_run[overview.analysis_run_id] = overview

    def get_system_overview(self, run_id: str) -> SystemOverview | None:
        with self._lock:
            return self._system_overviews_by_run.get(run_id)

    def put_architecture_map(self, projection: ArchitectureMapProjection) -> None:
        with self._lock:
            self._architecture_maps_by_run[projection.analysis_run_id] = projection

    def get_architecture_map(self, run_id: str) -> ArchitectureMapProjection | None:
        with self._lock:
            return self._architecture_maps_by_run.get(run_id)

    def put_lens(self, lens: Lens) -> None:
        with self._lock:
            self._lenses_by_parent[(lens.analysis_run_id, lens.parent_component_id)] = lens

    def get_lens(self, run_id: str, parent_component_id: str) -> Lens | None:
        with self._lock:
            return self._lenses_by_parent.get((run_id, parent_component_id))

    def record_stage(self, run_id: str, stage: AnalysisStage) -> None:
        with self._lock:
            stages = self._stages_by_run.setdefault(run_id, [])
            for index, existing in enumerate(stages):
                if existing.stage_name == stage.stage_name:
                    stages[index] = stage
                    break
            else:
                stages.append(stage)

    def get_stages(self, run_id: str) -> list[AnalysisStage]:
        with self._lock:
            return list(self._stages_by_run.get(run_id, []))

    def get_or_create_stage(self, run_id: str, stage_name: str, display_name: str, sort_order: int = 0) -> AnalysisStage:
        with self._lock:
            stages = self._stages_by_run.setdefault(run_id, [])
            for stage in stages:
                if stage.stage_name == stage_name:
                    return stage
            stage = AnalysisStage(
                stage_name=stage_name,
                display_name=display_name,
                sort_order=sort_order,
            )
            stages.append(stage)
            return stage

    @property
    def active_run_id(self) -> str | None:
        with self._lock:
            return self._active_run_id


def normalize_repository_path(repository_path: str) -> str:
    """Return a stable local path used for duplicate-run comparisons."""
    cleaned = repository_path.strip().strip('"').strip("'")
    expanded = os.path.expandvars(os.path.expanduser(cleaned))
    return os.path.normcase(os.path.realpath(os.path.abspath(expanded)))
