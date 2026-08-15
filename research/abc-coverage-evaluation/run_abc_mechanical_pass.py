"""ABC coverage evaluation, stage 1 (mechanical pass): run the SAME frozen
R1/R2/R3 ground truth through THIS repository's backend (interventions
A + B + C applied on top of the J3+D4 state) using the byte-identical
frozen pilot harness (``evaluate_repository.py`` from the
``lauras-real-repo-pilot`` worktree, imported read-only).

Nothing under the frozen pilot/D4-comparison worktrees is written to --
all output goes under this directory (``research/abc-coverage-evaluation/``).

The one deliberate wiring difference from the frozen D4 comparison run:
the ``syntax_tree_refurbished`` package is pre-imported from THIS
repository's ``syntax-tree-refurbished-backend/src`` BEFORE the pilot
harness is imported, so the harness's own ``sys.path`` insertion of its
worktree's backend cannot shadow the system under evaluation. The script
asserts which backend was actually imported and records it in the output.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
REPO_ROOT = THIS_DIR.parents[1]
BACKEND_SRC = REPO_ROOT / "syntax-tree-refurbished-backend" / "src"
PILOT_DIR = (
    REPO_ROOT.parent / "lauras-d4-comparison" / "research" / "real-repo-pilot"
)

sys.path.insert(0, str(BACKEND_SRC))
import syntax_tree_refurbished  # noqa: E402  (pre-import: pins the system under evaluation)

_imported_from = Path(syntax_tree_refurbished.__file__).resolve()
assert str(BACKEND_SRC.resolve()) in str(_imported_from), (
    f"system under evaluation must be THIS repo's backend, got {_imported_from}"
)

sys.path.insert(0, str(PILOT_DIR))
from evaluate_repository import (  # noqa: E402
    dump_mechanical_pass,
    load_claims_for_repo,
    run_mechanical_pass,
    run_real_analysis,
)

REPOS = [
    ("r1-clean", PILOT_DIR / "repos" / "r1-clean" / "source", PILOT_DIR / "repos" / "r1-clean" / "ground_truth" / "claims.json"),
    ("r2-medium", PILOT_DIR / "repos" / "r2-medium" / "source" / "src" / "flask", PILOT_DIR / "repos" / "r2-medium" / "ground_truth" / "claims.json"),
    ("r3-challenging", PILOT_DIR / "repos" / "r3-challenging" / "source", PILOT_DIR / "repos" / "r3-challenging" / "ground_truth" / "claims.json"),
]


def main() -> None:
    print(f"system under evaluation: {_imported_from}")
    for tier, analysis_root, claims_path in REPOS:
        out_dir = THIS_DIR / tier
        out_dir.mkdir(parents=True, exist_ok=True)

        run = run_real_analysis(analysis_root)
        claims = load_claims_for_repo(claims_path)
        mechanical = run_mechanical_pass(claims, run)
        dump_mechanical_pass(mechanical, out_dir / "mechanical_pass.json")

        counts = Counter(m.outcome for m in mechanical)
        divergent = [
            (m.claim_id, m.outcome, m.analyzer_support_status)
            for m in mechanical
            if m.outcome not in ("correct_support", "correct_abstention")
        ]
        print(f"{tier}: {dict(counts)}")
        for row in divergent:
            print(f"  divergent: {row}")
        (out_dir / "outcome_counts.json").write_text(
            json.dumps(dict(counts), indent=2), encoding="utf-8"
        )


if __name__ == "__main__":
    main()
