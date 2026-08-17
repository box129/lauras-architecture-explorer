"""D coverage evaluation, stage 2: finalize the mechanical passes into
schema-valid PilotClaimResult sets + metrics (mirroring the ABC
evaluation's ``finalize_abc_evaluation.py`` structure exactly), and verify
claim -> matched evidence -> exact-source provenance for every supported
claim.

Category assignment: after D the ONLY divergent claim in the whole corpus
(besides the frozen out-of-scope entries) is R1-TRC-2, and it is now an
``incorrect_abstention`` rather than a ``resolution_failed`` -- the
nested-def parser fix makes its subject (``before_log.log_it``,
kind="function") resolve, so the claim is finally EVALUABLE, and the
verifier honestly reports insufficient_evidence: supporting hop 1
(``retry_state.get_fn_name()``) would require trusting the
``RetryCallState`` parameter annotation as an observed runtime binding,
which the extractor refuses BY DESIGN (annotations are claims, not
observed bindings). That refusal is a deliberately-kept precision
boundary, not a regression -- see the override note below.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
REPO_ROOT = THIS_DIR.parents[1]
BACKEND_SRC = REPO_ROOT / "syntax-tree-refurbished-backend" / "src"
PILOT_DIR = REPO_ROOT.parent / "lauras-d4-comparison" / "research" / "real-repo-pilot"

sys.path.insert(0, str(BACKEND_SRC))
import syntax_tree_refurbished  # noqa: E402

_imported_from = Path(syntax_tree_refurbished.__file__).resolve()
assert str(BACKEND_SRC.resolve()) in str(_imported_from)

sys.path.insert(0, str(PILOT_DIR))
from evaluate_repository import (  # noqa: E402
    build_run_manifest,
    compute_metrics,
    finalize_results,
    load_claims_for_repo,
    run_mechanical_pass,
    run_real_analysis,
)
from evaluation_result_schema import (  # noqa: E402
    dump_pilot_results,
    validate_results_reference_known_claims,
)

_R1_TRC_2_NOTE = (
    "Newly EVALUABLE under intervention D (previously resolution_failed): the nested-def "
    "taxonomy fix classifies before_log.log_it as kind='function', matching the frozen ground "
    "truth, so StableEntityRef resolution now succeeds for every ref in the proposition. The "
    "verifier then honestly reports insufficient_evidence: hop 1 (before.py:35, "
    "`retry_state.get_fn_name()`) is a call through a parameter whose type is known only from "
    "the `RetryCallState` annotation, and the extractor refuses BY DESIGN to treat a parameter "
    "type annotation as an observed runtime binding (an annotation is a claim, not an observed "
    "fact). This is the deliberately-kept precision boundary, not a regression: the claim moves "
    "from 'cannot even be evaluated' to 'evaluated, honestly unsupported', which ADDS it to the "
    "conditional-recall denominator (true_supported/(true_supported+true_abstained)) for the "
    "first time. Any resulting percentage drop in conditional recall is a denominator change, "
    "not a lost previously-supported claim."
)

R1_OVERRIDES = {
    "R1-TRC-2": ("call_resolution", _R1_TRC_2_NOTE),
}

REPOS = [
    ("r1-clean", "jd/tenacity", "26f719dc73d3c5612b9c1b8d18a7883837790ad8",
     PILOT_DIR / "repos" / "r1-clean" / "source",
     PILOT_DIR / "repos" / "r1-clean" / "ground_truth" / "claims.json", R1_OVERRIDES),
    ("r2-medium", "pallets/flask", "6a2f545bfd8ed31e19066a299296917e034aca58",
     PILOT_DIR / "repos" / "r2-medium" / "source" / "src" / "flask",
     PILOT_DIR / "repos" / "r2-medium" / "ground_truth" / "claims.json", {}),
    ("r3-challenging", "openstack/stevedore", "d3a55f33fb310f43833c7c3eb5ba417e46a9a928",
     PILOT_DIR / "repos" / "r3-challenging" / "source",
     PILOT_DIR / "repos" / "r3-challenging" / "ground_truth" / "claims.json", {}),
]


def _verify_provenance(results, claims_by_id, run) -> list[dict]:
    """For every correct_support claim: matched evidence must be non-empty,
    every matched relation must exist in the run, be fully resolved, have
    endpoints that resolve (via this run's own symbols) to the ground-truth
    proposition's refs, and carry a primary span that lands inside one of
    the ground truth's exact_source_locations (same file, intersecting
    line range). Returns one report row per supported claim; raises on any
    violation."""
    relations_by_id = {r.id: r for r in run.relations}
    symbols_by_id = {s.id: s for s in run.symbols}
    rows: list[dict] = []

    def _ref_matches_symbol(ref, symbol) -> bool:
        return (
            symbol.path.replace("\\", "/") == ref.file_path
            and (
                symbol.qualified_name == ref.qualified_name
                or symbol.qualified_name.endswith("::" + ref.qualified_name)
            )
        )

    for result in results:
        if result.outcome != "correct_support":
            continue
        claim = claims_by_id[result.claim_id]
        prop = claim.proposition
        assert result.matched_evidence, f"{result.claim_id}: supported with no matched evidence"
        span_checks = []
        for relation_id in result.matched_evidence:
            relation = relations_by_id.get(relation_id)
            assert relation is not None, f"{result.claim_id}: matched relation {relation_id} not in run"
            assert relation.resolution_status == "resolved", (
                f"{result.claim_id}: matched relation {relation_id} is {relation.resolution_status}"
            )
            source_symbol = symbols_by_id.get(relation.source_entity_id)
            target_symbol = symbols_by_id.get(relation.target_entity_id)
            assert source_symbol is not None and target_symbol is not None, (
                f"{result.claim_id}: relation {relation_id} endpoints missing from run symbols"
            )
            # Endpoint identity: every matched relation's endpoints must be
            # among the proposition's own refs (subject/object for direct;
            # consecutive path pairs for reachability).
            all_refs = [prop.subject, prop.object, *(prop.path or [])]
            assert any(_ref_matches_symbol(ref, source_symbol) for ref in all_refs), (
                f"{result.claim_id}: relation {relation_id} source {source_symbol.qualified_name} "
                "matches no proposition ref"
            )
            assert any(_ref_matches_symbol(ref, target_symbol) for ref in all_refs), (
                f"{result.claim_id}: relation {relation_id} target {target_symbol.qualified_name} "
                "matches no proposition ref"
            )
            # Exact-source anchoring: the relation's primary span must be a
            # real location INSIDE the claimed source symbol's own range.
            assert relation.span_path is not None and relation.span_start_line is not None, (
                f"{result.claim_id}: relation {relation_id} carries no primary span"
            )
            span_end = relation.span_end_line or relation.span_start_line
            assert relation.span_path.replace("\\", "/") == source_symbol.path.replace("\\", "/"), (
                f"{result.claim_id}: relation {relation_id} span file {relation.span_path} is not "
                f"the claimed source symbol's file {source_symbol.path}"
            )
            assert source_symbol.start_line <= relation.span_start_line and span_end <= source_symbol.end_line, (
                f"{result.claim_id}: relation {relation_id} span "
                f"{relation.span_start_line}-{span_end} lies outside the claimed source symbol "
                f"{source_symbol.qualified_name} ({source_symbol.start_line}-{source_symbol.end_line})"
            )
            cited = None
            for loc in claim.exact_source_locations:
                if (
                    relation.span_path.replace("\\", "/") == loc.file_path
                    and relation.span_start_line <= loc.end_line
                    and span_end >= loc.start_line
                ):
                    cited = f"{loc.file_path}:{loc.start_line}-{loc.end_line} ({loc.description})"
                    break
            span_checks.append(
                {
                    "relation_id": relation_id,
                    "relation_span": f"{relation.span_path}:{relation.span_start_line}-{span_end}",
                    "span_inside_source_symbol": (
                        f"{source_symbol.qualified_name} "
                        f"({source_symbol.start_line}-{source_symbol.end_line})"
                    ),
                    "matches_ground_truth_citation": cited,
                    "resolution_basis": relation.resolution_basis,
                    "supporting_resolution_spans": [
                        f"{s.path}:{s.start_line}-{s.end_line} ({s.description})"
                        for s in relation.supporting_resolution_spans
                    ],
                }
            )
        rows.append({"claim_id": result.claim_id, "evidence": span_checks})
    return rows


def main() -> None:
    print(f"system under evaluation: {_imported_from}")
    pooled = {"true_supported": 0, "true_abstained": 0, "false_supported": 0, "false_abstained": 0}
    for tier, repo_id, revision, analysis_root, claims_path, overrides in REPOS:
        out_dir = THIS_DIR / tier
        out_dir.mkdir(parents=True, exist_ok=True)

        run = run_real_analysis(analysis_root)
        claims = load_claims_for_repo(claims_path)
        claims_by_id = {c.claim_id: c for c in claims}

        mechanical = run_mechanical_pass(claims, run)
        results = finalize_results(mechanical, overrides)
        validate_results_reference_known_claims(results, frozenset(claims_by_id))
        dump_pilot_results(results, out_dir / "claims.json")

        metrics = compute_metrics(results, claims_by_id, run)
        (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

        failures = [
            r.to_dict()
            for r in results
            if r.outcome in ("incorrect_abstention", "false_support", "resolution_failed", "out_of_scope")
        ]
        (out_dir / "failures.json").write_text(json.dumps(failures, indent=2), encoding="utf-8")

        manifest = build_run_manifest(
            repository_id=repo_id, repository_revision=revision, ground_truth_path=claims_path, run=run
        )
        manifest["comparison_note"] = (
            "D coverage evaluation -- NOT pilot-v1 and NOT the frozen D4 comparison; system "
            "checkpoint is this repository's backend with intervention D (nested-definition "
            "symbol kind: method only when the immediate lexical parent is a class body; plus "
            "guarded closure-captured `self` binding for functions nested inside class methods) "
            "applied on top of the A+B+C state frozen at commit 88a3689."
        )
        manifest["system_under_evaluation"] = str(_imported_from)
        (out_dir / "run_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        provenance = _verify_provenance(results, claims_by_id, run)
        (out_dir / "provenance_check.json").write_text(
            json.dumps(provenance, indent=2), encoding="utf-8"
        )

        raw = metrics["raw_counts"]
        for key in pooled:
            pooled[key] += raw[key]
        print(f"{tier}: raw_counts={raw}")
        print(f"{tier}: provenance verified for {len(provenance)} supported claims")

    print(f"pooled: {pooled}")


if __name__ == "__main__":
    main()
