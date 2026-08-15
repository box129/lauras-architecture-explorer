#!/usr/bin/env python3
"""J3: true end-to-end experiment -- normal pipeline only, no direct
extractor calls from the evaluation harness.

CRITICAL RULE (verified by ``test_experiment_module_never_imports_extractors``
in ``test_j3_normal_pipeline.py``, via AST inspection of ``experiment.py``,
not just by convention): the module that produces J3's scored result must
never import or call ``extract_constructor_attribute_bindings``,
``extract_call_relations``, or ``extract_inheritance_relations`` directly.

This module does NOT reimplement the experiment. ``experiment.py``'s
``run_experiment()`` was already written (for J-V0) to satisfy this rule
structurally: its principal path is

    AnalysisController.analyze(repo_path)
        -> store.get_symbols(run_id)          (real ParsedSymbols)
        -> store.get_relations(run_id)         (real, PERSISTED relations --
                                                 never job.relations, never a
                                                 direct extractor call)
        -> build_cases(...)                    (same ClaimPropositions as V0/J2)
        -> claim_from_proposition(...)          (same verifier)
        -> build_ground_truth/build_candidate_set + evaluator.metrics.evaluate

``experiment.py`` itself never imports any of the three extractor functions
-- it only ever reads what the normal ``AnalysisController`` pipeline
already computed and persisted. J-V0 happened to run this against a
checkpoint where the pipeline's own "relations" stage called
``extract_call_relations(job, symbols)`` WITHOUT bindings; J3 runs the
IDENTICAL code against a newer checkpoint where that same pipeline stage
now also runs constructor-binding extraction and passes real bindings in
(see ``app/analysis/analysis_controller.py``, "Wire constructor-binding-
aware call resolution into the normal pipeline"). The evaluation harness
did not change; the production pipeline did. That is precisely what proves
integration, not merely an improved experiment path.

This module's only job is to call ``experiment.run_experiment()``, format
the result as "J3", and compare it against the V0 and J2 reference numbers
recorded below (hardcoded from the tagged/committed prior results -- V0 is
immutable at commit 052f954, tag ``feasibility-pre-constructor-binding``;
J2 is immutable at commit b74efe3 on ``research/j2-end-to-end-rerun`` --
neither is re-executed or altered here).
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Mapping

THIS_DIR = Path(__file__).resolve().parent
REPO_ROOT = THIS_DIR.parents[1]
BACKEND_SRC = REPO_ROOT / "syntax-tree-refurbished-backend" / "src"
EVALUATOR_ROOT = REPO_ROOT / "research" / "provenance-evaluation"

for p in (str(THIS_DIR), str(BACKEND_SRC), str(EVALUATOR_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from experiment import ExperimentResult, run_experiment  # noqa: E402


# Reference numbers, recorded by hand from the immutable prior results --
# never recomputed here. Source: V0 = tag feasibility-pre-constructor-binding
# (commit 052f954); J2 = commit b74efe3 (research/j2-end-to-end-rerun).
V0_REFERENCE: Mapping[str, float | int | None] = {
    "claim_support_precision": 1.000,
    "claim_support_precision_frac": "1/1",
    "claim_support_recall": 0.200,
    "claim_support_recall_frac": "1/5",
    "evidence_correctness": 1.000,
    "evidence_correctness_frac": "1/1",
    "evidence_completeness": None,  # undefined, 0/0
    "unsupported_claim_acceptance_rate": 0.000,
    "correct_abstention_rate": 1.000,
    "supported_correctly": 1,
    "correct_abstentions": 1,
    "incorrect_abstentions": 4,
    "false_supports": 0,
}

J2_REFERENCE: Mapping[str, float | int | None] = {
    "claim_support_precision": 1.000,
    "claim_support_precision_frac": "5/5",
    "claim_support_recall": 1.000,
    "claim_support_recall_frac": "5/5",
    "evidence_correctness": 1.000,
    "evidence_correctness_frac": "6/6",
    "evidence_completeness": 1.000,
    "evidence_completeness_frac": "100/100",
    "unsupported_claim_acceptance_rate": 0.000,
    "correct_abstention_rate": 1.000,
    "supported_correctly": 5,
    "correct_abstentions": 1,
    "incorrect_abstentions": 0,
    "false_supports": 0,
}


def _metric_value(report, name: str) -> float | None:
    return getattr(report, name).value


def _metric_frac(report, name: str) -> str:
    m = getattr(report, name)
    return f"{m.numerator}/{m.denominator}"


def summarize_j3(result: ExperimentResult) -> dict[str, float | int | None]:
    report = result.report
    supported_correctly = 0
    correct_abstentions = 0
    incorrect_abstentions = 0
    false_supports = 0
    for case in result.cases:
        claim = result.claims_by_key[case.key]
        expected = case.expected_support_status_per_scoping
        actual = claim.support_status
        if expected == "supported" and actual == "supported":
            supported_correctly += 1
        elif expected == "supported" and actual != "supported":
            incorrect_abstentions += 1
        elif expected == "insufficient_evidence" and actual == "insufficient_evidence":
            correct_abstentions += 1
        elif expected == "insufficient_evidence" and actual == "supported":
            false_supports += 1
    return {
        "claim_support_precision": _metric_value(report, "claim_support_precision"),
        "claim_support_precision_frac": _metric_frac(report, "claim_support_precision"),
        "claim_support_recall": _metric_value(report, "claim_support_recall"),
        "claim_support_recall_frac": _metric_frac(report, "claim_support_recall"),
        "evidence_correctness": _metric_value(report, "evidence_correctness"),
        "evidence_correctness_frac": _metric_frac(report, "evidence_correctness"),
        "evidence_completeness": _metric_value(report, "evidence_completeness"),
        "evidence_completeness_frac": _metric_frac(report, "evidence_completeness"),
        "unsupported_claim_acceptance_rate": _metric_value(report, "unsupported_claim_acceptance_rate"),
        "correct_abstention_rate": _metric_value(report, "correct_abstention_rate"),
        "supported_correctly": supported_correctly,
        "correct_abstentions": correct_abstentions,
        "incorrect_abstentions": incorrect_abstentions,
        "false_supports": false_supports,
    }


def format_v0_j2_j3_comparison(result: ExperimentResult) -> str:
    j3 = summarize_j3(result)
    lines: list[str] = []
    lines.append("=" * 96)
    lines.append("J3: normal AnalysisController pipeline only -- no direct extractor calls")
    lines.append("=" * 96)
    lines.append(f"run_id: {result.run_id}")
    lines.append(f"real symbols: {len(result.symbols)}")
    lines.append(
        f"real relations via store.get_relations(run_id): {len(result.relations_from_store)} "
        f"(matches job.relations: {result.relations_from_store == result.relations_from_job_attr})"
    )
    lines.append("")
    lines.append("-" * 96)
    header = f"{'metric':38s} {'V0':>14s} {'J2':>14s} {'J3':>14s}"
    lines.append(header)
    lines.append("-" * 96)

    def row(label: str, key: str, frac_key: str | None = None) -> str:
        def fmt(ref: Mapping[str, float | int | None]) -> str:
            value = ref.get(key)
            if value is None:
                return "undefined"
            frac = ref.get(frac_key) if frac_key else None
            return f"{value:.3f} ({frac})" if frac else f"{value}"

        j3_val = j3.get(key)
        j3_frac = j3.get(frac_key) if frac_key else None
        j3_str = "undefined" if j3_val is None else (f"{j3_val:.3f} ({j3_frac})" if j3_frac else f"{j3_val}")
        return f"{label:38s} {fmt(V0_REFERENCE):>14s} {fmt(J2_REFERENCE):>14s} {j3_str:>14s}"

    lines.append(row("supported_correctly", "supported_correctly"))
    lines.append(row("correct_abstentions", "correct_abstentions"))
    lines.append(row("incorrect_abstentions", "incorrect_abstentions"))
    lines.append(row("false_supports", "false_supports"))
    lines.append(row("claim_support_precision", "claim_support_precision", "claim_support_precision_frac"))
    lines.append(row("claim_support_recall", "claim_support_recall", "claim_support_recall_frac"))
    lines.append(row("evidence_correctness", "evidence_correctness", "evidence_correctness_frac"))
    lines.append(row("evidence_completeness", "evidence_completeness", "evidence_completeness_frac"))
    lines.append(row("unsupported_claim_acceptance_rate", "unsupported_claim_acceptance_rate"))
    lines.append(row("correct_abstention_rate", "correct_abstention_rate"))
    lines.append("=" * 96)
    return "\n".join(lines)


def main() -> None:
    result = run_experiment()
    print(format_v0_j2_j3_comparison(result))


if __name__ == "__main__":
    main()
