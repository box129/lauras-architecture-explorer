from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.config import Settings


def test_valid_source_region_citation_verifies_claim(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    region = client.post(
        "/api/evidence/read-range",
        json={"run_id": run_id, "path": "app.py", "start_line": 1, "end_line": 2},
    ).json()

    response = validate(
        client,
        run_id,
        [
            {
                "id": "c1",
                "text": "The repo has a health function.",
                "requested_status": "verified",
                "citations": [{"kind": "source_region", "ref_id": region["id"]}],
            }
        ],
    )

    assert response["verified_count"] == 1
    assert response["claims"][0]["support_status"] == "verified"
    assert response["claims"][0]["citations"][0]["resolved_region_id"] == region["id"]


def test_nonexistent_file_range_fails_grounding(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    response = validate(
        client,
        run_id,
        [
            {
                "id": "c1",
                "text": "Fake code exists.",
                "requested_status": "verified",
                "citations": [
                    {"kind": "file_range", "path": "missing.py", "start_line": 1, "end_line": 2}
                ],
            }
        ],
    )

    assert response["verified_count"] == 0
    assert response["failure_count"] == 1
    assert response["claims"][0]["support_status"] == "unsupported"
    assert "File not found" in response["claims"][0]["failures"][0]


def test_line_range_outside_file_fails_grounding(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    response = validate(
        client,
        run_id,
        [
            {
                "id": "c1",
                "text": "Health is on line 100.",
                "requested_status": "verified",
                "citations": [
                    {"kind": "file_range", "path": "app.py", "start_line": 100, "end_line": 101}
                ],
            }
        ],
    )

    assert response["claims"][0]["support_status"] == "unsupported"
    assert "beyond end of file" in response["claims"][0]["failures"][0]


def test_citation_to_uninspected_region_id_fails(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    response = validate(
        client,
        run_id,
        [
            {
                "id": "c1",
                "text": "This cites a made-up region.",
                "requested_status": "verified",
                "citations": [{"kind": "source_region", "ref_id": "region:not-real"}],
            }
        ],
    )

    assert response["claims"][0]["support_status"] == "unsupported"
    assert "not inspected" in response["claims"][0]["failures"][0]


def test_content_hash_mismatch_downgrades_grounding(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    _, run_id, client = analyzed_app(tmp_path)

    response = validate(
        client,
        run_id,
        [
            {
                "id": "c1",
                "text": "The app has a health function.",
                "requested_status": "verified",
                "citations": [
                    {
                        "kind": "file_range",
                        "path": "app.py",
                        "start_line": 1,
                        "end_line": 2,
                        "content_hash": "wrong-hash",
                    }
                ],
            }
        ],
    )

    assert response["claims"][0]["support_status"] == "unsupported"
    assert "content hash" in response["claims"][0]["failures"][0]


def test_orientation_item_cannot_verify_runtime_behavior(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nThis README says the app has RAG and chat.\n")
    write(tmp_path / "app.py", "def health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    orientation = app.state.run_store.get_orientation_items(run_id)[0]

    response = validate(
        client,
        run_id,
        [
            {
                "id": "c1",
                "text": "The app has RAG and chat.",
                "requested_status": "verified",
                "citations": [{"kind": "orientation_item", "ref_id": orientation.id}],
            }
        ],
    )

    assert response["verified_count"] == 0
    assert response["downgraded_count"] == 1
    assert response["claims"][0]["support_status"] == "orientation_only"
    assert "guidance-only" in response["claims"][0]["citations"][0]["reason"]


def test_semantic_anchor_and_parsed_symbol_citations_verify_claims(tmp_path: Path) -> None:
    write(tmp_path / "app.py", "@app.get('/health')\ndef health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    anchor = next(anchor for anchor in app.state.run_store.get_anchors(run_id) if anchor.kind == "http_route")
    symbol = next(symbol for symbol in app.state.run_store.get_symbols(run_id) if symbol.name == "health")

    response = validate(
        client,
        run_id,
        [
            {
                "id": "c1",
                "text": "The app exposes a health route.",
                "requested_status": "verified",
                "citations": [{"kind": "semantic_anchor", "ref_id": anchor.id}],
            },
            {
                "id": "c2",
                "text": "The health function is parsed.",
                "requested_status": "verified",
                "citations": [{"kind": "parsed_symbol", "ref_id": symbol.id}],
            },
        ],
    )

    assert response["verified_count"] == 2
    assert all(claim["support_status"] == "verified" for claim in response["claims"])
    assert all(claim["citations"][0]["resolved_region_id"] for claim in response["claims"])


def test_fake_llm_response_only_keeps_real_source_claim_verified(tmp_path: Path) -> None:
    write(tmp_path / "README.md", "# Demo\n\nClaims a billing webhook exists.\n")
    write(tmp_path / "app.py", "@app.get('/health')\ndef health():\n    return {'ok': True}\n")
    app, run_id, client = analyzed_app(tmp_path)
    region = client.post(
        "/api/evidence/read-range",
        json={"run_id": run_id, "path": "app.py", "start_line": 1, "end_line": 2},
    ).json()
    orientation = app.state.run_store.get_orientation_items(run_id)[0]

    response = validate(
        client,
        run_id,
        [
            {
                "id": "real",
                "text": "The app exposes a health route.",
                "requested_status": "verified",
                "citations": [{"kind": "source_region", "ref_id": region["id"]}],
            },
            {
                "id": "fake-file",
                "text": "The app has a billing route.",
                "requested_status": "verified",
                "citations": [
                    {"kind": "file_range", "path": "billing.py", "start_line": 1, "end_line": 2}
                ],
            },
            {
                "id": "bad-line",
                "text": "The route appears later in app.py.",
                "requested_status": "verified",
                "citations": [
                    {"kind": "file_range", "path": "app.py", "start_line": 50, "end_line": 60}
                ],
            },
            {
                "id": "docs-only",
                "text": "The app has a billing webhook.",
                "requested_status": "verified",
                "citations": [{"kind": "orientation_item", "ref_id": orientation.id}],
            },
        ],
    )

    statuses = {claim["claim"]["id"]: claim["support_status"] for claim in response["claims"]}
    assert statuses == {
        "real": "verified",
        "fake-file": "unsupported",
        "bad-line": "unsupported",
        "docs-only": "orientation_only",
    }
    assert response["verified_count"] == 1
    assert response["downgraded_count"] == 3


def validate(client: TestClient, run_id: str, claims: list[dict]) -> dict:
    response = client.post("/api/grounding/validate", json={"run_id": run_id, "claims": claims})
    assert response.status_code == 200
    return response.json()


def analyzed_app(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    return app, response.json()["run_id"], client


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

