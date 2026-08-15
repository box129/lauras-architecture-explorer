"""Objective metrics for claim-level provenance evaluation.

Every function here takes a :class:`~evaluator.schema.GroundTruth` and a
:class:`~evaluator.schema.CandidateSet` and returns a :class:`MetricResult`:
a value (``None`` when the metric is undefined for the given inputs, which
is always handled explicitly rather than raising or silently returning 0)
plus bookkeeping (``numerator``/``denominator``) and free-text ``notes``
explaining edge cases that were hit (e.g. claims with no ground-truth
counterpart, or a metric with an empty denominator).

Only claims whose ``claim_id`` exists in ground truth are used for scoring
against ground truth; candidate claims with a ``novel:`` claim_id (i.e. the
candidate is doing open-ended generation, not answering a fixed list of
claims) are counted and reported, but excluded from precision/recall/etc,
since there is nothing to check them against. This is the harness's
explicit, documented handling of the "recall isn't always well-defined"
case called out in the project brief: for a closed set of claims to verify,
recall is well-defined (see :func:`claim_support_recall`); for open-ended
claim generation, this module cannot and does not report a fabricated
recall number.

Run ``python run_example.py`` from ``research/provenance-evaluation/`` (or
see ``tests/test_metrics_e2e.py``) for an end-to-end demonstration against
the two hand-written candidate sets under ``fixtures/candidates/``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .schema import (
    NON_SUPPORTED_STATUSES,
    CandidateClaim,
    CandidateSet,
    EvidenceItem,
    GroundTruth,
    GroundTruthClaim,
)


@dataclass(frozen=True)
class MetricResult:
    """The result of one metric computation.

    ``value`` is ``None`` (never 0.0, never NaN) when the metric is
    undefined for the given inputs -- e.g. dividing by a zero denominator,
    such as "precision of supported claims" when the candidate marked
    nothing as supported. Callers must handle ``None`` explicitly; treating
    it as 0.0 would misreport "the system did everything wrong" when the
    true situation is "there was nothing to measure".
    """

    name: str
    value: Optional[float]
    numerator: int
    denominator: int
    notes: tuple[str, ...] = field(default_factory=tuple)

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        v = "undefined" if self.value is None else f"{self.value:.3f}"
        return f"{self.name}={v} ({self.numerator}/{self.denominator})"


def _matched_candidates(gt: GroundTruth, candidate: CandidateSet) -> tuple[dict[str, tuple[GroundTruthClaim, CandidateClaim]], tuple[str, ...]]:
    """Split a candidate set into (claim_id -> (gt_claim, candidate_claim))
    for claims that answer a known ground-truth claim, and the list of
    claim_ids in the candidate set that do NOT (novel claims, or -- a
    genuine error case worth surfacing -- a claim_id typo that matches
    neither a real ground-truth id nor the ``novel:`` convention)."""
    gt_by_id = gt.by_id()
    matched: dict[str, tuple[GroundTruthClaim, CandidateClaim]] = {}
    unmatched: list[str] = []
    for c in candidate.claims:
        gtc = gt_by_id.get(c.claim_id)
        if gtc is not None:
            matched[c.claim_id] = (gtc, c)
        else:
            unmatched.append(c.claim_id)
    return matched, tuple(unmatched)


def _evidence_matches(candidate_item: EvidenceItem, gt_item: EvidenceItem) -> bool:
    """Whether a candidate-cited evidence item actually corresponds to a
    real ground-truth evidence item: same evidence type, same symbol(s) /
    relationship, same file, and overlapping line range.

    Line ranges are compared with overlap (not exact equality) so that a
    candidate citing e.g. lines 34-35 when ground truth says line 34 is
    still counted correct -- what matters is pointing at the same fact, not
    reproducing the exact span byte-for-byte.
    """
    if candidate_item.evidence_type != gt_item.evidence_type:
        return False
    if candidate_item.file != gt_item.file:
        return False
    if candidate_item.evidence_type == "relationship":
        if candidate_item.relationship_type != gt_item.relationship_type:
            return False
        if candidate_item.source_symbol_id != gt_item.source_symbol_id:
            return False
        if candidate_item.target_symbol_id != gt_item.target_symbol_id:
            return False
    else:  # source_span
        if candidate_item.symbol_id != gt_item.symbol_id:
            return False
    overlaps = max(candidate_item.start_line, gt_item.start_line) <= min(candidate_item.end_line, gt_item.end_line)
    return overlaps


def _evidence_item_is_valid(candidate_item: EvidenceItem, gt_claim: GroundTruthClaim) -> bool:
    """Whether a single candidate evidence item matches ANY ground-truth
    evidence item for the claim (order-independent membership check)."""
    return any(_evidence_matches(candidate_item, gt_item) for gt_item in gt_claim.expected_evidence)


def claim_support_precision(gt: GroundTruth, candidate: CandidateSet) -> MetricResult:
    """Of the claims the candidate marked "supported" (and that answer a
    known ground-truth claim), how many are truly supported per ground
    truth?

    precision = |{claims marked supported AND truly supported}| /
                |{claims marked supported}|

    Undefined (``value=None``) if the candidate marked no matched claims as
    supported.
    """
    matched, unmatched = _matched_candidates(gt, candidate)
    notes = []
    if unmatched:
        notes.append(f"{len(unmatched)} candidate claim(s) had no ground-truth match and were excluded: {list(unmatched)}")

    marked_supported = [(gtc, cc) for gtc, cc in matched.values() if cc.support_status == "supported"]
    if not marked_supported:
        return MetricResult("claim_support_precision", None, 0, 0, tuple(notes + ["no matched candidate claims were marked 'supported'"]))

    true_positives = sum(1 for gtc, _ in marked_supported if gtc.expected_support_status == "supported")
    denom = len(marked_supported)
    return MetricResult("claim_support_precision", true_positives / denom, true_positives, denom, tuple(notes))


def claim_support_recall(gt: GroundTruth, candidate: CandidateSet) -> MetricResult:
    """Of the ground-truth claims that ARE truly supported, how many did
    the candidate correctly mark supported?

    recall = |{truly-supported GT claims marked supported by candidate}| /
             |{truly-supported GT claims}|

    Well-defined only under the "closed verification" assumption that the
    candidate was asked to answer the full fixed list of ground-truth
    claims (as in this harness's own example candidate sets). If the
    candidate never attempted some ground-truth-supported claims at all
    (e.g. because it is doing open-ended claim generation rather than
    answering a checklist), those claims still count against recall here
    (an unattempted claim is scored the same as a missed one) -- but a note
    is attached flagging exactly how many were unattempted, so callers can
    tell "the candidate looked and got it wrong" apart from "the candidate
    never looked", and discount the number accordingly for open-ended
    generation scenarios. If there are zero truly-supported ground-truth
    claims, recall is undefined.
    """
    candidate_by_id = candidate.by_id()
    supported_gt_claims = [c for c in gt.claims if c.expected_support_status == "supported"]
    if not supported_gt_claims:
        return MetricResult("claim_support_recall", None, 0, 0, ("ground truth contains no supported claims",))

    attempted = [c for c in supported_gt_claims if c.claim_id in candidate_by_id]
    unattempted = [c for c in supported_gt_claims if c.claim_id not in candidate_by_id]
    correctly_recalled = sum(1 for c in attempted if candidate_by_id[c.claim_id].support_status == "supported")

    notes = []
    if unattempted:
        notes.append(
            f"{len(unattempted)}/{len(supported_gt_claims)} truly-supported ground-truth claim(s) were not "
            f"attempted by the candidate at all: {[c.claim_id for c in unattempted]}. Recall below is computed "
            "closed-world (unattempted counts as missed); if the candidate is doing open-ended claim generation "
            "rather than answering a fixed checklist, treat this recall figure as a lower bound, not a fair "
            "measure of generation coverage."
        )

    denom = len(supported_gt_claims)
    return MetricResult("claim_support_recall", correctly_recalled / denom, correctly_recalled, denom, tuple(notes))


def evidence_correctness(gt: GroundTruth, candidate: CandidateSet) -> MetricResult:
    """For claims where the candidate's support_status matches ground
    truth (a "correct verdict", whether that verdict is supported,
    insufficient_evidence, or contradicted), does the cited evidence
    actually exist and actually support (or, for contradicted claims,
    refute) the claim per ground truth?

    Getting the verdict right for the wrong reason (e.g. citing an
    unrelated code span, or a span that exists but doesn't actually bear on
    the claim) is exactly the failure mode this metric is meant to catch --
    see fixtures/candidates/candidate_bad.json claim C9 for a worked
    example (correct "insufficient_evidence" verdict, irrelevant cited
    evidence).

    correctness = |{cited evidence items that match a real GT evidence item}|
                  / |{cited evidence items}|

    computed over the pooled evidence of all claims with a correct verdict
    that cited at least one evidence item. (insufficient_evidence claims
    ordinarily cite no evidence and so do not contribute; a candidate that
    cites evidence anyway for such a claim IS scored, and will score 0 for
    that item, since ground truth has no evidence to match against.)

    Undefined if no claim with a correct verdict cited any evidence.
    """
    matched, unmatched = _matched_candidates(gt, candidate)
    notes = []
    if unmatched:
        notes.append(f"{len(unmatched)} candidate claim(s) had no ground-truth match and were excluded: {list(unmatched)}")

    total_items = 0
    valid_items = 0
    scored_claims = 0
    for gtc, cc in matched.values():
        if cc.support_status != gtc.expected_support_status:
            continue  # wrong verdict entirely; not this metric's job (see unsupported_claim_acceptance_rate)
        if not cc.evidence:
            continue
        scored_claims += 1
        for item in cc.evidence:
            total_items += 1
            if _evidence_item_is_valid(item, gtc):
                valid_items += 1

    if total_items == 0:
        return MetricResult(
            "evidence_correctness", None, 0, 0,
            tuple(notes + ["no claim with a correct verdict cited any evidence to check"]),
        )
    notes.append(f"computed over {scored_claims} claim(s) with a correct verdict and >=1 cited evidence item")
    return MetricResult("evidence_correctness", valid_items / total_items, valid_items, total_items, tuple(notes))


def evidence_completeness(gt: GroundTruth, candidate: CandidateSet) -> MetricResult:
    """For multi-hop claims (category 'supported_multi_hop') that the
    candidate correctly marked supported, is the full evidence chain
    present, or are hops missing?

    completeness = |{GT chain hops matched by >=1 candidate evidence item}|
                   / |{GT chain hops}|

    averaged (mean of per-claim ratios) over all multi-hop claims the
    candidate got right. A claim where the candidate marked it supported
    but cited 2 of 3 required hops contributes 2/3, not 0 -- this metric is
    about chain completeness specifically, separate from whether the
    verdict was right at all (see also claim_support_precision) or whether
    what WAS cited was accurate (see evidence_correctness; a claim can be
    complete but also contain an invalid extra item, or incomplete but
    otherwise accurate as far as it goes).

    Undefined if there are no multi-hop ground-truth claims, or the
    candidate did not correctly mark any of them supported.
    """
    matched, unmatched = _matched_candidates(gt, candidate)
    notes = []
    if unmatched:
        notes.append(f"{len(unmatched)} candidate claim(s) had no ground-truth match and were excluded: {list(unmatched)}")

    multi_hop_gt = [gtc for gtc in gt.claims if gtc.is_multi_hop]
    if not multi_hop_gt:
        return MetricResult("evidence_completeness", None, 0, 0, tuple(notes + ["ground truth contains no multi-hop claims"]))

    ratios = []
    considered = 0
    for gtc in multi_hop_gt:
        pair = matched.get(gtc.claim_id)
        if pair is None:
            continue
        _, cc = pair
        if cc.support_status != "supported":
            continue  # didn't even claim it holds; not a completeness question, that's a recall miss
        considered += 1
        total_hops = len(gtc.expected_evidence)
        matched_hops = sum(
            1 for gt_item in gtc.expected_evidence
            if any(_evidence_matches(cand_item, gt_item) for cand_item in cc.evidence)
        )
        ratios.append(matched_hops / total_hops if total_hops else 1.0)

    if not ratios:
        return MetricResult(
            "evidence_completeness", None, 0, 0,
            tuple(notes + ["candidate did not mark any multi-hop ground-truth claim as supported"]),
        )
    notes.append(f"averaged over {considered} multi-hop claim(s) the candidate marked supported")
    mean_ratio = sum(ratios) / len(ratios)
    # numerator/denominator reported as matched-hops/total-hops pooled, for an interpretable fraction alongside the mean
    return MetricResult("evidence_completeness", mean_ratio, round(mean_ratio * len(ratios) * 100), len(ratios) * 100, tuple(notes))


def unsupported_claim_acceptance_rate(gt: GroundTruth, candidate: CandidateSet) -> MetricResult:
    """Of the ground-truth claims that should NOT be supported
    (insufficient_evidence or contradicted), at what rate does the
    candidate wrongly accept them (mark them "supported")?

    This is the harness's primary false-acceptance / hallucination-risk
    metric: it directly measures the rate at which a downstream consumer
    would be fed a claim as fact when it shouldn't be. Lower is better; 0.0
    is ideal.

    acceptance_rate = |{non-supported GT claims marked 'supported'}| /
                       |{non-supported GT claims attempted by candidate}|

    Only claims the candidate actually attempted are counted (an
    unattempted claim cannot have been wrongly accepted). Undefined if the
    candidate attempted none of the non-supported ground-truth claims.
    """
    matched, unmatched = _matched_candidates(gt, candidate)
    notes = []
    if unmatched:
        notes.append(f"{len(unmatched)} candidate claim(s) had no ground-truth match and were excluded: {list(unmatched)}")

    non_supported = [(gtc, cc) for gtc, cc in matched.values() if gtc.expected_support_status in NON_SUPPORTED_STATUSES]
    if not non_supported:
        return MetricResult(
            "unsupported_claim_acceptance_rate", None, 0, 0,
            tuple(notes + ["candidate did not attempt any ground-truth insufficient_evidence/contradicted claim"]),
        )

    wrongly_accepted = sum(1 for gtc, cc in non_supported if cc.support_status == "supported")
    denom = len(non_supported)
    return MetricResult("unsupported_claim_acceptance_rate", wrongly_accepted / denom, wrongly_accepted, denom, tuple(notes))


def correct_abstention_rate(gt: GroundTruth, candidate: CandidateSet) -> MetricResult:
    """Of the ground-truth claims that should NOT be supported
    (insufficient_evidence or contradicted), at what rate does the
    candidate correctly output the SAME non-supported status (not merely
    "not supported", but the matching one -- insufficient_evidence for
    insufficient_evidence, contradicted for contradicted)?

    abstention_rate = |{non-supported GT claims where candidate's status
                        exactly equals ground truth's status}| /
                       |{non-supported GT claims attempted by candidate}|

    A candidate that says "contradicted" when ground truth says
    "insufficient_evidence" (or vice versa) is not "supported" and so is
    NOT counted by unsupported_claim_acceptance_rate as a false accept, but
    it is *also* not counted here as a correct abstention -- it is a wrong
    abstention type, called out explicitly in this metric's notes so it
    isn't silently absorbed into either number. See also
    unsupported_claim_acceptance_rate, whose denominator is the same set;
    the two rates need not sum to 1.0 because of this third bucket.

    Undefined if the candidate attempted none of the non-supported
    ground-truth claims.
    """
    matched, unmatched = _matched_candidates(gt, candidate)
    notes = []
    if unmatched:
        notes.append(f"{len(unmatched)} candidate claim(s) had no ground-truth match and were excluded: {list(unmatched)}")

    non_supported = [(gtc, cc) for gtc, cc in matched.values() if gtc.expected_support_status in NON_SUPPORTED_STATUSES]
    if not non_supported:
        return MetricResult(
            "correct_abstention_rate", None, 0, 0,
            tuple(notes + ["candidate did not attempt any ground-truth insufficient_evidence/contradicted claim"]),
        )

    exact_matches = sum(1 for gtc, cc in non_supported if cc.support_status == gtc.expected_support_status)
    wrong_type = [
        (gtc.claim_id, gtc.expected_support_status, cc.support_status)
        for gtc, cc in non_supported
        if cc.support_status != gtc.expected_support_status and cc.support_status != "supported"
    ]
    if wrong_type:
        notes.append(f"{len(wrong_type)} claim(s) abstained with the WRONG status (neither a match nor 'supported'): {wrong_type}")

    denom = len(non_supported)
    return MetricResult("correct_abstention_rate", exact_matches / denom, exact_matches, denom, tuple(notes))


@dataclass(frozen=True)
class EvaluationReport:
    """All metrics for one (ground truth, candidate) pair, bundled together."""

    candidate_description: Optional[str]
    novel_claim_ids: tuple[str, ...]
    claim_support_precision: MetricResult
    claim_support_recall: MetricResult
    evidence_correctness: MetricResult
    evidence_completeness: MetricResult
    unsupported_claim_acceptance_rate: MetricResult
    correct_abstention_rate: MetricResult

    def all_metrics(self) -> tuple[MetricResult, ...]:
        return (
            self.claim_support_precision,
            self.claim_support_recall,
            self.evidence_correctness,
            self.evidence_completeness,
            self.unsupported_claim_acceptance_rate,
            self.correct_abstention_rate,
        )

    def format_report(self) -> str:
        lines = []
        if self.candidate_description:
            lines.append(self.candidate_description)
        if self.novel_claim_ids:
            lines.append(f"novel (no ground-truth match) claims present: {list(self.novel_claim_ids)}")
        for m in self.all_metrics():
            lines.append(f"  {m!r}")
            for note in m.notes:
                lines.append(f"      note: {note}")
        return "\n".join(lines)


def evaluate(gt: GroundTruth, candidate: CandidateSet) -> EvaluationReport:
    """Compute every metric in this module for one (ground truth, candidate)
    pair and return them bundled as an :class:`EvaluationReport`."""
    _, unmatched = _matched_candidates(gt, candidate)
    return EvaluationReport(
        candidate_description=candidate.description,
        novel_claim_ids=unmatched,
        claim_support_precision=claim_support_precision(gt, candidate),
        claim_support_recall=claim_support_recall(gt, candidate),
        evidence_correctness=evidence_correctness(gt, candidate),
        evidence_completeness=evidence_completeness(gt, candidate),
        unsupported_claim_acceptance_rate=unsupported_claim_acceptance_rate(gt, candidate),
        correct_abstention_rate=correct_abstention_rate(gt, candidate),
    )
