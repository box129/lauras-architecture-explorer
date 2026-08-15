import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings


def _client() -> TestClient:
    return TestClient(create_app(Settings(environment="test", database_path=":memory:")))


def test_browse_with_no_path_returns_starting_roots() -> None:
    response = _client().get("/api/fs/browse-directories")

    assert response.status_code == 200
    body = response.json()
    assert body["path"] is None
    assert body["parent"] is None
    assert isinstance(body["directories"], list)
    assert len(body["directories"]) > 0
    for entry in body["directories"]:
        assert "name" in entry and "path" in entry


def test_browse_lists_only_subdirectories_of_a_real_path() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "child_dir").mkdir()
        (root / "sibling_file.txt").write_text("not a directory")
        (root / ".hidden_dir").mkdir()

        response = _client().get("/api/fs/browse-directories", params={"path": str(root)})

        assert response.status_code == 200
        body = response.json()
        assert body["path"] == str(root.resolve())
        names = [entry["name"] for entry in body["directories"]]
        assert "child_dir" in names
        assert "sibling_file.txt" not in names
        assert ".hidden_dir" not in names


def test_browse_never_exposes_file_contents() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "secret.txt").write_text("super secret content")

        response = _client().get("/api/fs/browse-directories", params={"path": str(root)})

        assert response.status_code == 200
        assert "super secret content" not in response.text


def test_browse_rejects_relative_path() -> None:
    response = _client().get("/api/fs/browse-directories", params={"path": "relative/path"})

    assert response.status_code == 400


def test_browse_reports_missing_path_honestly() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        missing = Path(tmp) / "does-not-exist"
        response = _client().get("/api/fs/browse-directories", params={"path": str(missing)})

    assert response.status_code == 404


def test_browse_rejects_a_file_path_as_not_a_directory() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        file_path = Path(tmp) / "file.txt"
        file_path.write_text("x")

        response = _client().get("/api/fs/browse-directories", params={"path": str(file_path)})

        assert response.status_code == 400
