#!/usr/bin/env python3
"""End-to-end runnable example for the provenance-evaluation harness.

Loads the ground truth for the toy `python_app` fixture and scores the two
hand-written candidate claim sets against it (one intended to be fully
correct, one with deliberate errors), printing a metrics report for each.

Run from anywhere with:

    python research/provenance-evaluation/run_example.py

(or `cd research/provenance-evaluation && python run_example.py`).

No dependencies beyond the Python standard library.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from evaluator.metrics import evaluate  # noqa: E402
from evaluator.schema import load_candidate_set, load_ground_truth  # noqa: E402

GROUND_TRUTH_PATH = ROOT / "fixtures" / "ground_truth" / "claims.json"
CANDIDATE_PATHS = [
    ROOT / "fixtures" / "candidates" / "candidate_good.json",
    ROOT / "fixtures" / "candidates" / "candidate_bad.json",
]


def main() -> None:
    gt = load_ground_truth(GROUND_TRUTH_PATH)
    print(f"Loaded ground truth: fixture_root={gt.fixture_root!r}, {len(gt.claims)} claims")
    print(f"  categories: {sorted({c.category for c in gt.claims})}")
    print()

    for candidate_path in CANDIDATE_PATHS:
        candidate = load_candidate_set(candidate_path)
        report = evaluate(gt, candidate)
        print("=" * 78)
        print(f"Candidate: {candidate_path.name}  ({len(candidate.claims)} claims)")
        print("-" * 78)
        print(report.format_report())
        print()


if __name__ == "__main__":
    main()
