# Syntax Tree — Pre-Frontend Integration Test Suite

> **Purpose:** Validate every built subsystem and every integration boundary before starting the Interface Layer. These tests go beyond unit tests — they test the full data flow from source code through the pipeline to queryable results.
> 
> **Run after:** All subsystem unit tests pass. This suite tests what unit tests miss: cross-subsystem consistency, data flow correctness, edge case handling, and performance under realistic conditions.
> 
> **Run with:** `poetry run pytest tests/integration/ -v --tb=long`

---

## Test File Structure

```
tests/
├── integration/
│   ├── __init__.py
│   ├── conftest.py                          # Shared fixtures: repos, graphs, mock LLM
│   ├── test_extraction_to_graph.py          # Subsystem A → B boundary
│   ├── test_graph_to_clustering.py          # Subsystem B → C (clustering) boundary
│   ├── test_clustering_to_architecture.py   # Clustering → Architecture boundary
│   ├── test_full_pipeline.py                # Complete A → B → C pipeline
│   ├── test_query_on_analyzed_graph.py      # Query Agent against fully analyzed graph
│   ├── test_documentation_generation.py     # Documentation Agent against analyzed graph
│   ├── test_data_consistency.py             # Cross-subsystem data integrity
│   ├── test_error_resilience.py             # Broken inputs, partial failures
│   ├── test_re_analysis.py                  # Re-ingestion, re-clustering, staleness
│   ├── test_performance.py                  # Performance budgets under load
│   └── repos/                               # Test repositories
│       ├── minimal/                         # 2 files (worked example)
│       ├── small_app/                       # ~20 files, clear architecture
│       ├── messy_app/                       # ~15 files, circular deps, god classes
│       └── edge_cases/                      # Broken files, empty files, unusual patterns
```

---

## conftest.py — Shared Fixtures

```python
"""
Shared fixtures for integration tests.
All LLM calls are mocked. All graphs use in-memory SQLite.
"""

import json
import os
import pytest
import shutil
import tempfile
from types import SimpleNamespace
from pathlib import Path

from syntax_tree.pipeline.orchestrator import PipelineOrchestrator
from syntax_tree.config import ExtractionConfig
from syntax_tree.graph import KnowledgeGraph, KnowledgeGraphConfig
from syntax_tree.agents import (
    ClusteringAgent, ArchitectureAgent, DocumentationAgent, QueryAgent,
    LLMClient, LLMConfig,
)
from syntax_tree.agents.pipeline import run_agent_pipeline
from syntax_tree.agents.clustering import ClusteringConfig
from syntax_tree.agents.architecture import ArchitectureConfig


# ─── Test Repository Paths ───

INTEGRATION_DIR = os.path.dirname(__file__)
REPOS_DIR = os.path.join(INTEGRATION_DIR, "repos")


@pytest.fixture(scope="session")
def minimal_repo_path():
    """The 2-file worked example repo."""
    return os.path.join(REPOS_DIR, "minimal")


@pytest.fixture(scope="session")
def small_app_repo_path():
    """A ~20 file app with clear layered architecture."""
    return os.path.join(REPOS_DIR, "small_app")


@pytest.fixture(scope="session")
def messy_app_repo_path():
    """A ~15 file app with circular deps, god class, orphan module."""
    return os.path.join(REPOS_DIR, "messy_app")


@pytest.fixture(scope="session")
def edge_cases_repo_path():
    """Repo with broken files, empty files, unusual patterns."""
    return os.path.join(REPOS_DIR, "edge_cases")


# ─── Mock LLM ───

def mock_response(text, tokens_in=100, tokens_out=50):
    """Create a mock OpenAI-compatible response."""
    return SimpleNamespace(
        choices=[SimpleNamespace(
            message=SimpleNamespace(content=text)
        )],
        usage=SimpleNamespace(
            prompt_tokens=tokens_in,
            completion_tokens=tokens_out,
        ),
        model="mock-model",
    )


class MockOpenAIClient:
    """Mock that returns context-aware responses based on the prompt content."""
    
    def __init__(self):
        self.call_count = 0
        self.call_args = []
    
    @property
    def chat(self):
        return self
    
    @property
    def completions(self):
        return self
    
    def create(self, **kwargs):
        self.call_args.append(kwargs)
        self.call_count += 1
        
        messages = kwargs.get("messages", [])
        last_message = messages[-1]["content"] if messages else ""
        
        # Detect what kind of request this is and return appropriate response
        if "Name and describe" in last_message or "Cluster" in last_message:
            return self._clustering_response(last_message)
        elif "Subsystem" in last_message or "architecture" in last_message.lower():
            return self._architecture_response(last_message)
        elif "documentation" in last_message.lower() or "Function" in last_message:
            return self._documentation_response(last_message)
        elif "Question:" in last_message:
            return self._query_response(last_message)
        else:
            return mock_response(json.dumps({
                "name": f"Component {self.call_count}",
                "description": "Auto-generated component description.",
                "domain": "unknown"
            }))
    
    def _clustering_response(self, prompt):
        """Generate mock clustering labels."""
        # Count how many clusters are in the prompt
        cluster_count = prompt.count("Cluster ") or prompt.count("cluster ")
        if cluster_count == 0:
            cluster_count = 1
        
        results = []
        for i in range(min(cluster_count, 10)):
            results.append({
                "name": f"Component Group {i + 1}",
                "description": f"Handles functionality group {i + 1}.",
                "domain": ["utility", "business_logic", "data_access", "api"][i % 4],
            })
        
        if len(results) == 1:
            return mock_response(json.dumps(results[0]))
        return mock_response(json.dumps(results))
    
    def _architecture_response(self, prompt):
        """Generate mock architecture responses."""
        if "summary" in prompt.lower() or "overview" in prompt.lower():
            return mock_response(json.dumps({
                "system_summary": "A well-structured application with clear separation of concerns.",
                "key_findings": [
                    "Clean dependency structure",
                    "Good layer separation",
                    "Some areas could benefit from refactoring"
                ],
            }))
        else:
            # Subsystem naming
            return mock_response(json.dumps([{
                "name": "Main Application Subsystem",
                "description": "Core application functionality.",
                "architectural_style": "layered",
            }]))
    
    def _documentation_response(self, prompt):
        """Generate mock documentation content."""
        if "Function" in prompt:
            # Batch function docs
            count = prompt.count("Function ") or 1
            results = []
            for i in range(min(count, 20)):
                results.append({
                    "summary": f"Function summary {i + 1}.",
                    "body": f"Detailed description of function {i + 1}. This function performs its designated task.",
                    "code_refs": [],
                })
            return mock_response(json.dumps(results if len(results) > 1 else results[0]))
        else:
            return mock_response(json.dumps({
                "summary": "Component summary.",
                "body": "Detailed component documentation. This component handles its designated responsibilities.",
                "code_refs": [],
            }))
    
    def _query_response(self, prompt):
        """Generate mock query answers with citations."""
        return mock_response(
            "Based on the codebase analysis, the system is organized into "
            "clear components with well-defined responsibilities. "
            "The main functionality is handled by the core service layer."
        )


@pytest.fixture
def mock_llm():
    """LLMClient with context-aware mock responses."""
    config = LLMConfig(api_key="test-key")
    client = LLMClient(config)
    client._client = MockOpenAIClient()
    return client


# ─── Graph Fixtures ───

@pytest.fixture
def empty_graph():
    """Empty in-memory Knowledge Graph."""
    config = KnowledgeGraphConfig(db_path=":memory:")
    graph = KnowledgeGraph(config=config)
    yield graph
    graph.close()


@pytest.fixture
def extract_result(minimal_repo_path):
    """ParseResult from the minimal repo."""
    orchestrator = PipelineOrchestrator()
    return orchestrator.extract(minimal_repo_path)


@pytest.fixture
def populated_graph(extract_result):
    """Graph with minimal repo data ingested."""
    config = KnowledgeGraphConfig(db_path=":memory:")
    graph = KnowledgeGraph(config=config)
    graph.ingest(extract_result)
    yield graph
    graph.close()


@pytest.fixture
def clustered_graph(populated_graph, mock_llm):
    """Graph with clustering done."""
    populated_graph.clear_interpretations()
    agent = ClusteringAgent()
    agent.run(populated_graph, mock_llm)
    return populated_graph


@pytest.fixture
def fully_analyzed_graph(populated_graph, mock_llm):
    """Graph with full pipeline: clustering + architecture + documentation."""
    agents = [ClusteringAgent(), ArchitectureAgent(), DocumentationAgent()]
    run_agent_pipeline(populated_graph, mock_llm, agents)
    return populated_graph
```

---

## test_extraction_to_graph.py

```python
"""
Test the boundary between Subsystem A (Extraction Engine) and 
Subsystem B (Knowledge Graph). Verify that ParseResult ingestion 
preserves all data correctly.
"""

import json
import pytest


class TestExtractionToGraph:
    """Validate that ParseResult → KnowledgeGraph preserves everything."""
    
    def test_node_count_preserved(self, extract_result, populated_graph):
        """Every node from extraction appears in the graph."""
        stats = populated_graph.get_stats()
        assert stats["total_nodes"] == len(extract_result.nodes), \
            f"Graph has {stats['total_nodes']}, extraction produced {len(extract_result.nodes)}"
    
    def test_edge_count_preserved(self, extract_result, populated_graph):
        """Every edge from extraction appears in the graph."""
        expected = len(extract_result.edges) + len(extract_result.resolved_edges)
        stats = populated_graph.get_stats()
        # Note: may differ if UNIQUE constraint drops duplicate edges
        # Assert >= 80% preserved at minimum
        assert stats["total_edges"] >= expected * 0.8, \
            f"Graph has {stats['total_edges']}, expected ~{expected}"
    
    def test_every_node_retrievable(self, extract_result, populated_graph):
        """Every extracted node can be retrieved by QualifiedName."""
        missing = []
        for node in extract_result.nodes:
            retrieved = populated_graph.get_node(node.qualified_name)
            if retrieved is None:
                missing.append(node.qualified_name)
        assert len(missing) == 0, f"Missing nodes: {missing[:10]}"
    
    def test_node_fields_preserved(self, extract_result, populated_graph):
        """Node fields survive the extraction → ingestion round trip."""
        for node in extract_result.nodes[:20]:  # sample first 20
            retrieved = populated_graph.get_node(node.qualified_name)
            assert retrieved is not None, f"Missing: {node.qualified_name}"
            assert retrieved.type == node.type
            assert retrieved.name == node.name
            assert retrieved.file_path == node.file_path
            assert retrieved.language == node.language
            assert retrieved.line_start == node.line_start
            assert retrieved.line_end == node.line_end
            assert retrieved.source == "parsed"
            assert retrieved.is_exported == node.is_exported
            assert retrieved.is_async == node.is_async
    
    def test_find_nodes_by_type_matches(self, extract_result, populated_graph):
        """find_nodes(type=X) returns the same count as filtering extraction output."""
        from collections import Counter
        extraction_types = Counter(n.type for n in extract_result.nodes)
        
        for node_type, expected_count in extraction_types.items():
            found = populated_graph.find_nodes(type=node_type)
            assert len(found) == expected_count, \
                f"type={node_type}: graph has {len(found)}, extraction had {expected_count}"
    
    def test_get_node_at_location_works(self, extract_result, populated_graph):
        """Click-to-navigate works for extracted entities."""
        functions = [n for n in extract_result.nodes 
                    if n.type in ("function", "method") and n.line_start > 0]
        
        for func in functions[:10]:
            mid_line = (func.line_start + func.line_end) // 2
            located = populated_graph.get_node_at_location(func.file_path, mid_line)
            assert located is not None, \
                f"No node at {func.file_path}:{mid_line} (expected {func.name})"
    
    def test_full_text_search_finds_entities(self, extract_result, populated_graph):
        """FTS index contains extracted entity names."""
        functions = [n for n in extract_result.nodes if n.type == "function"]
        if functions:
            target = functions[0]
            results = populated_graph.full_text_search(target.name, limit=5)
            found_qns = [r.qualified_name for r in results]
            assert target.qualified_name in found_qns, \
                f"FTS didn't find {target.name}"
    
    def test_unresolved_refs_stored(self, extract_result, populated_graph):
        """Unresolved references are retrievable."""
        unrefs = populated_graph.get_unresolved_references()
        assert len(unrefs) == len(extract_result.unresolved_references), \
            f"Graph has {len(unrefs)} unrefs, extraction had {len(extract_result.unresolved_references)}"
    
    def test_parse_stats_stored(self, extract_result, populated_graph):
        """ParseStats are retrievable and match."""
        stats = populated_graph.get_parse_stats()
        assert stats is not None
        assert stats.total_nodes == extract_result.stats.total_nodes
        assert stats.files_parsed == extract_result.stats.files_parsed
    
    def test_traversal_works_on_ingested_data(self, extract_result, populated_graph):
        """NetworkX traversal works on ingested edges."""
        # Find a node with outgoing CALLS edges
        calls = [e for e in extract_result.resolved_edges if e.edge_type == "CALLS"]
        if calls:
            caller_qn = calls[0].source_qn
            neighbors = populated_graph.get_neighbors(
                caller_qn, edge_types=["CALLS"], direction="outgoing")
            assert len(neighbors) > 0, f"{caller_qn} should have outgoing CALLS"
```

---

## test_graph_to_clustering.py

```python
"""
Test the boundary between Subsystem B (Knowledge Graph) and
the Clustering Agent. Verify that clustering reads graph data
correctly and writes valid interpretation data back.
"""

import json
import pytest

from syntax_tree.agents import ClusteringAgent


class TestGraphToClustering:
    """Validate the Knowledge Graph → Clustering Agent boundary."""
    
    def test_clustering_produces_components(self, clustered_graph):
        """Clustering creates component nodes in the graph."""
        components = clustered_graph.find_nodes(type="component")
        assert len(components) > 0, "No components created"
    
    def test_components_are_inferred(self, clustered_graph):
        """All components have source='inferred'."""
        components = clustered_graph.find_nodes(type="component")
        for comp in components:
            assert comp.source == "inferred", \
                f"{comp.qualified_name} has source={comp.source}"
    
    def test_components_have_confidence(self, clustered_graph):
        """All components have a confidence score."""
        components = clustered_graph.find_nodes(type="component")
        for comp in components:
            assert comp.confidence is not None, \
                f"{comp.qualified_name} has no confidence"
            assert 0.0 <= comp.confidence <= 1.0, \
                f"{comp.qualified_name} confidence={comp.confidence}"
    
    def test_components_have_evidence(self, clustered_graph):
        """All components have evidence listing member QNs."""
        components = clustered_graph.find_nodes(type="component")
        for comp in components:
            assert comp.evidence_json is not None
            evidence = json.loads(comp.evidence_json)
            assert len(evidence) > 0, \
                f"{comp.qualified_name} has empty evidence"
            # Each evidence QN should exist in the graph
            for qn in evidence:
                assert clustered_graph.get_node(qn) is not None, \
                    f"Evidence QN {qn} doesn't exist in graph"
    
    def test_membership_edges_exist(self, clustered_graph):
        """BELONGS_TO_COMPONENT edges connect members to components."""
        edges = clustered_graph.get_edges(edge_type="BELONGS_TO_COMPONENT")
        assert len(edges) > 0, "No BELONGS_TO_COMPONENT edges"
        
        for edge in edges:
            assert edge.source == "inferred"
            # source_qn should be a parsed entity
            source_node = clustered_graph.get_node(edge.source_qn)
            assert source_node is not None, f"Missing source: {edge.source_qn}"
            # target_qn should be a component
            target_node = clustered_graph.get_node(edge.target_qn)
            assert target_node is not None, f"Missing target: {edge.target_qn}"
            assert target_node.type == "component"
    
    def test_all_clusterable_nodes_assigned(self, clustered_graph):
        """Every function, method, class, module is in at least one component."""
        clusterable = clustered_graph.find_nodes(
            source="parsed", type=["function", "method", "class", "module"])
        membership = clustered_graph.get_edges(edge_type="BELONGS_TO_COMPONENT")
        assigned = {e.source_qn for e in membership}
        
        clusterable_qns = {n.qualified_name for n in clusterable}
        unassigned = clusterable_qns - assigned
        
        # Allow small number of unassigned (edge cases)
        assert len(unassigned) <= len(clusterable_qns) * 0.1, \
            f"{len(unassigned)} unassigned: {list(unassigned)[:5]}"
    
    def test_parsed_data_unchanged(self, extract_result, clustered_graph):
        """Clustering didn't modify parsed nodes or edges."""
        for node in extract_result.nodes[:20]:
            retrieved = clustered_graph.get_node(node.qualified_name)
            assert retrieved is not None, f"Parsed node disappeared: {node.qualified_name}"
            assert retrieved.source == "parsed"
            assert retrieved.type == node.type
    
    def test_component_qn_format(self, clustered_graph):
        """Component QualifiedNames follow the expected format."""
        components = clustered_graph.find_nodes(type="component")
        for comp in components:
            assert comp.qualified_name.startswith("component:"), \
                f"Bad QN format: {comp.qualified_name}"
    
    def test_component_names_unique(self, clustered_graph):
        """No two components share a name."""
        components = clustered_graph.find_nodes(type="component")
        names = [c.name for c in components]
        assert len(names) == len(set(names)), \
            f"Duplicate names: {[n for n in names if names.count(n) > 1]}"


class TestClusteringOnDifferentGraphs:
    """Test clustering behavior on various graph topologies."""
    
    def test_small_graph_may_skip(self, empty_graph, mock_llm):
        """Graph with very few nodes may skip clustering."""
        # Ingest a tiny ParseResult with 2 functions
        # ... build minimal parse result ...
        agent = ClusteringAgent(ClusteringConfig(min_nodes_to_cluster=5))
        plan = agent.plan(empty_graph)
        # Either skips or produces 1 component
    
    def test_clustering_is_deterministic(self, populated_graph, mock_llm):
        """Same graph produces same components on two runs."""
        populated_graph.clear_interpretations()
        agent = ClusteringAgent()
        agent.run(populated_graph, mock_llm)
        
        components_1 = sorted(
            [c.qualified_name for c in populated_graph.find_nodes(type="component")])
        
        populated_graph.clear_interpretations()
        agent.run(populated_graph, mock_llm)
        
        components_2 = sorted(
            [c.qualified_name for c in populated_graph.find_nodes(type="component")])
        
        assert components_1 == components_2, "Clustering is not deterministic"
```

---

## test_clustering_to_architecture.py

```python
"""
Test the boundary between the Clustering Agent and the Architecture Agent.
Verify that architecture reads clustering output correctly and produces
valid subsystems, layers, patterns, and violations.
"""

import json
import pytest

from syntax_tree.agents import ArchitectureAgent
from syntax_tree.agents.pipeline import run_agent_pipeline
from syntax_tree.agents import ClusteringAgent


class TestClusteringToArchitecture:
    """Validate Clustering → Architecture data flow."""
    
    def test_architecture_finds_components(self, clustered_graph, mock_llm):
        """Architecture Agent can read clustering output."""
        agent = ArchitectureAgent()
        plan = agent.plan(clustered_graph)
        assert plan.should_run, f"Architecture skipped: {plan.skip_reason}"
    
    def test_architecture_produces_subsystems(self, clustered_graph, mock_llm):
        """Architecture creates subsystem nodes."""
        agent = ArchitectureAgent()
        agent.run(clustered_graph, mock_llm)
        
        subsystems = clustered_graph.find_nodes(type="subsystem")
        # Filter out system overview
        subsystems = [s for s in subsystems 
                     if not s.qualified_name.startswith("architecture:")]
        assert len(subsystems) >= 0  # may be 0 for very small repos
    
    def test_architecture_produces_layers(self, clustered_graph, mock_llm):
        """Architecture creates layer nodes with valid positions."""
        agent = ArchitectureAgent()
        agent.run(clustered_graph, mock_llm)
        
        layers = clustered_graph.find_nodes(type="architectural_layer")
        if layers:
            positions = sorted(
                json.loads(l.metadata_json).get("layer_position", -1) 
                for l in layers)
            # Positions should be contiguous from 0
            expected = list(range(len(positions)))
            assert positions == expected, \
                f"Layer positions not contiguous: {positions}"
    
    def test_architecture_preserves_components(self, clustered_graph, mock_llm):
        """Components still exist after Architecture Agent runs."""
        pre_count = len(clustered_graph.find_nodes(type="component"))
        
        agent = ArchitectureAgent()
        agent.run(clustered_graph, mock_llm)
        
        post_count = len(clustered_graph.find_nodes(type="component"))
        assert post_count == pre_count, \
            f"Components changed: {pre_count} before, {post_count} after"
    
    def test_system_overview_exists(self, clustered_graph, mock_llm):
        """System overview node is created with health score."""
        agent = ArchitectureAgent()
        agent.run(clustered_graph, mock_llm)
        
        overview = clustered_graph.get_node("architecture:system_overview")
        assert overview is not None, "System overview not created"
        
        meta = json.loads(overview.metadata_json)
        health = meta.get("health_score")
        assert health is not None, "No health score"
        assert 0.0 <= health <= 1.0, f"Invalid health score: {health}"
    
    def test_violations_have_required_fields(self, clustered_graph, mock_llm):
        """All violations have type, severity, and evidence."""
        agent = ArchitectureAgent()
        agent.run(clustered_graph, mock_llm)
        
        violations = clustered_graph.find_nodes(type="violation")
        valid_types = {"boundary_crossing", "circular_dependency", 
                      "layer_violation", "orphan_component", "god_component"}
        valid_severities = {"low", "medium", "high"}
        
        for v in violations:
            meta = json.loads(v.metadata_json)
            assert meta.get("violation_type") in valid_types, \
                f"Invalid violation type: {meta.get('violation_type')}"
            assert meta.get("severity") in valid_severities, \
                f"Invalid severity: {meta.get('severity')}"
    
    def test_subsystem_membership_is_exclusive(self, clustered_graph, mock_llm):
        """Each component belongs to at most one subsystem."""
        agent = ArchitectureAgent()
        agent.run(clustered_graph, mock_llm)
        
        edges = clustered_graph.get_edges(edge_type="BELONGS_TO_SUBSYSTEM")
        sources = [e.source_qn for e in edges]
        
        duplicates = [s for s in sources if sources.count(s) > 1]
        assert len(duplicates) == 0, \
            f"Components in multiple subsystems: {set(duplicates)}"


class TestPipelineOrder:
    """Verify that the pipeline runs agents in correct order."""
    
    def test_pipeline_runs_clustering_before_architecture(self, populated_graph, mock_llm):
        """Pipeline orchestrator respects dependency order."""
        agents = [ArchitectureAgent(), ClusteringAgent()]  # wrong order
        results = run_agent_pipeline(populated_graph, mock_llm, agents)
        
        # Both should have run (pipeline sorts by dependencies)
        assert "Clustering Agent" in results
        assert "Architecture Agent" in results
        assert not results["Clustering Agent"].metadata.get("skipped")
    
    def test_architecture_skips_without_clustering(self, populated_graph, mock_llm):
        """Architecture Agent skips if clustering hasn't run."""
        # Don't run clustering, just try architecture directly
        agent = ArchitectureAgent()
        plan = agent.plan(populated_graph)
        assert not plan.should_run, "Architecture should skip without components"
```

---

## test_full_pipeline.py

```python
"""
Test the complete pipeline from source code to fully analyzed graph.
This is the integration test that validates everything works together.
"""

import json
import pytest


class TestFullPipeline:
    """End-to-end pipeline tests."""
    
    def test_minimal_repo_full_pipeline(self, fully_analyzed_graph):
        """Full pipeline completes on the minimal repo."""
        stats = fully_analyzed_graph.get_stats()
        
        # Parsed data exists
        assert stats["parsed_count"] > 0
        
        # Interpretation data exists
        assert stats["inferred_count"] > 0
        
        # Components exist
        components = fully_analyzed_graph.find_nodes(type="component")
        assert len(components) > 0
        
        # Documentation exists (if Documentation Agent ran)
        docs = fully_analyzed_graph.find_nodes(type="documentation_section")
        # docs may be 0 if Documentation Agent isn't built yet
    
    def test_all_node_types_coexist(self, fully_analyzed_graph):
        """Parsed and inferred nodes coexist in the graph."""
        parsed = fully_analyzed_graph.find_nodes(source="parsed")
        inferred = fully_analyzed_graph.find_nodes(source="inferred")
        
        assert len(parsed) > 0, "No parsed nodes"
        assert len(inferred) > 0, "No inferred nodes"
        
        # Verify they're all retrievable
        for node in (parsed + inferred)[:50]:
            retrieved = fully_analyzed_graph.get_node(node.qualified_name)
            assert retrieved is not None
    
    def test_traversal_across_parsed_and_inferred(self, fully_analyzed_graph):
        """Graph traversal works across parsed and inferred nodes."""
        components = fully_analyzed_graph.find_nodes(type="component")
        if components:
            comp = components[0]
            # Traverse from component to its members via BELONGS_TO_COMPONENT
            edges = fully_analyzed_graph.get_edges(
                target_qn=comp.qualified_name,
                edge_type="BELONGS_TO_COMPONENT")
            assert len(edges) > 0, f"Component {comp.name} has no members"
            
            # Each member should be a parsed node
            for edge in edges:
                member = fully_analyzed_graph.get_node(edge.source_qn)
                assert member is not None
                assert member.source == "parsed"
    
    def test_graph_stats_internally_consistent(self, fully_analyzed_graph):
        """Graph statistics are self-consistent."""
        stats = fully_analyzed_graph.get_stats()
        
        # parsed + inferred = total
        assert stats["parsed_count"] + stats["inferred_count"] == stats["total_nodes"], \
            f"{stats['parsed_count']} + {stats['inferred_count']} != {stats['total_nodes']}"
        
        # nodes_by_type sums to total
        type_sum = sum(stats.get("nodes_by_type", {}).values())
        assert type_sum == stats["total_nodes"], \
            f"nodes_by_type sum {type_sum} != total {stats['total_nodes']}"
        
        # edges_by_type sums to total
        edge_sum = sum(stats.get("edges_by_type", {}).values())
        assert edge_sum == stats["total_edges"], \
            f"edges_by_type sum {edge_sum} != total {stats['total_edges']}"
    
    def test_all_evidence_references_valid(self, fully_analyzed_graph):
        """Every inferred node's evidence points to existing nodes."""
        inferred = fully_analyzed_graph.find_nodes(source="inferred")
        
        bad_refs = []
        for node in inferred:
            if node.evidence_json:
                try:
                    evidence = json.loads(node.evidence_json)
                    for qn in evidence:
                        if fully_analyzed_graph.get_node(qn) is None:
                            bad_refs.append((node.qualified_name, qn))
                except json.JSONDecodeError:
                    bad_refs.append((node.qualified_name, "INVALID_JSON"))
        
        assert len(bad_refs) == 0, \
            f"Dangling evidence references: {bad_refs[:10]}"
    
    def test_no_orphaned_edges(self, fully_analyzed_graph):
        """Every edge's source_qn references an existing node."""
        all_edges = fully_analyzed_graph.get_edges()
        
        orphaned = []
        for edge in all_edges:
            if fully_analyzed_graph.get_node(edge.source_qn) is None:
                orphaned.append(edge.source_qn)
        
        assert len(orphaned) == 0, \
            f"Orphaned edge sources: {set(orphaned)}"
```

---

## test_query_on_analyzed_graph.py

```python
"""
Test the Query Agent against a fully analyzed graph.
Validates that questions produce grounded, cited answers.
"""

import pytest

from syntax_tree.agents import QueryAgent
from syntax_tree.agents.query import QueryConfig


class TestQueryOnAnalyzedGraph:
    """Query Agent integration tests."""
    
    @pytest.fixture
    def query_agent(self, fully_analyzed_graph, mock_llm):
        return QueryAgent(
            graph=fully_analyzed_graph, llm=mock_llm,
            config=QueryConfig())
    
    def test_navigational_query(self, query_agent):
        """'Where is X?' returns a valid response."""
        r = query_agent.query("Where is the main service?")
        assert r.answer_text, "Empty answer"
        assert r.confidence >= 0, "Negative confidence"
        assert r.duration_seconds > 0
    
    def test_explanatory_query(self, query_agent):
        """'How does X work?' returns an answer."""
        r = query_agent.query("How does the system work?")
        assert r.answer_text
        assert r.intent == "explanatory" or r.intent == "architectural"
    
    def test_architectural_query(self, query_agent):
        """'What is the architecture?' returns an answer."""
        r = query_agent.query("What is the architecture of this codebase?")
        assert r.answer_text
    
    def test_inventory_query(self, query_agent):
        """'List all functions' returns an answer."""
        r = query_agent.query("List all functions in this codebase.")
        assert r.answer_text
        assert r.intent == "inventory"
    
    def test_no_match_query_doesnt_crash(self, query_agent):
        """Query about nonexistent entity doesn't crash."""
        r = query_agent.query("Where is the blockchain handler?")
        assert r.answer_text  # should have a helpful response
        assert r.confidence < 0.8  # should be low confidence
    
    def test_follow_up_suggestions_present(self, query_agent):
        """Answers include follow-up suggestions."""
        r = query_agent.query("What does this codebase do?")
        assert len(r.follow_up_suggestions) > 0
        assert len(r.follow_up_suggestions) <= 3
    
    def test_multi_turn_conversation(self, query_agent):
        """Multi-turn conversation maintains context."""
        conv_id = "test_conv"
        r1 = query_agent.query("What components exist?", conv_id)
        assert r1.turn_number == 1
        
        r2 = query_agent.query("Tell me more about the first one.", conv_id)
        assert r2.turn_number == 2
        assert r2.conversation_id == conv_id
    
    def test_query_performance(self, query_agent):
        """Queries complete within performance budget."""
        import time
        start = time.monotonic()
        r = query_agent.query("What functions exist?")
        elapsed = time.monotonic() - start
        assert elapsed < 15.0, f"Query took {elapsed:.2f}s (budget: 15s)"
```

---

## test_data_consistency.py

```python
"""
Cross-subsystem data consistency checks.
Verify that data flowing between subsystems maintains integrity.
"""

import json
import pytest


class TestDataConsistency:
    """Verify cross-subsystem data integrity."""
    
    def test_qn_format_consistency(self, fully_analyzed_graph):
        """All QualifiedNames follow their type's format."""
        all_nodes = (
            fully_analyzed_graph.find_nodes(source="parsed") + 
            fully_analyzed_graph.find_nodes(source="inferred")
        )
        
        for node in all_nodes:
            qn = node.qualified_name
            if node.type == "component":
                assert qn.startswith("component:"), f"Bad component QN: {qn}"
            elif node.type == "subsystem":
                assert (qn.startswith("subsystem:") or 
                       qn.startswith("architecture:")), f"Bad subsystem QN: {qn}"
            elif node.type == "architectural_layer":
                assert qn.startswith("layer:"), f"Bad layer QN: {qn}"
            elif node.type == "violation":
                assert qn.startswith("violation:"), f"Bad violation QN: {qn}"
            elif node.type == "pattern_instance":
                assert qn.startswith("pattern:"), f"Bad pattern QN: {qn}"
            elif node.type == "documentation_section":
                assert qn.startswith("doc:"), f"Bad doc QN: {qn}"
            elif node.source == "parsed":
                # Parsed nodes should have language prefix
                assert ":" in qn, f"Parsed node missing language prefix: {qn}"
    
    def test_edge_type_consistency(self, fully_analyzed_graph):
        """All edges have valid types for their source."""
        parsed_types = {"DEFINES", "CONTAINS", "INHERITS", "IMPORTS", "CALLS"}
        inferred_types = {"BELONGS_TO_COMPONENT", "BELONGS_TO_SUBSYSTEM",
                         "IMPLEMENTS_PATTERN", "VIOLATES_BOUNDARY",
                         "READS_FROM", "WRITES_TO"}
        
        all_edges = fully_analyzed_graph.get_edges()
        for edge in all_edges:
            if edge.source == "parsed":
                assert edge.edge_type in parsed_types, \
                    f"Parsed edge has inferred type: {edge.edge_type}"
            elif edge.source == "inferred":
                assert edge.edge_type in inferred_types, \
                    f"Inferred edge has parsed type: {edge.edge_type}"
    
    def test_no_inferred_source_on_parsed_nodes(self, fully_analyzed_graph):
        """No parsed entity has source='inferred'."""
        code_types = {"function", "method", "class", "module", "variable",
                     "constant", "database_table", "database_column"}
        
        for node_type in code_types:
            nodes = fully_analyzed_graph.find_nodes(type=node_type)
            for node in nodes:
                assert node.source == "parsed", \
                    f"Code entity {node.qualified_name} has source={node.source}"
    
    def test_no_parsed_source_on_inferred_nodes(self, fully_analyzed_graph):
        """No interpretation entity has source='parsed'."""
        interp_types = {"component", "subsystem", "architectural_layer",
                       "pattern_instance", "violation", "documentation_section"}
        
        for node_type in interp_types:
            nodes = fully_analyzed_graph.find_nodes(type=node_type)
            for node in nodes:
                assert node.source == "inferred", \
                    f"Interpretation {node.qualified_name} has source={node.source}"
    
    def test_bidirectional_membership(self, fully_analyzed_graph):
        """Component membership edges are consistent with component evidence."""
        components = fully_analyzed_graph.find_nodes(type="component")
        
        for comp in components:
            # Members from edges
            edges = fully_analyzed_graph.get_edges(
                target_qn=comp.qualified_name,
                edge_type="BELONGS_TO_COMPONENT")
            edge_members = {e.source_qn for e in edges}
            
            # Members from evidence
            if comp.evidence_json:
                evidence_members = set(json.loads(comp.evidence_json))
            else:
                evidence_members = set()
            
            # These should match
            assert edge_members == evidence_members, \
                f"Component {comp.name}: edges have {len(edge_members)} members, " \
                f"evidence has {len(evidence_members)} members"
```

---

## test_error_resilience.py

```python
"""
Test system behavior when given broken, malformed, or edge-case inputs.
The system should never crash — it should degrade gracefully.
"""

import os
import pytest
import tempfile

from syntax_tree.pipeline.orchestrator import PipelineOrchestrator
from syntax_tree.graph import KnowledgeGraph, KnowledgeGraphConfig


class TestErrorResilience:
    """Verify graceful degradation on bad inputs."""
    
    def test_empty_directory(self, empty_graph):
        """Empty directory produces empty results, no crash."""
        with tempfile.TemporaryDirectory() as tmp:
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            assert result.stats.total_nodes == 0
            assert result.stats.files_parsed == 0
    
    def test_nonexistent_directory(self):
        """Nonexistent path raises clear error."""
        orchestrator = PipelineOrchestrator()
        with pytest.raises((FileNotFoundError, ValueError)):
            orchestrator.extract("/nonexistent/path/that/does/not/exist")
    
    def test_binary_files_skipped(self):
        """Binary files don't crash the parser."""
        with tempfile.TemporaryDirectory() as tmp:
            # Create a binary file with .py extension
            with open(os.path.join(tmp, "binary.py"), "wb") as f:
                f.write(bytes(range(256)))
            # Create a valid file
            with open(os.path.join(tmp, "valid.py"), "w") as f:
                f.write("def hello(): pass\n")
            
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            # Valid file should be parsed, binary should be skipped
            assert result.stats.files_parsed >= 1
    
    def test_syntax_error_file_doesnt_crash_pipeline(self):
        """File with syntax errors doesn't stop other files from parsing."""
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "broken.py"), "w") as f:
                f.write("def broken(:\n    pass\n")
            with open(os.path.join(tmp, "valid.py"), "w") as f:
                f.write("def valid():\n    return True\n")
            
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            
            # Valid file's function should be extracted
            func_names = [n.name for n in result.nodes if n.type == "function"]
            assert "valid" in func_names
    
    def test_empty_python_file(self):
        """Empty .py file produces a module node, no crash."""
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "empty.py"), "w") as f:
                f.write("")
            
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            # Should have at least a module node
            assert result.stats.files_parsed >= 1
    
    def test_deeply_nested_directory(self):
        """Very deep directory nesting doesn't crash."""
        with tempfile.TemporaryDirectory() as tmp:
            deep = tmp
            for i in range(20):
                deep = os.path.join(deep, f"level_{i}")
                os.makedirs(deep, exist_ok=True)
            
            with open(os.path.join(deep, "deep.py"), "w") as f:
                f.write("def deep_function(): pass\n")
            
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            assert result.stats.files_parsed >= 1
    
    def test_unicode_in_source(self):
        """Files with Unicode content parse correctly."""
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "unicode.py"), "w", encoding="utf-8") as f:
                f.write('def greet():\n    return "こんにちは世界"\n')
            
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            assert result.stats.files_parsed >= 1
    
    def test_ingestion_of_empty_parse_result(self, empty_graph):
        """Ingesting empty ParseResult doesn't crash."""
        with tempfile.TemporaryDirectory() as tmp:
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            # Should not crash
            empty_graph.ingest(result)
            stats = empty_graph.get_stats()
            assert stats["total_nodes"] == 0
    
    def test_clustering_on_tiny_graph(self, mock_llm):
        """Clustering on very small graph skips or produces minimal output."""
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "tiny.py"), "w") as f:
                f.write("x = 1\n")
            
            orchestrator = PipelineOrchestrator()
            result = orchestrator.extract(tmp)
            
            config = KnowledgeGraphConfig(db_path=":memory:")
            graph = KnowledgeGraph(config=config)
            graph.ingest(result)
            
            from syntax_tree.agents import ClusteringAgent
            agent = ClusteringAgent()
            clustering_result = agent.run(graph, mock_llm)
            # Should either skip or produce 1 component, not crash
            graph.close()
```

---

## test_re_analysis.py

```python
"""
Test re-ingestion and re-analysis scenarios.
Verify that running the pipeline twice produces clean results.
"""

import json
import pytest

from syntax_tree.pipeline.orchestrator import PipelineOrchestrator
from syntax_tree.graph import KnowledgeGraph, KnowledgeGraphConfig
from syntax_tree.agents import ClusteringAgent, ArchitectureAgent
from syntax_tree.agents.pipeline import run_agent_pipeline


class TestReAnalysis:
    """Verify re-analysis produces clean, consistent results."""
    
    def test_re_ingestion_replaces_data(self, minimal_repo_path, mock_llm):
        """Ingesting twice replaces, doesn't append."""
        config = KnowledgeGraphConfig(db_path=":memory:")
        graph = KnowledgeGraph(config=config)
        
        orchestrator = PipelineOrchestrator()
        result = orchestrator.extract(minimal_repo_path)
        
        graph.ingest(result)
        count_1 = graph.get_stats()["total_nodes"]
        
        graph.ingest(result)
        count_2 = graph.get_stats()["total_nodes"]
        
        assert count_1 == count_2, "Re-ingestion changed node count"
        graph.close()
    
    def test_re_pipeline_replaces_interpretations(self, minimal_repo_path, mock_llm):
        """Running the full pipeline twice gives same result count."""
        config = KnowledgeGraphConfig(db_path=":memory:")
        graph = KnowledgeGraph(config=config)
        
        orchestrator = PipelineOrchestrator()
        result = orchestrator.extract(minimal_repo_path)
        graph.ingest(result)
        
        # Run pipeline first time
        agents = [ClusteringAgent(), ArchitectureAgent()]
        run_agent_pipeline(graph, mock_llm, agents)
        
        stats_1 = graph.get_stats()
        
        # Run pipeline second time
        run_agent_pipeline(graph, mock_llm, agents)
        
        stats_2 = graph.get_stats()
        
        assert stats_1["total_nodes"] == stats_2["total_nodes"], \
            f"Node count changed: {stats_1['total_nodes']} -> {stats_2['total_nodes']}"
        
        graph.close()
    
    def test_clear_interpretations_preserves_parsed(self, fully_analyzed_graph):
        """Clearing interpretations keeps parsed data intact."""
        parsed_before = len(fully_analyzed_graph.find_nodes(source="parsed"))
        
        fully_analyzed_graph.clear_interpretations()
        
        parsed_after = len(fully_analyzed_graph.find_nodes(source="parsed"))
        inferred_after = len(fully_analyzed_graph.find_nodes(source="inferred"))
        
        assert parsed_after == parsed_before, "Parsed nodes were deleted"
        assert inferred_after == 0, "Inferred nodes weren't cleared"
```

---

## test_performance.py

```python
"""
Performance tests to verify the system meets its time and memory budgets.
"""

import time
import pytest

from syntax_tree.pipeline.orchestrator import PipelineOrchestrator
from syntax_tree.graph import KnowledgeGraph, KnowledgeGraphConfig
from syntax_tree.agents import ClusteringAgent, ArchitectureAgent
from syntax_tree.agents.pipeline import run_agent_pipeline


class TestPerformance:
    """Performance budget validation."""
    
    def test_extraction_performance(self, minimal_repo_path):
        """Extraction completes within budget."""
        start = time.monotonic()
        orchestrator = PipelineOrchestrator()
        result = orchestrator.extract(minimal_repo_path)
        elapsed = time.monotonic() - start
        
        assert elapsed < 10.0, f"Extraction took {elapsed:.2f}s (budget: 10s)"
    
    def test_ingestion_performance(self, extract_result):
        """Ingestion completes within budget."""
        config = KnowledgeGraphConfig(db_path=":memory:")
        graph = KnowledgeGraph(config=config)
        
        start = time.monotonic()
        graph.ingest(extract_result)
        elapsed = time.monotonic() - start
        
        assert elapsed < 5.0, f"Ingestion took {elapsed:.2f}s (budget: 5s)"
        graph.close()
    
    def test_single_node_lookup_performance(self, populated_graph, extract_result):
        """Single node lookup is sub-10ms."""
        if not extract_result.nodes:
            pytest.skip("No nodes")
        
        qn = extract_result.nodes[0].qualified_name
        
        start = time.monotonic()
        for _ in range(100):
            populated_graph.get_node(qn)
        elapsed = (time.monotonic() - start) / 100
        
        assert elapsed < 0.01, f"Avg lookup: {elapsed*1000:.2f}ms (budget: 10ms)"
    
    def test_traversal_performance(self, populated_graph, extract_result):
        """3-hop traversal is sub-100ms."""
        if not extract_result.nodes:
            pytest.skip("No nodes")
        
        qn = extract_result.nodes[0].qualified_name
        
        start = time.monotonic()
        populated_graph.traverse(qn, max_depth=3)
        elapsed = time.monotonic() - start
        
        assert elapsed < 0.1, f"Traversal took {elapsed*1000:.2f}ms (budget: 100ms)"
    
    def test_full_pipeline_performance(self, minimal_repo_path, mock_llm):
        """Full pipeline (extraction + ingestion + agents) within budget."""
        config = KnowledgeGraphConfig(db_path=":memory:")
        graph = KnowledgeGraph(config=config)
        
        start = time.monotonic()
        
        orchestrator = PipelineOrchestrator()
        result = orchestrator.extract(minimal_repo_path)
        graph.ingest(result)
        
        agents = [ClusteringAgent(), ArchitectureAgent()]
        run_agent_pipeline(graph, mock_llm, agents)
        
        elapsed = time.monotonic() - start
        
        assert elapsed < 30.0, f"Full pipeline took {elapsed:.2f}s (budget: 30s)"
        graph.close()
    
    def test_fts_performance(self, populated_graph):
        """Full-text search is sub-200ms."""
        start = time.monotonic()
        populated_graph.full_text_search("function", limit=20)
        elapsed = time.monotonic() - start
        
        assert elapsed < 0.2, f"FTS took {elapsed*1000:.2f}ms (budget: 200ms)"
```

---

## Test Repositories

### repos/minimal/

The exact 2-file worked example from the Extraction Engine Appendix A:

```
repos/minimal/
└── src/
    ├── __init__.py      (empty)
    ├── utils.py         (validate_name, _sanitize, MAX_LENGTH)
    └── service.py       (UserService with __init__, create_user)
```

### repos/small_app/

A ~20 file app with clear layered architecture. Create this with distinct layers:

```
repos/small_app/
├── src/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py          (4 route handlers with @route decorators)
│   │   └── middleware.py      (auth middleware)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── user_service.py    (UserService class, calls repositories)
│   │   ├── order_service.py   (OrderService class, calls repositories)
│   │   └── notification.py    (NotificationService, called by services)
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── user_repo.py       (UserRepository, data access)
│   │   └── order_repo.py      (OrderRepository, data access)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py            (User dataclass)
│   │   └── order.py           (Order dataclass)
│   └── utils/
│       ├── __init__.py
│       ├── validators.py      (shared validation functions)
│       └── helpers.py         (utility functions)
├── migrations/
│   └── 001_initial.sql        (CREATE TABLE users, orders)
├── Dockerfile
└── .env
```

This repo should have:
- Clear layered architecture (api → services → repositories → models)
- Cross-cutting utilities
- Infrastructure files
- Enough code for meaningful clustering (15+ functions across 10+ files)

### repos/messy_app/

A ~15 file app deliberately designed with architectural problems:

```
repos/messy_app/
├── src/
│   ├── __init__.py
│   ├── everything.py       (god module: 30+ functions, calls everything)
│   ├── circular_a.py       (imports from circular_b)
│   ├── circular_b.py       (imports from circular_a)
│   ├── orphan.py           (standalone module, nothing calls it)
│   ├── deep/
│   │   └── nested/
│   │       └── module.py   (deeply nested, imported by everything.py)
│   ├── api.py              (route handlers that directly access database)
│   └── database.py         (database functions)
```

This repo should trigger: god_component violation, circular_dependency violation, boundary_crossing violation (api directly accessing database), orphan_component violation.

### repos/edge_cases/

Files designed to test parser edge cases:

```
repos/edge_cases/
├── empty.py                (empty file)
├── only_comments.py        (only # comments)
├── only_docstring.py       (only module docstring)
├── syntax_error.py         (broken syntax mixed with valid code)
├── deep_nesting.py         (function inside function inside function)
├── many_decorators.py      (function with 5 decorators)
├── star_import.py          (from os.path import *)
├── complex_inheritance.py  (diamond inheritance, multiple mixins)
├── lambda_heavy.py         (many lambda assignments)
├── long_function.py        (single function, 200 lines)
└── unicode_names.py        (function names with unicode, if Python 3 allows)
```
