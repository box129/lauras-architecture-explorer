from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.evidence.evidence_browser import EvidenceBrowser
from syntax_tree_refurbished.config import Settings


def test_python_ast_symbols_are_indexed_with_exact_regions(tmp_path: Path) -> None:
    write(
        tmp_path / "src" / "service.py",
        "class BillingService:\n"
        "    async def sync(self, account_id):\n"
        "        return account_id\n\n"
        "def run_job():\n"
        "    return BillingService()\n",
    )
    app, run_id = analyzed_app(tmp_path)

    symbols = app.state.run_store.get_symbols(run_id)
    names = {symbol.name: symbol for symbol in symbols}

    assert {"BillingService", "sync", "run_job"} <= set(names)
    assert names["BillingService"].kind == "class"
    assert names["sync"].kind == "method"
    assert names["sync"].async_ is True
    assert names["run_job"].exported is True
    assert names["BillingService"].start_line == 1
    assert names["BillingService"].end_line == 3
    assert names["BillingService"].source_region_id.startswith("region:")


def test_js_ts_symbols_are_indexed(tmp_path: Path) -> None:
    write(
        tmp_path / "src" / "client.ts",
        "export interface User {\n"
        "  id: string\n"
        "}\n\n"
        "export class ApiClient {\n"
        "  async login(email: string) {\n"
        "    return email\n"
        "  }\n"
        "}\n\n"
        "export const registerUser = async (name: string) => {\n"
        "  return name\n"
        "}\n\n"
        "function helper() {\n"
        "  return true\n"
        "}\n",
    )
    app, run_id = analyzed_app(tmp_path)

    symbols = app.state.run_store.get_symbols(run_id)
    by_name = {symbol.name: symbol for symbol in symbols}

    assert by_name["User"].kind == "interface"
    assert by_name["ApiClient"].kind == "class"
    assert by_name["registerUser"].kind == "function"
    assert by_name["registerUser"].async_ is True
    assert by_name["helper"].exported is False


def test_outline_prefers_parsed_symbols_over_fallback(tmp_path: Path) -> None:
    write(tmp_path / "src" / "service.py", "class A:\n    def b(self):\n        pass\n")
    app, run_id = analyzed_app(tmp_path)
    job = app.state.run_store.get_run(run_id)

    outline = EvidenceBrowser(job, app.state.run_store).get_file_outline("src/service.py")

    assert [(item.label, item.kind, item.confidence) for item in outline] == [
        ("A", "class", 0.9),
        ("b", "method", 0.9),
    ]


def test_unsupported_language_keeps_fallback_outline_and_raw_reading(tmp_path: Path) -> None:
    write(tmp_path / "workers" / "main.go", "func HandleWebhook() {\n  println(\"ok\")\n}\n")
    app, run_id = analyzed_app(tmp_path)
    job = app.state.run_store.get_run(run_id)

    symbols = app.state.run_store.get_symbols_for_file(run_id, "workers/main.go")
    outline = EvidenceBrowser(job, app.state.run_store).get_file_outline("workers/main.go")
    content = client_for(app).get(f"/api/source/files/workers/main.go?run_id={run_id}")

    assert symbols == ()
    assert [item.label for item in outline] == ["HandleWebhook"]
    assert content.status_code == 200
    assert "HandleWebhook" in content.json()["content"]


def test_parser_failure_does_not_block_raw_reading_or_fallback_outline(tmp_path: Path) -> None:
    write(tmp_path / "broken.py", "def broken(\n")
    app, run_id = analyzed_app(tmp_path)
    job = app.state.run_store.get_run(run_id)

    assert app.state.run_store.get_symbols_for_file(run_id, "broken.py") == ()
    content = client_for(app).get(f"/api/source/files/broken.py?run_id={run_id}")
    outline = EvidenceBrowser(job, app.state.run_store).get_file_outline("broken.py")

    assert content.status_code == 200
    assert "def broken(" in content.json()["content"]
    assert outline[0].label == "broken"
    assert outline[0].confidence == 0.55


def test_find_definition_and_reference_routes(tmp_path: Path) -> None:
    write(
        tmp_path / "src" / "service.py",
        "class BillingService:\n"
        "    pass\n\n"
        "def make_service():\n"
        "    return BillingService()\n",
    )
    app, run_id = analyzed_app(tmp_path)
    client = client_for(app)

    definition = client.post(
        "/api/evidence/find-definition",
        json={"run_id": run_id, "query": "BillingService"},
    )
    assert definition.status_code == 200
    definition_body = definition.json()
    assert definition_body["total"] >= 1
    assert definition_body["hits"][0]["symbol"]["name"] == "BillingService"
    assert definition_body["hits"][0]["method"] == "parsed_symbol"
    assert definition_body["hits"][0]["region"]["start_line"] == 1

    references = client.post(
        "/api/evidence/find-references",
        json={"run_id": run_id, "query": "BillingService"},
    )
    assert references.status_code == 200
    refs = references.json()["hits"]
    assert refs
    assert {hit["method"] for hit in refs} == {"text_search_fallback"}
    assert any(4 in hit["matched_lines"] or 5 in hit["matched_lines"] for hit in refs)


def test_symbols_routes_return_file_and_run_symbols(tmp_path: Path) -> None:
    write(tmp_path / "src" / "app.py", "def main():\n    pass\n")
    app, run_id = analyzed_app(tmp_path)
    client = client_for(app)

    run_symbols = client.get(f"/api/runs/{run_id}/symbols")
    file_symbols = client.get(f"/api/source/files/src/app.py/symbols?run_id={run_id}")

    assert run_symbols.status_code == 200
    assert file_symbols.status_code == 200
    assert run_symbols.json()["symbols"][0]["name"] == "main"
    assert file_symbols.json()["symbols"][0]["name"] == "main"


def analyzed_app(repo: Path):
    app = create_app(Settings(environment="test"))
    response = client_for(app).post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    return app, response.json()["run_id"]


def client_for(app):
    return TestClient(app)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

