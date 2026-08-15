from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings


def test_full_stack_fixture_exposes_behavioral_anchors(tmp_path: Path) -> None:
    write(
        tmp_path / "backend" / "app" / "routes.py",
        "@router.post('/api/auth/login')\n"
        "def login():\n"
        "    return {'ok': True}\n\n"
        "routes['POST /api/orders'] = create_order\n"
        "def create_order():\n"
        "    return {'id': 1}\n",
    )
    write(
        tmp_path / "frontend" / "src" / "routes" / "+page.svelte",
        "<script>export let data;</script>\n<h1>Login</h1>\n",
    )
    write(
        tmp_path / "backend" / "app" / "models.py",
        "class User(Base):\n"
        "    __tablename__ = 'users'\n",
    )
    write(tmp_path / "Dockerfile", "FROM python:3.12\n")

    app, run_id = analyzed_app(tmp_path)
    anchors = app.state.run_store.get_anchors(run_id)
    kinds = {anchor.kind for anchor in anchors}
    labels = {anchor.label for anchor in anchors}

    assert "http_route" in kinds
    assert "frontend_screen" in kinds
    assert "auth_boundary" in kinds
    assert "db_schema" in kinds
    assert "deployment_unit" in kinds
    assert "POST /api/orders" in labels
    assert all(anchor.source_region_id for anchor in anchors)


def test_httpx_style_library_exposes_public_exports_not_web_app_anchors(tmp_path: Path) -> None:
    write(tmp_path / "httpx" / "__init__.py", "from ._api import get\nfrom ._client import Client\n")
    write(tmp_path / "httpx" / "_api.py", "def get(url):\n    return request('GET', url)\n")
    write(tmp_path / "httpx" / "_client.py", "class Client:\n    def send(self, request):\n        return None\n")
    write(tmp_path / "httpx" / "_transports" / "default.py", "class HTTPTransport:\n    pass\n")

    app, run_id = analyzed_app(tmp_path)
    anchors = app.state.run_store.get_anchors(run_id)
    kinds = {anchor.kind for anchor in anchors}

    assert "public_export" in kinds
    assert "http_route" not in kinds
    assert "frontend_screen" not in kinds
    assert "deployment_unit" not in kinds


def test_itsdangerous_style_library_exposes_signing_serialization_surface(tmp_path: Path) -> None:
    write(tmp_path / "itsdangerous" / "__init__.py", "from .signer import Signer\nfrom .serializer import Serializer\n")
    write(tmp_path / "itsdangerous" / "signer.py", "class Signer:\n    def sign(self, value):\n        return value\n")
    write(tmp_path / "itsdangerous" / "serializer.py", "class Serializer:\n    def dumps(self, obj):\n        return obj\n")

    app, run_id = analyzed_app(tmp_path)
    anchors = app.state.run_store.get_anchors(run_id)

    assert any(anchor.kind == "public_export" and "Signer" in anchor.label for anchor in anchors)
    assert not any(anchor.kind in {"http_route", "frontend_screen"} for anchor in anchors)


def test_cli_queue_cron_external_api_and_plugin_registry_are_detected(tmp_path: Path) -> None:
    write(
        tmp_path / "src" / "cli.py",
        "import argparse\n\n"
        "parser = argparse.ArgumentParser()\n"
        "if __name__ == '__main__':\n"
        "    parser.parse_args()\n",
    )
    write(
        tmp_path / "src" / "workers" / "consumer.py",
        "@shared_task\n"
        "def consume_order():\n"
        "    queue.publish('done')\n",
    )
    write(tmp_path / "src" / "scheduler.py", "schedule.every().day.do(lambda: None)\n")
    write(tmp_path / "src" / "integrations.py", "def call():\n    return requests.get('https://api.example.com')\n")
    write(tmp_path / "src" / "plugins" / "registry.py", "def register_plugin(plugin):\n    registry.append(plugin)\n")

    app, run_id = analyzed_app(tmp_path)
    kinds = {anchor.kind for anchor in app.state.run_store.get_anchors(run_id)}

    assert {"cli_command", "worker", "cron_job", "queue_boundary", "external_api_client", "plugin_registry"} <= kinds


def test_anchors_endpoint_returns_counts_and_regions_resolve(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "@app.get('/health')\ndef health():\n    return {'ok': True}\n")
    app, run_id = analyzed_app(tmp_path)
    client = TestClient(app)

    response = client.get(f"/api/runs/{run_id}/anchors")

    assert response.status_code == 200
    body = response.json()
    assert body["analysis_run_id"] == run_id
    assert body["total"] >= 1
    assert body["by_kind"] == [{"kind": "http_route", "count": 1}]
    route = body["anchors"][0]
    assert route["kind"] == "http_route"
    assert route["extraction_method"] == "python_route_decorator"
    region_response = client.get(f"/api/source-regions/{route['source_region_id']}")
    assert region_response.status_code == 200
    assert "@app.get('/health')" in region_response.json()["text"]


def analyzed_app(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    return app, response.json()["run_id"]


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

