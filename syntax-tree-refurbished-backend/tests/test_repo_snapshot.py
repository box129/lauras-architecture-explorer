from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.infra.filesystem.local_repo_reader import LocalRepoReader


def test_local_repo_reader_builds_truthful_snapshot(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nThis explains the repo.\n")
    write(tmp_path / "pyproject.toml", '[project]\nname = "demo-app"\n')
    write(tmp_path / "src" / "app.py", "def main():\n    return 1\n")
    write(tmp_path / "src" / "client.ts", "export function callApi() { return fetch('/api/demo') }\n")
    write(tmp_path / "docs" / "architecture.txt", "Architecture notes\n")
    write(tmp_path / "tests" / "test_app.py", "def test_main():\n    assert True\n")
    write(tmp_path / "node_modules" / "ignored.js", "throw new Error('ignored')\n")
    (tmp_path / "image.bin").write_bytes(b"\x00\x01\x02")
    write(tmp_path / "big.log", "x" * 80)

    snapshot = LocalRepoReader(
        Settings(environment="test", max_file_size_bytes=64, max_lines_per_file=100)
    ).build_snapshot(run_id="run:test", repo_path=str(tmp_path))

    paths = {file.path: file for file in snapshot.files}
    assert set(paths) == {
        "README.md",
        "big.log",
        "docs/architecture.txt",
        "image.bin",
        "pyproject.toml",
        "src/app.py",
        "src/client.ts",
        "tests/test_app.py",
    }
    assert "node_modules/ignored.js" not in paths

    assert paths["README.md"].role == "docs"
    assert paths["README.md"].language == "markdown"
    assert paths["README.md"].readable is True
    assert paths["docs/architecture.txt"].role == "docs"
    assert paths["src/app.py"].language == "python"
    assert paths["src/client.ts"].language == "typescript"
    assert paths["tests/test_app.py"].role == "test"
    assert paths["image.bin"].status == "skipped_binary"
    assert paths["big.log"].status == "skipped_too_large"

    assert snapshot.repo_name == tmp_path.name
    assert snapshot.file_count == 8
    assert snapshot.manifests[0].path == "pyproject.toml"
    assert snapshot.manifests[0].package_name == "demo-app"
    assert snapshot.package_boundaries[0].path == "."
    assert snapshot.parser_coverage.deeply_parsed_languages == (
        "javascript",
        "python",
        "typescript",
    )
    assert "markdown" in snapshot.parser_coverage.text_indexed_languages
    assert snapshot.parser_coverage.skipped_file_count == 2


def test_analyze_endpoint_creates_completed_snapshot(tmp_path: Path) -> None:
    write(tmp_path / "package.json", '{"name": "demo-web", "scripts": {"dev": "vite"}}')
    write(tmp_path / "src" / "index.ts", "export const value = 1\n")

    client = TestClient(create_app(Settings(environment="test")))

    analyze = client.post("/api/analyze", json={"repository_path": str(tmp_path)})
    assert analyze.status_code == 200
    analyze_body = analyze.json()
    assert analyze_body["status"] == "running"
    assert analyze_body["job_id"].startswith("job:")
    assert analyze_body["run_id"].startswith("run:")

    status = client.get(f"/api/analyze/{analyze_body['job_id']}/status")
    assert status.status_code == 200
    status_body = status.json()
    assert status_body["status"] == "completed"
    assert status_body["progress"]["can_render_frontend"] is True
    assert status_body["run_metadata"]["analysis_run_id"] == analyze_body["run_id"]

    snapshot = client.get(f"/api/runs/{analyze_body['run_id']}/snapshot")
    assert snapshot.status_code == 200
    snapshot_body = snapshot.json()
    assert snapshot_body["repo_name"] == tmp_path.name
    assert snapshot_body["file_count"] == 2
    assert {item["path"] for item in snapshot_body["files"]} == {"package.json", "src/index.ts"}
    assert snapshot_body["manifests"][0]["kind"] == "node_package"
    assert snapshot_body["package_boundaries"][0]["package_name"] == "demo-web"


def test_analyze_endpoint_records_failed_job_for_missing_repo() -> None:
    client = TestClient(create_app(Settings(environment="test")))

    analyze = client.post("/api/analyze", json={"repository_path": "Z:/definitely/missing/repo"})
    assert analyze.status_code == 200
    body = analyze.json()
    assert body["status"] == "running"

    status = client.get(f"/api/analyze/{body['job_id']}/status")
    assert status.status_code == 200
    assert status.json()["status"] == "failed"
    assert "does not exist" in status.json()["error"]


def test_snapshot_for_unknown_run_returns_404() -> None:
    client = TestClient(create_app(Settings(environment="test")))

    response = client.get("/api/runs/run:missing/snapshot")

    assert response.status_code == 404


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

