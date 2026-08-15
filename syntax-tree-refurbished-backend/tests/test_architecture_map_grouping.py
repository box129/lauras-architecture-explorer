"""Phase B / Phase C1: deterministic grouped, nested Overview.

See docs/design-proposals/architecture-navigation/IMPLEMENTATION_PLAN.md
(Phase B) and docs/design-proposals/semantic-architecture-overview/
IMPLEMENTATION_PLAN.md (Phase C1), plus
app.architecture_map.structural_fallback.build_containment_hierarchy's own
docstring, for the accepted design. This suite proves the grouping/nesting
rule itself (via ArchitectureMapProjector, directly and through the real
HTTP routes) without touching parser/claim/verifier semantics -- every
fixture here uses NoConfiguredModel (the deployed default), so
main_components always comes from the deterministic
app.analysis.static_structure.build_static_structure path.
"""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.architecture_map import structural_fallback
from syntax_tree_refurbished.config import Settings
from syntax_tree_refurbished.core.models.system_overview import OverviewComponent


def analyzed_app(repo: Path):
    app = create_app(Settings(environment="test"))
    client = TestClient(app)
    response = client.post("/api/analyze", json={"repository_path": str(repo)})
    assert response.status_code == 200
    return app, response.json()["run_id"], client


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _component(component_id: str, path: str) -> OverviewComponent:
    return OverviewComponent(
        id=component_id,
        label=path,
        kind="module",
        summary="",
        responsibilities=(),
        source_region_ids=(),
        anchor_ids=(),
        related_file_paths=(path,),
        support_status="verified",
        confidence=0.98,
    )


# ---------------------------------------------------------------------------
# 1. Deterministic grouping is stable.
# ---------------------------------------------------------------------------


def test_grouping_is_deterministic_across_repeated_calls() -> None:
    components = (
        _component("module:1", "routes/api.py"),
        _component("module:2", "routes/health.py"),
        _component("module:3", "models/user.py"),
        _component("module:4", "main.py"),
    )
    first = structural_fallback.build_containment_hierarchy("run-1", components)
    second = structural_fallback.build_containment_hierarchy("run-1", components)
    assert first is not None and second is not None
    assert first.top_level == second.top_level
    assert [group.id for group in first.all_nodes] == [group.id for group in second.all_nodes]
    # Same input on a different run_id must still produce distinct ids --
    # ids are stable *within* a run, never globally reused across runs.
    third = structural_fallback.build_containment_hierarchy("run-2", components)
    assert third is not None
    assert {g.id for g in first.all_nodes}.isdisjoint({g.id for g in third.all_nodes})


# ---------------------------------------------------------------------------
# 2. Group membership matches actual repository structure.
# ---------------------------------------------------------------------------


def test_group_membership_matches_real_repository_structure(tmp_path: Path) -> None:
    write(tmp_path / "routes" / "api.py", "def handler():\n    return 1\n")
    write(tmp_path / "routes" / "health.py", "def health():\n    return 1\n")
    write(tmp_path / "models" / "user.py", "class User:\n    pass\n")
    write(tmp_path / "main.py", "def main():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    groups = [node for node in body["nodes"] if node["kind"] == "structural_group"]
    assert {g["label"] for g in groups} == {"routes", "models", "Repository root files"}

    routes_group = next(g for g in groups if g["label"] == "routes")
    children = client.get(f"/api/architecture-map/nodes/{routes_group['id']}/children?run_id={run_id}").json()
    member_labels = {c["label"] for c in children["children"]}
    assert member_labels == {"routes/api.py", "routes/health.py"}
    assert routes_group["children_count"] == 2


# ---------------------------------------------------------------------------
# 3. Nested-directory handling is correct.
# ---------------------------------------------------------------------------


def test_nested_directories_group_by_full_immediate_path(tmp_path: Path) -> None:
    write(tmp_path / "app" / "routes" / "api.py", "def handler():\n    return 1\n")
    write(tmp_path / "app" / "routes" / "health.py", "def health():\n    return 1\n")
    write(tmp_path / "app" / "models.py", "class Model:\n    pass\n")
    write(tmp_path / "main.py", "def main():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    groups = {node["label"]: node for node in body["nodes"] if node["kind"] == "structural_group"}
    # Phase C1: "app" has real branching (a direct file "models.py" AND a
    # subdirectory "routes/"), so it becomes a real CONTAINER -- its own
    # recursive children_count covers everything nested under it, and
    # "app/routes" (2 files) plus "app (direct files)" (models.py) are its
    # real, separately-addressable children, not flat siblings.
    assert "app" in groups
    assert "app/routes" in groups
    assert "app (direct files)" in groups
    assert groups["app"]["children_count"] == 3  # recursive: routes' 2 + models.py
    assert groups["app/routes"]["children_count"] == 2
    assert groups["app (direct files)"]["children_count"] == 1
    # Real containment, not just naming coincidence: app/routes and
    # app (direct files) both point back at "app" as their real parent.
    assert groups["app/routes"]["parent_group_id"] == groups["app"]["id"]
    assert groups["app (direct files)"]["parent_group_id"] == groups["app"]["id"]
    assert groups["app"]["parent_group_id"] is None  # top-level
    # Depth increases by exactly one per real nesting level.
    assert groups["app/routes"]["level"] == groups["app"]["level"] + 1

    # "app" is a container: entering it returns its real sub-groups, never
    # raw file components directly.
    app_children = client.get(f"/api/architecture-map/nodes/{groups['app']['id']}/children?run_id={run_id}").json()
    assert {c["label"] for c in app_children["children"]} == {"app/routes", "app (direct files)"}
    assert all(c["kind"] == "structural_group" for c in app_children["children"])

    # "app/routes" is a leaf: entering it returns real file components.
    routes_children = client.get(
        f"/api/architecture-map/nodes/{groups['app/routes']['id']}/children?run_id={run_id}"
    ).json()
    assert {c["label"] for c in routes_children["children"]} == {"app/routes/api.py", "app/routes/health.py"}


# ---------------------------------------------------------------------------
# 4. Root-file handling is correct.
# ---------------------------------------------------------------------------


def test_root_level_files_form_their_own_honest_bucket(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "a.py", "class A:\n    pass\n")
    write(tmp_path / "main.py", "def main():\n    return 1\n")
    write(tmp_path / "setup.py", "print('setup')\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    root_group = next(node for node in body["nodes"] if node["label"] == "Repository root files")
    assert root_group["kind"] == "structural_group"
    assert root_group["children_count"] == 2
    children = client.get(f"/api/architecture-map/nodes/{root_group['id']}/children?run_id={run_id}").json()
    assert {c["label"] for c in children["children"]} == {"main.py", "setup.py"}


# ---------------------------------------------------------------------------
# 5. Flat repositories degrade gracefully (no fake single group).
# ---------------------------------------------------------------------------


def test_all_files_at_root_degrades_to_ungrouped_overview(tmp_path: Path) -> None:
    write(tmp_path / "a.py", "def a():\n    return 1\n")
    write(tmp_path / "b.py", "def b():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    non_root = [node for node in body["nodes"] if node["id"] != body["root"]["id"]]
    kinds = {node["kind"] for node in non_root}
    assert "structural_group" not in kinds
    assert {node["label"] for node in non_root} == {"a.py", "b.py"}


def test_single_directory_repository_degrades_to_ungrouped_overview(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "a.py", "class A:\n    pass\n")
    write(tmp_path / "pkg" / "b.py", "class B:\n    pass\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    non_root = [node for node in body["nodes"] if node["id"] != body["root"]["id"]]
    kinds = {node["kind"] for node in non_root}
    assert "structural_group" not in kinds
    assert {node["label"] for node in non_root} == {"pkg/a.py", "pkg/b.py"}


def test_build_containment_hierarchy_pure_function_flat_cases() -> None:
    single_directory = (_component("m:1", "pkg/a.py"), _component("m:2", "pkg/b.py"))
    assert structural_fallback.build_containment_hierarchy("run", single_directory) is None

    all_root = (_component("m:1", "a.py"), _component("m:2", "b.py"))
    assert structural_fallback.build_containment_hierarchy("run", all_root) is None

    empty: tuple[OverviewComponent, ...] = ()
    assert structural_fallback.build_containment_hierarchy("run", empty) is None


def test_single_child_chain_compresses_into_one_labeled_container(tmp_path: Path) -> None:
    """A directory that contains nothing but one subdirectory, which
    itself branches, must not render as two nested boxes where the outer
    one contains nothing but the inner one -- it compresses into ONE
    honestly, fully-labeled node ("backend/src"), matching the concrete
    topic-similarity-mvp shape found in the post-P2 diagnosis."""
    write(tmp_path / "backend" / "src" / "controllers" / "a.py", "def a():\n    return 1\n")
    write(tmp_path / "backend" / "src" / "services" / "b.py", "def b():\n    return 1\n")
    write(tmp_path / "frontend" / "app.js", "console.log(1);\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    groups = {node["label"]: node for node in body["nodes"] if node["kind"] == "structural_group"}
    assert "backend/src" in groups
    assert "backend" not in groups  # compressed away, never shown as a pointless wrapper
    assert groups["backend/src"]["parent_group_id"] is None  # top-level after compression
    assert "backend/src/controllers" in groups
    assert "backend/src/services" in groups
    assert groups["backend/src/controllers"]["parent_group_id"] == groups["backend/src"]["id"]


# ---------------------------------------------------------------------------
# 6. No semantic/LLM category naming occurs.
# ---------------------------------------------------------------------------


def test_group_labels_are_literal_path_fragments_never_synthesized_names(tmp_path: Path) -> None:
    write(tmp_path / "auth" / "client.py", "class Client:\n    pass\n")
    write(tmp_path / "transport" / "adapter.py", "class Adapter:\n    pass\n")
    write(tmp_path / "config.py", "TIMEOUT = 30\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    groups = [node for node in body["nodes"] if node["kind"] == "structural_group"]
    labels = {g["label"] for g in groups}
    # Real directory paths only -- never the kind of invented, keyword-
    # matched category name _architecture_label()/_child_label() would
    # produce for filenames like these (e.g. "Auth And Cookies",
    # "Transport Layer", "Configuration And Timeouts").
    assert labels == {"auth", "transport", "Repository root files"}
    banned = {"Auth And Cookies", "Transport Layer", "Configuration And Timeouts", "Client Lifecycle"}
    assert labels.isdisjoint(banned)
    for group in groups:
        assert group["confidence"] is None  # no fabricated group confidence


# ---------------------------------------------------------------------------
# 7. Group counts are exact.
# ---------------------------------------------------------------------------


def test_group_counts_are_exact_direct_member_counts(tmp_path: Path) -> None:
    for name in ("one", "two", "three", "four", "five", "six"):
        write(tmp_path / "pkg" / f"{name}.py", f"def {name}():\n    return 1\n")
    write(tmp_path / "main.py", "def main():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    pkg_group = next(node for node in body["nodes"] if node["label"] == "pkg")
    assert pkg_group["children_count"] == 6
    # Representative members are capped for display, but the count is not.
    assert len(pkg_group["primary_files"]) <= 5
    children = client.get(f"/api/architecture-map/nodes/{pkg_group['id']}/children?run_id={run_id}").json()
    assert children["total"] == 6


# ---------------------------------------------------------------------------
# 8. Unknown group ids return appropriate failure.
# ---------------------------------------------------------------------------


def test_unknown_group_id_returns_404(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "a.py", "class A:\n    pass\n")
    write(tmp_path / "main.py", "def main():\n    return 1\n")
    _, run_id, client = analyzed_app(tmp_path)

    response = client.get(f"/api/architecture-map/nodes/structural-group:doesnotexist/children?run_id={run_id}")

    assert response.status_code == 404


def test_hierarchy_lookups_return_none_for_unknown_id() -> None:
    components = (_component("m:1", "pkg/a.py"), _component("m:2", "main.py"))
    hierarchy = structural_fallback.build_containment_hierarchy("run", components)
    assert hierarchy is not None
    assert hierarchy.leaf_members_by_id.get("structural-group:doesnotexist") is None
    assert hierarchy.children_by_id.get("structural-group:doesnotexist") is None


# ---------------------------------------------------------------------------
# 9. Unresolved relations are not upgraded through any optional
#    aggregation -- Phase B's chosen edge strategy is NONE (no
#    group-to-group edges); only root->group containment is drawn.
# ---------------------------------------------------------------------------


def test_no_group_to_group_edges_are_ever_invented(tmp_path: Path) -> None:
    write(tmp_path / "pkg_a" / "a.py", "from pkg_b.b import thing\n\n\ndef use():\n    return thing()\n")
    write(tmp_path / "pkg_b" / "b.py", "def thing():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    group_ids = {node["id"] for node in body["nodes"] if node["kind"] == "structural_group"}
    root_id = body["root"]["id"]
    assert group_ids  # grouping activated for this fixture
    for edge in body["edges"]:
        if edge["target"] in group_ids:
            # Only the root may point at a group; a group may never be the
            # source or target of an edge whose other end is also a group.
            assert edge["source"] == root_id
        assert not (edge["source"] in group_ids and edge["target"] in group_ids)


# ---------------------------------------------------------------------------
# 10. Existing architecture-map routes continue to work for a grouped
#     Overview: direct node lookup, children, evidence, explanation, and
#     implementation all still resolve for both a group and a real member
#     reached through it.
# ---------------------------------------------------------------------------


def test_existing_routes_still_work_through_a_group(tmp_path: Path) -> None:
    write(tmp_path / "pkg" / "a.py", "class A:\n    def m(self):\n        return 1\n")
    write(tmp_path / "main.py", "def main():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    group = next(node for node in body["nodes"] if node["label"] == "pkg")

    assert client.get(f"/api/architecture-map/nodes/{group['id']}?run_id={run_id}").status_code == 200
    assert client.get(f"/api/architecture-map/nodes/{group['id']}/evidence?run_id={run_id}").status_code == 200
    assert client.get(f"/api/architecture-map/nodes/{group['id']}/explanation?run_id={run_id}").status_code == 200
    assert client.get(f"/api/architecture-map/nodes/{group['id']}/implementation?run_id={run_id}").status_code == 200

    children = client.get(f"/api/architecture-map/nodes/{group['id']}/children?run_id={run_id}").json()
    member = next(c for c in children["children"] if c["label"] == "pkg/a.py")
    assert member["level"] == 2

    # The member reached through the group is the SAME real component id
    # (not a synthetic per-group copy) -- its own detail/evidence/
    # explanation/implementation routes must keep working unmodified.
    assert client.get(f"/api/architecture-map/nodes/{member['id']}?run_id={run_id}").status_code == 200
    assert client.get(f"/api/architecture-map/nodes/{member['id']}/evidence?run_id={run_id}").status_code == 200
    assert client.get(f"/api/architecture-map/nodes/{member['id']}/explanation?run_id={run_id}").status_code == 200
    module_children = client.get(f"/api/architecture-map/nodes/{member['id']}/children?run_id={run_id}").json()
    assert any(c["label"] == "A" for c in module_children["children"])


def test_llm_classified_overview_is_never_regrouped(tmp_path: Path) -> None:
    """A live/scripted-investigation Overview (kind="component", not
    "module") must never be run through the directory-grouping rule --
    grouping is exclusively for the deterministic, file-shaped
    NoConfiguredModel default."""
    from dataclasses import dataclass
    from typing import Any

    from syntax_tree_refurbished.app.investigation.llm_model import ModelReply

    @dataclass
    class ScriptedModel:
        replies: list[dict[str, Any]]
        model_name: str = "fake-architecture-map"
        calls: int = 0

        def complete_json(self, *, system: str, messages: list[dict[str, str]], max_tokens: int) -> ModelReply:
            self.calls += 1
            return ModelReply(data=self.replies.pop(0), model=self.model_name, tokens_in=10, tokens_out=10, latency_ms=1)

    write(tmp_path / "pkg" / "a.py", "class A:\n    pass\n")
    write(tmp_path / "pkg2" / "b.py", "class B:\n    pass\n")
    write(tmp_path / "main.py", "def main():\n    return 1\n")
    app = create_app(Settings(environment="test"))
    app.state.investigation_model = ScriptedModel(
        [
            {
                "final": {
                    "summary": "A library.",
                    "simple_explanation": "It exists.",
                    "technical_explanation": "Inspected.",
                    "repo_shape": {"kind": "library", "label": "Library", "confidence": 0.7, "support_status": "inferred"},
                    "component_hypotheses": [
                        {"label": "Core Area", "support_status": "verified", "related_file_paths": ["pkg/a.py"]},
                    ],
                }
            }
        ]
    )
    client = TestClient(app)
    run_id = client.post("/api/analyze", json={"repository_path": str(tmp_path)}).json()["run_id"]

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    kinds = {node["kind"] for node in body["nodes"]}
    assert "structural_group" not in kinds
    assert any(node["label"] == "Core Area" for node in body["nodes"])


def test_hierarchy_lookups_reject_a_real_component_id_as_a_group_id() -> None:
    projector_components = (_component("module:a", "pkg/a.py"), _component("module:b", "main.py"))
    hierarchy = structural_fallback.build_containment_hierarchy("run", projector_components)
    assert hierarchy is not None
    assert hierarchy.leaf_members_by_id.get("module:a") is None
    assert hierarchy.children_by_id.get("module:a") is None


# ---------------------------------------------------------------------------
# Phase C1 additions: hierarchy depth, recursive counts, deep-chain
# capping, and container-vs-leaf dispatch through the real HTTP routes.
# ---------------------------------------------------------------------------


def test_recursive_children_count_equals_sum_of_leaf_descendant_counts(tmp_path: Path) -> None:
    write(tmp_path / "backend" / "src" / "controllers" / "a.py", "def a():\n    return 1\n")
    write(tmp_path / "backend" / "src" / "controllers" / "b.py", "def b():\n    return 1\n")
    write(tmp_path / "backend" / "src" / "services" / "c.py", "def c():\n    return 1\n")
    write(tmp_path / "frontend" / "app.js", "console.log(1);\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    groups = {node["label"]: node for node in body["nodes"] if node["kind"] == "structural_group"}
    # "backend/src" (a real container) must recursively total exactly the
    # sum of its real leaf descendants -- never a different, disagreeing
    # number computed some other way.
    assert groups["backend/src"]["children_count"] == 3
    assert groups["backend/src/controllers"]["children_count"] == 2
    assert groups["backend/src/services"]["children_count"] == 1
    assert groups["backend/src/controllers"]["children_count"] + groups["backend/src/services"]["children_count"] == groups["backend/src"]["children_count"]


def test_deep_chain_is_capped_at_container_max_depth(tmp_path: Path) -> None:
    """A pathologically deep single-child directory chain must not
    produce unbounded nesting -- beyond CONTAINER_MAX_DEPTH it collapses
    into one flat leaf bucket labeled with the real remaining path,
    rather than an ever-deeper chain of one-child wrapper containers."""
    deep_path = tmp_path
    segments = [f"level{i}" for i in range(10)]
    for segment in segments:
        deep_path = deep_path / segment
    write(deep_path / "leaf_a.py", "def a():\n    return 1\n")
    write(deep_path / "leaf_b.py", "def b():\n    return 1\n")
    write(tmp_path / "root_file.py", "def root():\n    return 1\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    groups = [node for node in body["nodes"] if node["kind"] == "structural_group"]
    max_level = max(g["level"] for g in groups)
    assert max_level <= structural_fallback.CONTAINER_MAX_DEPTH
    # Every real file is still reachable somewhere -- nothing was dropped
    # by the depth cap, only flattened.
    total_recursive = sum(g["children_count"] for g in groups if g["parent_group_id"] is None)
    assert total_recursive == 2 + 1  # 2 deep leaf files + 1 root-level file


def test_container_children_are_groups_leaf_children_are_real_components(tmp_path: Path) -> None:
    write(tmp_path / "backend" / "src" / "controllers" / "a.py", "def a():\n    return 1\n")
    write(tmp_path / "backend" / "src" / "services" / "b.py", "def b():\n    return 1\n")
    write(tmp_path / "frontend" / "app.js", "console.log(1);\n")
    app, run_id, client = analyzed_app(tmp_path)

    body = client.get(f"/api/architecture-map?run_id={run_id}").json()
    groups = {node["label"]: node for node in body["nodes"] if node["kind"] == "structural_group"}
    container = groups["backend/src"]
    leaf = groups["backend/src/controllers"]

    container_children = client.get(
        f"/api/architecture-map/nodes/{container['id']}/children?run_id={run_id}"
    ).json()["children"]
    assert all(c["kind"] == "structural_group" for c in container_children)

    leaf_children = client.get(f"/api/architecture-map/nodes/{leaf['id']}/children?run_id={run_id}").json()["children"]
    assert all(c["kind"] not in {"structural_group"} for c in leaf_children)
    assert {c["label"] for c in leaf_children} == {"backend/src/controllers/a.py"}
    assert leaf_children[0]["level"] == leaf["level"] + 1
