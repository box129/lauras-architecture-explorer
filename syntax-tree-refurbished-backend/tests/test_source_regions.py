from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.config import Settings


def test_source_reader_returns_exact_line_ranges_and_stable_ids(tmp_path: Path) -> None:
    write(tmp_path / "src" / "app.py", "one\n두\nthree\nfour\n")
    job = analyzed_job(tmp_path)

    reader = SourceReader(job)
    first = reader.read_range("src/app.py", 2, 3)
    second = reader.read_range("src/app.py", 2, 3)

    assert first.id == second.id
    assert first.path == "src/app.py"
    assert first.start_line == 2
    assert first.end_line == 3
    assert first.text == "두\nthree\n"
    assert first.region_type == "range"
    assert first.token_count > 0


def test_source_reader_reads_whole_file_under_budget(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nSmall file.\n")
    job = analyzed_job(tmp_path)

    region = SourceReader(job).read_whole_file("README.md", max_tokens=100)

    assert region.region_type == "whole_file"
    assert region.start_line == 1
    assert region.end_line == 3
    assert "Small file" in region.text


def test_source_reader_rejects_whole_file_over_budget(tmp_path: Path) -> None:
    write(tmp_path / "large.txt", "x" * 1000)
    job = analyzed_job(tmp_path)

    try:
        SourceReader(job).read_whole_file("large.txt", max_tokens=5)
    except SourceReadError as exc:
        assert "token budget" in str(exc)
    else:
        raise AssertionError("expected source read error")


def test_source_reader_rejects_path_traversal(tmp_path: Path) -> None:
    write(tmp_path / "safe.txt", "safe\n")
    job = analyzed_job(tmp_path)

    for unsafe in ("../safe.txt", "..\\safe.txt", str(tmp_path / "safe.txt")):
        try:
            SourceReader(job).read_range(unsafe, 1, 1)
        except SourceReadError:
            pass
        else:
            raise AssertionError(f"expected path traversal rejection for {unsafe}")


def test_source_api_lists_files_reads_content_and_regions(tmp_path: Path) -> None:
    write(tmp_path / "src" / "app.py", "alpha\nbeta\ngamma\n")
    write(tmp_path / "README.md", "# Demo\n")
    client = TestClient(create_app(Settings(environment="test")))
    run_id = client.post("/api/analyze", json={"repository_path": str(tmp_path)}).json()["run_id"]

    files = client.get(f"/api/source/files?run_id={run_id}")
    assert files.status_code == 200
    assert files.json()["total"] == 2
    assert {item["path"] for item in files.json()["files"]} == {"README.md", "src/app.py"}

    content = client.get(f"/api/source/files/src/app.py?run_id={run_id}")
    assert content.status_code == 200
    assert content.json()["content"] == "alpha\nbeta\ngamma\n"

    legacy_content = client.get(f"/api/files/src/app.py?run_id={run_id}")
    assert legacy_content.status_code == 200
    assert legacy_content.json()["file_path"] == "src/app.py"

    region = client.post(
        "/api/evidence/read-range",
        json={"run_id": run_id, "path": "src/app.py", "start_line": 2, "end_line": 3},
    )
    assert region.status_code == 200
    region_body = region.json()
    assert region_body["text"] == "beta\ngamma\n"
    assert region_body["start_line"] == 2
    assert region_body["end_line"] == 3

    lookup = client.get(f"/api/source-regions/{region_body['id']}")
    assert lookup.status_code == 200
    assert lookup.json()["id"] == region_body["id"]


def test_source_api_returns_503_without_active_run() -> None:
    client = TestClient(create_app(Settings(environment="test")))

    response = client.get("/api/source/files")

    assert response.status_code == 503


def test_source_api_rejects_unreadable_file(tmp_path: Path) -> None:
    (tmp_path / "binary.bin").write_bytes(b"\x00\x01\x02")
    client = TestClient(create_app(Settings(environment="test")))
    run_id = client.post("/api/analyze", json={"repository_path": str(tmp_path)}).json()["run_id"]

    response = client.get(f"/api/source/files/binary.bin?run_id={run_id}")

    assert response.status_code == 404
    assert "not readable" in response.json()["detail"]


def analyzed_job(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    job_id = response.json()["job_id"]
    job = app.state.run_store.get_job(job_id)
    assert job is not None
    assert job.snapshot is not None
    return job


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

