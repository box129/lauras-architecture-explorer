from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.architecture_clusters.projection import ArchitectureClusterProjector
from syntax_tree_refurbished.app.investigation.llm_model import ModelReply
from syntax_tree_refurbished.config import Settings
from test_architecture_clusters import _prepared, _relation


class FakeModel:
    model_name = "test-model"
    _provider = "openai"

    def __init__(self, data):
        self.data = data
        self.messages = []

    def complete_json(self, *, system, messages, max_tokens):
        self.messages.append((system, messages, max_tokens))
        return ModelReply(self.data, self.model_name, 1, 2, 3)


def _clustered(tmp_path: Path):
    app, run_id, symbols = _prepared(tmp_path, 5)
    relations = [_relation(run_id, symbols[a], symbols[b], line=i + 1) for i, (a, b) in enumerate(((0, 1), (1, 2), (2, 0), (2, 3), (3, 4), (4, 2)))]
    app.state.run_store.put_relations(run_id, tuple(relations))
    overview = app.state.run_store.get_system_overview(run_id)
    cluster = ArchitectureClusterProjector(job=app.state.run_store.get_run(run_id), store=app.state.run_store, overview=overview).project().clusters[0]
    return app, run_id, cluster


def test_valid_interpretation_preserves_deterministic_cluster(tmp_path: Path):
    app, run_id, cluster = _clustered(tmp_path)
    app.state.cluster_interpretation_model = FakeModel({"label": "Request Lifecycle", "description": "This cluster appears centered on request handling."})
    before = (cluster.member_module_ids, cluster.internal_relation_count, cluster.boundary_relation_count)
    response = TestClient(app).post(f"/api/architecture-graph/clusters/{cluster.id}/interpretation", params={"run_id": run_id})
    assert response.status_code == 200
    assert response.json()["interpretation"]["label"] == "Request Lifecycle"
    after = ArchitectureClusterProjector(job=app.state.run_store.get_run(run_id), store=app.state.run_store, overview=app.state.run_store.get_system_overview(run_id)).project().clusters[0]
    assert (after.member_module_ids, after.internal_relation_count, after.boundary_relation_count) == before


def test_unknown_and_wrong_run_clusters_rejected(tmp_path: Path):
    app, run_id, cluster = _clustered(tmp_path)
    client = TestClient(app)
    assert client.post("/api/architecture-graph/clusters/unknown/interpretation", params={"run_id": run_id}).status_code == 404
    assert client.post(f"/api/architecture-graph/clusters/{cluster.id}/interpretation", params={"run_id": "run:wrong"}).status_code in {404, 409}


def test_disabled_and_malformed_provider_are_safe(tmp_path: Path):
    app, run_id, cluster = _clustered(tmp_path)
    client = TestClient(app)
    assert client.post(f"/api/architecture-graph/clusters/{cluster.id}/interpretation", params={"run_id": run_id}).json()["status"] == "unavailable"
    app.state.cluster_interpretation_model = FakeModel({"label": "", "description": 3})
    assert client.post(f"/api/architecture-graph/clusters/{cluster.id}/interpretation", params={"run_id": run_id}).json()["status"] == "unavailable"
