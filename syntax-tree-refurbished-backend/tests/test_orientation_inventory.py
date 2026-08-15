from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings


def test_orientation_inventory_extracts_readme_docs_and_manifest(tmp_path: Path) -> None:
    write(
        tmp_path / "README.md",
        "# Demo Platform\n\n"
        "A service with API routes, workers, webhooks, and deployment notes.\n\n"
        "## Usage\n\n"
        "Run it.\n\n"
        "## Deployment\n\n"
        "Docker is supported.\n",
    )
    write(tmp_path / "docs" / "architecture.md", "# Architecture\n\n## Workers\n\nQueue worker notes.\n")
    write(
        tmp_path / "package.json",
        '{"name": "demo-platform", "description": "HTTP API and worker demo", "scripts": {"dev": "vite"}, "dependencies": {"express": "^5.0.0"}}',
    )
    write(tmp_path / "src" / "app.ts", "export const value = 1\n")
    app, run_id = analyzed_app(tmp_path)

    items = app.state.run_store.get_orientation_items(run_id)
    by_path = {item.path: item for item in items}

    assert {"README.md", "docs/architecture.md", "package.json"} <= set(by_path)
    assert by_path["README.md"].kind == "readme"
    assert by_path["README.md"].title == "Demo Platform"
    assert by_path["README.md"].headings == ("Demo Platform", "Usage", "Deployment")
    assert {"api", "worker", "webhook", "deployment", "docker"} <= set(by_path["README.md"].signals)
    assert by_path["README.md"].proof_allowed is False
    assert by_path["README.md"].trust_level == "guidance_only"

    assert by_path["docs/architecture.md"].kind == "docs_page"
    assert "worker" in by_path["docs/architecture.md"].signals

    assert by_path["package.json"].kind == "manifest"
    assert by_path["package.json"].title == "demo-platform"
    assert by_path["package.json"].trust_level == "metadata_guidance"
    assert by_path["package.json"].proof_allowed is False


def test_orientation_inventory_does_not_treat_lying_readme_as_proof(tmp_path: Path) -> None:
    write(
        tmp_path / "README.md",
        "# Fake AI App\n\n"
        "This project has RAG, chat, frontend routes, and model providers.\n",
    )
    write(tmp_path / "src" / "signing.py", "def sign(value):\n    return value\n")
    app, run_id = analyzed_app(tmp_path)

    items = app.state.run_store.get_orientation_items(run_id)
    readme = next(item for item in items if item.path == "README.md")

    assert readme.proof_allowed is False
    assert readme.role == "orientation"
    assert readme.trust_level == "guidance_only"
    assert "chat" not in {symbol.name for symbol in app.state.run_store.get_symbols(run_id)}


def test_orientation_inventory_endpoint_returns_guidance_only_counts(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nHTTP client usage.\n")
    write(tmp_path / "pyproject.toml", '[project]\nname = "demo"\ndescription = "A client library"\n')
    app, run_id = analyzed_app(tmp_path)
    client = TestClient(app)

    response = client.get(f"/api/runs/{run_id}/orientation-inventory")

    assert response.status_code == 200
    body = response.json()
    assert body["analysis_run_id"] == run_id
    assert body["total"] == 2
    assert body["proof_allowed_count"] == 0
    assert all(item["proof_allowed"] is False for item in body["items"])
    assert {item["path"] for item in body["items"]} == {"README.md", "pyproject.toml"}


def test_run_orientation_summary_is_frontend_friendly(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nWebhook worker notes.\n")
    write(tmp_path / "src" / "app.py", "def main():\n    pass\n")
    app, run_id = analyzed_app(tmp_path)
    client = TestClient(app)

    response = client.get(f"/api/runs/{run_id}/orientation")

    assert response.status_code == 200
    body = response.json()
    assert body["analysis_run_id"] == run_id
    assert body["repository_name"] == tmp_path.name
    assert body["status"] == "ready"
    assert body["counts"]["orientation_items"] == 1
    assert body["suggested_reading"][0]["path"] == "README.md"
    assert "guidance-only" in body["suggested_reading"][0]["reason"]
    assert body["warnings"] == [
        "Orientation material is guidance-only and does not verify runtime behavior."
    ]


def analyzed_app(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    return app, response.json()["run_id"]


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

