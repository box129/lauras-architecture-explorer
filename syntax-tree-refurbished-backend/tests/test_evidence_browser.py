from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.evidence.evidence_browser import EvidenceBrowser
from syntax_tree_refurbished.config import Settings


def test_evidence_browser_searches_code_across_parsed_and_unparsed_files(tmp_path: Path) -> None:
    write(tmp_path / "src" / "handler.py", "def handle_webhook():\n    execute_workflow()\n")
    write(tmp_path / "workers" / "main.go", "func ExecuteWorkflow() {\n  println(\"workflow\")\n}\n")
    write(tmp_path / "docs" / "workflow.md", "# Workflow\n\nWebhook execution notes.\n")
    job = analyzed_job(tmp_path)

    hits = EvidenceBrowser(job).search_code(query="workflow", limit=10, context_lines=1)
    paths = {hit.region.path for hit in hits}

    assert "src/handler.py" in paths
    assert "workers/main.go" in paths
    assert "docs/workflow.md" in paths
    assert all(hit.region.start_line >= 1 for hit in hits)
    assert all(hit.region.end_line >= hit.region.start_line for hit in hits)


def test_evidence_browser_search_filters_by_role_and_language(tmp_path: Path) -> None:
    write(tmp_path / "src" / "billing.py", "def billing_sync():\n    pass\n")
    write(tmp_path / "docs" / "billing.md", "# Billing\n")
    job = analyzed_job(tmp_path)

    prod_hits = EvidenceBrowser(job).search_code(query="billing", role="production")
    doc_hits = EvidenceBrowser(job).search_code(query="billing", role="docs")
    python_hits = EvidenceBrowser(job).search_code(query="billing", language="python")

    assert {hit.region.path for hit in prod_hits} == {"src/billing.py"}
    assert {hit.region.path for hit in doc_hits} == {"docs/billing.md"}
    assert {hit.region.path for hit in python_hits} == {"src/billing.py"}


def test_evidence_browser_searches_files_by_path(tmp_path: Path) -> None:
    write(tmp_path / "src" / "webhook_handler.py", "")
    write(tmp_path / "docs" / "webhook.md", "")
    write(tmp_path / "src" / "other.py", "")
    job = analyzed_job(tmp_path)

    hits = EvidenceBrowser(job).search_files(query="webhook", limit=10)

    assert [hit.file.path for hit in hits] == ["src/webhook_handler.py", "docs/webhook.md"]
    assert all(hit.reason == "path_match" for hit in hits)


def test_evidence_browser_builds_markdown_and_code_outlines(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Intro\n\nText\n\n## Usage\n\nText\n")
    write(
        tmp_path / "src" / "service.py",
        "class BillingService:\n"
        "    def sync(self):\n"
        "        pass\n\n"
        "def standalone():\n"
        "    pass\n",
    )
    write(tmp_path / "workers" / "worker.go", "func HandleWebhook() {\n}\n")
    job = analyzed_job(tmp_path)
    browser = EvidenceBrowser(job)

    readme = browser.get_file_outline("README.md")
    service = browser.get_file_outline("src/service.py")
    worker = browser.get_file_outline("workers/worker.go")

    assert [item.label for item in readme] == ["Intro", "Usage"]
    assert readme[0].kind == "section"
    assert [item.label for item in service] == ["BillingService", "sync", "standalone"]
    assert [item.label for item in worker] == ["HandleWebhook"]


def test_evidence_browser_expands_region_within_file_boundaries(tmp_path: Path) -> None:
    write(tmp_path / "src" / "app.py", "".join(f"line {index}\n" for index in range(1, 11)))
    job = analyzed_job(tmp_path)
    browser = EvidenceBrowser(job)
    region = browser._reader.read_range("src/app.py", 5, 5)  # noqa: SLF001 - intentional white-box test for service behavior

    expanded = browser.expand_region(region=region, mode="both", lines=3)
    up = browser.expand_region(region=region, mode="up", lines=20)
    down = browser.expand_region(region=region, mode="down", lines=20)

    assert expanded.start_line == 2
    assert expanded.end_line == 8
    assert up.start_line == 1
    assert up.end_line == 5
    assert down.start_line == 5
    assert down.end_line == 10


def test_evidence_browser_api_search_outline_and_expand(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\n## Workflow\n")
    write(tmp_path / "src" / "app.py", "def start():\n    run_workflow()\n\ndef run_workflow():\n    pass\n")
    client = TestClient(create_app(Settings(environment="test")))
    run_id = client.post("/api/analyze", json={"repository_path": str(tmp_path)}).json()["run_id"]

    search = client.post(
        "/api/evidence/search-code",
        json={"run_id": run_id, "query": "run_workflow", "context_lines": 0},
    )
    assert search.status_code == 200
    search_body = search.json()
    assert search_body["total"] >= 1
    first_region = search_body["hits"][0]["region"]
    assert first_region["path"] == "src/app.py"

    expand = client.post(
        "/api/evidence/expand-region",
        json={"run_id": run_id, "region_id": first_region["id"], "mode": "both", "lines": 1},
    )
    assert expand.status_code == 200
    assert expand.json()["start_line"] <= first_region["start_line"]
    assert expand.json()["end_line"] >= first_region["end_line"]

    files = client.post("/api/evidence/search-files", json={"run_id": run_id, "query": "readme"})
    assert files.status_code == 200
    assert files.json()["hits"][0]["file"]["path"] == "README.md"

    outline = client.get(f"/api/source/file-outline?run_id={run_id}&path=README.md")
    assert outline.status_code == 200
    assert [item["label"] for item in outline.json()["items"]] == ["Demo", "Workflow"]


def test_expand_region_missing_region_returns_404(tmp_path: Path) -> None:
    write(tmp_path / "src" / "app.py", "print('hello')\n")
    client = TestClient(create_app(Settings(environment="test")))
    run_id = client.post("/api/analyze", json={"repository_path": str(tmp_path)}).json()["run_id"]

    response = client.post(
        "/api/evidence/expand-region",
        json={"run_id": run_id, "region_id": "region:missing", "mode": "both"},
    )

    assert response.status_code == 404


def analyzed_job(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    job = app.state.run_store.get_job(response.json()["job_id"])
    assert job is not None
    assert job.snapshot is not None
    return job


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

