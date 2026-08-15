"""Public DTOs for the versioned deterministic architecture graph."""
from __future__ import annotations
from pydantic import BaseModel
from syntax_tree_refurbished.core.models.architecture_graph import ArchitectureGraphProjection

class ArchitectureGraphGroupDTO(BaseModel):
    id: str; analysis_run_id: str; label: str; structural_path: str; parent_group_id: str | None
    kind: str; direct_member_module_ids: list[str]; direct_child_group_ids: list[str]; recursive_module_count: int; can_drilldown: bool
    cluster_id: str | None = None; residual: bool = False; internal_relation_count: int = 0
    internal_relation_kind_counts: list[tuple[str, int]] = []; boundary_relation_count: int = 0
    boundary_relation_kind_counts: list[tuple[str, int]] = []; algorithm: str | None = None
class ArchitectureGraphAggregateEdgeDTO(BaseModel):
    id: str; analysis_run_id: str; source_group_id: str; target_group_id: str; relation_kind: str
    member_relation_count: int; distinct_member_pair_count: int; distinct_source_member_count: int; distinct_target_member_count: int; relation_ids_preview: list[str]; contributing_relation_count: int
class ArchitectureGraphInternalRelationCountDTO(BaseModel):
    group_id: str; relation_kind: str; member_relation_count: int
class ArchitectureGraphResponse(BaseModel):
    schema_version: str; analysis_run_id: str; groups: list[ArchitectureGraphGroupDTO]; aggregate_edges: list[ArchitectureGraphAggregateEdgeDTO]; internal_relation_counts: list[ArchitectureGraphInternalRelationCountDTO]
    @classmethod
    def from_domain(cls, value: ArchitectureGraphProjection) -> "ArchitectureGraphResponse":
        return cls(schema_version=value.schema_version, analysis_run_id=value.analysis_run_id,
            groups=[ArchitectureGraphGroupDTO(**{**x.__dict__, "direct_member_module_ids": list(x.direct_member_module_ids), "direct_child_group_ids": list(x.direct_child_group_ids), "internal_relation_kind_counts": list(x.internal_relation_kind_counts), "boundary_relation_kind_counts": list(x.boundary_relation_kind_counts)}) for x in value.groups],
            aggregate_edges=[ArchitectureGraphAggregateEdgeDTO(**{**x.__dict__, "relation_ids_preview": list(x.relation_ids_preview)}) for x in value.aggregate_edges],
            internal_relation_counts=[ArchitectureGraphInternalRelationCountDTO(**x.__dict__) for x in value.internal_relation_counts])
