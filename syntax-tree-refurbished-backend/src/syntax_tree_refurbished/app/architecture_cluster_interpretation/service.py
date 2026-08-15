from __future__ import annotations

import json
from typing import Any

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.architecture_clusters.projection import ArchitectureClusterProjector
from syntax_tree_refurbished.app.architecture_graph.projection import ArchitectureGraphProjector
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel
from syntax_tree_refurbished.app.analysis.static_structure import module_component_id
from syntax_tree_refurbished.core.models.cluster_interpretation import ClusterInterpretation
from syntax_tree_refurbished.core.models.system_overview import SystemOverview

MAX_RELATIONS = 100


def build_cluster_evidence(*, job: AnalysisJob, store: InMemoryRunStore, overview: SystemOverview, cluster) -> dict[str, Any]:
    symbols = store.get_symbols(job.run_id)
    by_id = {symbol.id: symbol for symbol in symbols}
    module_paths = {module_component_id(job.run_id, symbol.path): symbol.path for symbol in symbols if not symbol.parent_symbol_id}
    member_ids = set(cluster.member_module_ids)
    member_paths = {module: module_paths.get(module, module) for module in sorted(member_ids)}
    symbol_to_module = {symbol.id: module_component_id(job.run_id, symbol.path) for symbol in symbols}
    relations = []
    for relation in store.get_relations(job.run_id):
        source = symbol_to_module.get(relation.source_entity_id)
        target = symbol_to_module.get(relation.target_entity_id or "")
        if relation.resolution_status == "resolved" and source in member_ids and target in member_ids:
            relations.append({"source": member_paths[source], "target": member_paths[target], "kind": relation.relation_kind})
    relations = sorted(relations, key=lambda value: (value["source"], value["target"], value["kind"]))[:MAX_RELATIONS]
    graph = ArchitectureGraphProjector(job=job, store=store, overview=overview).project()
    region = next((group.structural_path for group in graph.groups if group.id == cluster.containing_structural_group_id), cluster.containing_structural_group_id)
    return {
        "cluster_id": cluster.id,
        "structural_region": region,
        "member_modules": [member_paths[module] for module in sorted(member_ids)],
        "relation_counts": {kind: count for kind, count in cluster.internal_relation_kind_counts},
        "internal_relation_count": cluster.internal_relation_count,
        "boundary_relation_counts": {kind: count for kind, count in cluster.boundary_relation_kind_counts},
        "boundary_relation_count": cluster.boundary_relation_count,
        "directed_member_relationships": relations,
    }


SYSTEM_PROMPT = """Interpret one architecture cluster. The modules were already grouped mechanically by deterministic source relations; do not regroup them. Use only the supplied evidence. Do not add, remove, move, merge, or split modules, and do not invent missing components. Avoid unsupported certainty and prefer neutral wording such as 'appears centered on' when evidence is limited. Return JSON with exactly: label (a short 2-6 word interpretation) and description (one concise paragraph). Do not expose reasoning or Markdown."""


def interpret_cluster(*, job: AnalysisJob, store: InMemoryRunStore, overview: SystemOverview, cluster, model: InvestigationModel) -> ClusterInterpretation | None:
    if isinstance(model, NoConfiguredModel):
        return None
    evidence = build_cluster_evidence(job=job, store=store, overview=overview, cluster=cluster)
    reply = model.complete_json(system=SYSTEM_PROMPT, messages=[{"role": "user", "content": json.dumps(evidence, sort_keys=True)}], max_tokens=300)
    label = reply.data.get("label")
    description = reply.data.get("description")
    if not isinstance(label, str) or not 2 <= len(label.split()) <= 8 or not isinstance(description, str) or not description.strip() or len(description) > 1200:
        raise ValueError("Malformed cluster interpretation response")
    provider = getattr(model, "_provider", "openai")
    return ClusterInterpretation(cluster.id, label.strip(), description.strip(), str(provider), reply.model or model.model_name)
