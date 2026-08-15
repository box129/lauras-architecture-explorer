from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings


@pytest.mark.parametrize(
    ("files", "expected_node", "expected_edge"),
    [
        (
            {
                "pkg/parser.py": "class Parser:\n    def parse_document(self, text: str) -> str:\n        return text.strip()\n",
                "pkg/service.py": "from .parser import Parser\n\nclass AnalysisService:\n    def run(self, text: str) -> str:\n        return Parser().parse_document(text)\n",
            },
            "pkg/parser.py",
            ("pkg/service.py", "pkg/parser.py"),
        ),
        (
            {
                "src/parser.ts": "export class Parser { parseDocument(text: string) { return text.trim(); } }\n",
                "src/analyzer.ts": "import { Parser } from './parser';\nexport class Analyzer { run(text: string) { return new Parser().parseDocument(text); } }\n",
            },
            "src/parser.ts",
            ("src/analyzer.ts", "src/parser.ts"),
        ),
    ],
)
def test_static_graph_is_source_backed_for_python_and_typescript(
    tmp_path: Path,
    files: dict[str, str],
    expected_node: str,
    expected_edge: tuple[str, str],
) -> None:
    for path, text in files.items():
        write(tmp_path / path, text)
    client, run_id = analyzed_client(tmp_path)

    response = client.get("/api/architecture-map", headers=run_headers(run_id))

    assert response.status_code == 200
    body = response.json()
    labels_by_id = {node["id"]: node["label"] for node in body["nodes"]}
    assert expected_node in labels_by_id.values()
    assert any(
        labels_by_id.get(edge["source"]) == expected_edge[0]
        and labels_by_id.get(edge["target"]) == expected_edge[1]
        and edge["kind"] == "imports"
        for edge in body["edges"]
    )
    assert all(
        node["can_drilldown"] is False
        for node in body["nodes"]
        if node["kind"] != "system" and node["children_count"] == 0
    )
    assert body["analysis_run_id"] == run_id


def test_static_graph_resolves_relative_import_from_package_init(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "__init__.py", "from .service import RepositoryService\n")
    write(
        tmp_path / "pkg" / "service.py",
        "class RepositoryService:\n    pass\n",
    )
    client, run_id = analyzed_client(tmp_path)

    response = client.get("/api/architecture-map", headers=run_headers(run_id))

    assert response.status_code == 200
    body = response.json()
    labels_by_id = {node["id"]: node["label"] for node in body["nodes"]}
    assert any(
        labels_by_id.get(edge["source"]) == "pkg/__init__.py"
        and labels_by_id.get(edge["target"]) == "pkg/service.py"
        and edge["kind"] == "imports"
        for edge in body["edges"]
    )


def test_documentation_hierarchy_and_detail_return_exact_source(tmp_path: Path) -> None:
    source = (
        "class Parser:\n"
        "    def parse_document(self, text: str) -> str:\n"
        "        return text.strip()\n"
    )
    write(tmp_path / "pkg/parser.py", source)
    client, run_id = analyzed_client(tmp_path)

    hierarchy_response = client.get("/api/docs/hierarchy", headers=run_headers(run_id))

    assert hierarchy_response.status_code == 200
    hierarchy = hierarchy_response.json()
    parser = next(item for item in flatten(hierarchy["items"]) if item["name"] == "Parser")
    assert hierarchy["analysis_run_id"] == run_id
    assert parser["kind"] == "class"
    assert parser["path"] == "pkg/parser.py"
    assert next(item for item in flatten(hierarchy["items"]) if item["name"] == "parse_document")

    detail_response = client.get(
        f"/api/docs/components/{parser['id']}",
        headers=run_headers(run_id),
    )

    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["analysis_run_id"] == run_id
    assert detail["source"]["path"] == "pkg/parser.py"
    assert "class Parser" in detail["source"]["text"]
    assert "authoritative" in detail["documentation"]
    assert "generic onboarding" not in detail["documentation"].lower()


def test_local_search_is_ranked_bounded_and_run_scoped(tmp_path: Path) -> None:
    alpha = tmp_path / "alpha"
    beta = tmp_path / "beta"
    write(
        alpha / "parser.py",
        "class AlphaParser:\n    def parse_document(self, text: str) -> str:\n        return text\n",
    )
    write(beta / "worker.py", "class BetaWorker:\n    def execute(self) -> None:\n        return None\n")
    app = create_app(Settings(environment="test", database_path=":memory:"))
    client = TestClient(app)
    alpha_run = analyze(client, alpha)
    beta_run = analyze(client, beta)

    response = client.post(
        "/api/query",
        headers=run_headers(alpha_run),
        json={"question": "where is AlphaParser defined"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["analysis_run_id"] == alpha_run
    assert body["visual_lenses"]
    assert "AlphaParser" in [item["title"] for item in body["visual_lenses"][:5]]
    assert all(item["analysis_run_id"] == alpha_run for item in body["visual_lenses"])
    assert all(item["metadata"]["path"] != "worker.py" for item in body["visual_lenses"])
    scores = [item["metadata"]["relevance_score"] for item in body["visual_lenses"]]
    assert scores == sorted(scores, reverse=True)
    assert all(item["evidence"] and item["source_tabs"] for item in body["visual_lenses"])

    active_response = client.post("/api/query", json={"question": "BetaWorker"})
    assert active_response.status_code == 200
    assert active_response.json()["analysis_run_id"] == beta_run
    assert client.post("/api/query", json={"question": "   "}).status_code == 422
    unrelated = client.post(
        "/api/query",
        headers=run_headers(alpha_run),
        json={"question": "quasar zebrafish nebula"},
    )
    assert unrelated.status_code == 200
    assert unrelated.json()["visual_lenses"] == []


def test_query_lens_evidence_and_implementation_routes_are_reachable(tmp_path: Path) -> None:
    write(
        tmp_path / "alpha" / "parser.py",
        "class AlphaParser:\n    def parse_document(self, text: str) -> str:\n        return text\n",
    )
    client, run_id = analyzed_client(tmp_path / "alpha")

    query_response = client.post(
        "/api/query",
        headers=run_headers(run_id),
        json={"question": "where is AlphaParser defined"},
    )
    assert query_response.status_code == 200
    lens_id = query_response.json()["visual_lenses"][0]["id"]

    base_response = client.get(f"/api/query-lenses/{lens_id}", headers=run_headers(run_id))
    assert base_response.status_code == 200
    assert base_response.json()["id"] == lens_id

    implementation_response = client.get(
        f"/api/query-lenses/{lens_id}/implementation",
        headers=run_headers(run_id),
    )
    assert implementation_response.status_code == 200
    implementation_body = implementation_response.json()
    assert implementation_body["node_id"] == lens_id
    assert "tabs" in implementation_body

    evidence_response = client.get(
        f"/api/query-lenses/{lens_id}/evidence",
        headers=run_headers(run_id),
    )
    assert evidence_response.status_code == 200
    evidence_body = evidence_response.json()
    assert evidence_body["lens_id"] == lens_id
    assert evidence_body["total"] == len(evidence_body["evidence"])

    missing_lens_id = "symbol:000000000000000000000000"
    for path in (
        f"/api/query-lenses/{missing_lens_id}",
        f"/api/query-lenses/{missing_lens_id}/implementation",
        f"/api/query-lenses/{missing_lens_id}/evidence",
    ):
        missing_response = client.get(path, headers=run_headers(run_id))
        assert missing_response.status_code == 404
        assert missing_response.json()["detail"] == "Question lens not found."


def test_user_workflow_routes_reject_non_completed_runs(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def main():\n    return 1\n")
    client, run_id = analyzed_client(tmp_path)
    job = client.app.state.run_store.get_run(run_id)
    assert job is not None

    job.status = "running"
    for path in ("/api/architecture-map", "/api/docs/hierarchy"):
        response = client.get(path, headers=run_headers(run_id))
        assert response.status_code == 409
    response = client.post(
        "/api/query",
        headers=run_headers(run_id),
        json={"question": "main"},
    )
    assert response.status_code == 409

    job.status = "failed"
    response = client.get("/api/architecture-map", headers=run_headers(run_id))
    assert response.status_code == 409
    assert "failed" in response.json()["detail"].lower()


def analyzed_client(repo: Path) -> tuple[TestClient, str]:
    client = TestClient(create_app(Settings(environment="test", database_path=":memory:")))
    return client, analyze(client, repo)


def analyze(client: TestClient, repo: Path) -> str:
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    run_id = response.json()["run_id"]
    status = client.get(f"/api/analyze/{response.json()['job_id']}/status")
    assert status.json()["status"] == "completed"
    return run_id


def run_headers(run_id: str) -> dict[str, str]:
    return {"X-Syntax-Tree-Run-Id": run_id}


def flatten(items: list[dict]) -> list[dict]:
    output: list[dict] = []
    for item in items:
        output.append(item)
        output.extend(flatten(item["children"]))
    return output


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
