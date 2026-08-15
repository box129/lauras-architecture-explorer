"""Data model and JSON loaders for the provenance-evaluation harness.

This module defines a minimal, self-contained assumption of the shape that
a claim + support status + evidence chain takes. It intentionally mirrors
(in field names, not implementation) the vocabulary used elsewhere in this
initiative for the real provenance domain model:

    ArchitecturalClaim   -> GroundTruthClaim / CandidateClaim (claim_id, text)
    ClaimEpistemicType   -> epistemic_type: "observed" | "inferred"
    ClaimSupportStatus   -> support_status: "supported" | "insufficient_evidence"
                             | "contradicted"
    EvidenceItem         -> EvidenceItem (evidence_type + payload fields)
    SourceSpanEvidence   -> EvidenceItem with evidence_type == "source_span"
    RelationshipEvidence -> EvidenceItem with evidence_type == "relationship"
    EvidenceChain        -> the ordered `evidence` list on a claim
                             (hop_index gives explicit chain order for
                             multi-hop ground-truth claims)

No code from that (separate, in-progress) domain model is imported or
required here -- this is a standalone, minimal stand-in so the harness is
independently runnable now, and a rename-only integration later.

JSON file formats
------------------
Ground truth (see ``fixtures/ground_truth/claims.json`` for a full worked
example)::

    {
      "schema_version": "1.0",
      "fixture_root": "python_app",
      "claims": [
        {
          "claim_id": "C1",
          "text": "...",
          "category": "supported_observed" | "supported_multi_hop"
                      | "insufficient_evidence" | "contradicted",
          "expected_support_status": "supported" | "insufficient_evidence"
                                      | "contradicted",
          "expected_epistemic_type": "observed" | "inferred",
          "expected_evidence": [ <EvidenceItem, see below> , ... ]
        },
        ...
      ]
    }

Candidate claim sets (see ``fixtures/candidates/candidate_good.json``)::

    {
      "schema_version": "1.0",
      "claims": [
        {
          "claim_id": "C1",           # matches a ground-truth claim_id, or
                                       # "novel:<slug>" for a claim with no
                                       # ground-truth counterpart
          "text": "...",
          "support_status": "supported" | "insufficient_evidence"
                             | "contradicted",
          "epistemic_type": "observed" | "inferred",
          "evidence": [ <EvidenceItem>, ... ]
        },
        ...
      ]
    }

EvidenceItem (used in both files; ground-truth items may additionally carry
``hop_index``, ``supports_or_refutes`` and ``note``, all optional /
informational -- the evaluator does not require them from candidates)::

    # source_span:
    {"evidence_type": "source_span", "symbol_id": "...",
     "file": "...", "start_line": 1, "end_line": 5}

    # relationship:
    {"evidence_type": "relationship", "relationship_type": "calls" | "operates_on" | "inherits",
     "source_symbol_id": "...", "target_symbol_id": "...",
     "file": "...", "start_line": 1, "end_line": 1}
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional

SupportStatus = Literal["supported", "insufficient_evidence", "contradicted"]
EpistemicType = Literal["observed", "inferred"]
EvidenceType = Literal["source_span", "relationship"]
ClaimCategory = Literal[
    "supported_observed",
    "supported_multi_hop",
    "insufficient_evidence",
    "contradicted",
]

#: Statuses that mean "ground truth says this claim does NOT hold as stated".
NON_SUPPORTED_STATUSES: tuple[SupportStatus, ...] = (
    "insufficient_evidence",
    "contradicted",
)


@dataclass(frozen=True)
class EvidenceItem:
    """A single piece of evidence cited for or against a claim.

    Exactly one of the two payload shapes applies, selected by
    ``evidence_type``:

    * ``source_span``: ``symbol_id`` + ``file`` + ``start_line``/``end_line``
      identify a single span of source code (a stand-in for
      ``SourceSpanEvidence``).
    * ``relationship``: ``relationship_type`` + ``source_symbol_id`` +
      ``target_symbol_id`` (plus a ``file``/line pointer to the call site or
      other syntactic evidence of the relationship) identify an edge between
      two symbols (a stand-in for ``RelationshipEvidence``).
    """

    evidence_type: EvidenceType
    file: str
    start_line: int
    end_line: int
    symbol_id: Optional[str] = None
    relationship_type: Optional[str] = None
    source_symbol_id: Optional[str] = None
    target_symbol_id: Optional[str] = None
    hop_index: Optional[int] = None
    supports_or_refutes: Optional[str] = None
    note: Optional[str] = None

    @staticmethod
    def from_dict(d: dict) -> "EvidenceItem":
        return EvidenceItem(
            evidence_type=d["evidence_type"],
            file=_normalize_path(d["file"]),
            start_line=int(d["start_line"]),
            end_line=int(d["end_line"]),
            symbol_id=d.get("symbol_id"),
            relationship_type=d.get("relationship_type"),
            source_symbol_id=d.get("source_symbol_id"),
            target_symbol_id=d.get("target_symbol_id"),
            hop_index=d.get("hop_index"),
            supports_or_refutes=d.get("supports_or_refutes"),
            note=d.get("note"),
        )

    def identity_key(self) -> tuple:
        """Key describing *what symbol/relationship* this evidence is about
        (ignoring exact line numbers), used to line evidence items up
        between candidate and ground truth before checking line overlap.
        """
        if self.evidence_type == "relationship":
            return ("relationship", self.relationship_type, self.source_symbol_id, self.target_symbol_id)
        return ("source_span", self.symbol_id, self.file)


def _normalize_path(p: str) -> str:
    return p.replace("\\", "/").strip()


@dataclass(frozen=True)
class GroundTruthClaim:
    """The known-correct answer for one claim about the fixture."""

    claim_id: str
    text: str
    category: ClaimCategory
    expected_support_status: SupportStatus
    expected_epistemic_type: EpistemicType
    expected_evidence: tuple[EvidenceItem, ...] = field(default_factory=tuple)
    note: Optional[str] = None

    @property
    def is_multi_hop(self) -> bool:
        return self.category == "supported_multi_hop"

    @staticmethod
    def from_dict(d: dict) -> "GroundTruthClaim":
        return GroundTruthClaim(
            claim_id=d["claim_id"],
            text=d["text"],
            category=d["category"],
            expected_support_status=d["expected_support_status"],
            expected_epistemic_type=d["expected_epistemic_type"],
            expected_evidence=tuple(EvidenceItem.from_dict(e) for e in d.get("expected_evidence", [])),
            note=d.get("note"),
        )


@dataclass(frozen=True)
class GroundTruth:
    """The full ground-truth claim set for one fixture."""

    fixture_root: str
    claims: tuple[GroundTruthClaim, ...]

    def by_id(self) -> dict[str, GroundTruthClaim]:
        return {c.claim_id: c for c in self.claims}


@dataclass(frozen=True)
class CandidateClaim:
    """One claim asserted by a system under evaluation."""

    claim_id: str
    text: str
    support_status: SupportStatus
    epistemic_type: EpistemicType
    evidence: tuple[EvidenceItem, ...] = field(default_factory=tuple)

    @property
    def is_novel(self) -> bool:
        """True if this claim has no ground-truth counterpart to check
        against (by convention, claim_id starts with ``novel:``). Such
        claims arise from open-ended claim generation and are excluded
        from precision/recall against ground truth (see metrics.py)."""
        return self.claim_id.startswith("novel:")

    @staticmethod
    def from_dict(d: dict) -> "CandidateClaim":
        return CandidateClaim(
            claim_id=d["claim_id"],
            text=d.get("text", ""),
            support_status=d["support_status"],
            epistemic_type=d.get("epistemic_type", "observed"),
            evidence=tuple(EvidenceItem.from_dict(e) for e in d.get("evidence", [])),
        )


@dataclass(frozen=True)
class CandidateSet:
    """A full set of candidate claims to be scored against ground truth."""

    claims: tuple[CandidateClaim, ...]
    description: Optional[str] = None

    def by_id(self) -> dict[str, CandidateClaim]:
        """Map claim_id -> claim. Raises if claim_ids are not unique (a
        candidate set answering the same ground-truth claim twice is
        ambiguous and almost certainly a bug in whatever produced it)."""
        result: dict[str, CandidateClaim] = {}
        for c in self.claims:
            if c.claim_id in result:
                raise ValueError(f"duplicate claim_id in candidate set: {c.claim_id!r}")
            result[c.claim_id] = c
        return result


def load_ground_truth(path: str | Path) -> GroundTruth:
    """Load a ground-truth claims file (see module docstring for the schema)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return GroundTruth(
        fixture_root=data["fixture_root"],
        claims=tuple(GroundTruthClaim.from_dict(c) for c in data["claims"]),
    )


def load_candidate_set(path: str | Path) -> CandidateSet:
    """Load a candidate claim set file (see module docstring for the schema)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return CandidateSet(
        claims=tuple(CandidateClaim.from_dict(c) for c in data["claims"]),
        description=data.get("description"),
    )
