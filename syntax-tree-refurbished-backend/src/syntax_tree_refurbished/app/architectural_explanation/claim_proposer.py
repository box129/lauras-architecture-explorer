"""L1/L2 boundary: the ``ClaimProposer`` protocol.

L2 (the verification service) depends on this Protocol only, never on a
concrete L1 implementation directly -- exactly the same "code against the
interface, inject the real thing at the call site" pattern already used
for ``InvestigationModel``/``NoConfiguredModel``/``make_live_model``
(``app.investigation.llm_model``). This is what lets L1 and L2 be built
and tested in parallel: L2's own tests inject a fake ``ClaimProposer``
(deterministic, no network); L1's own tests exercise the real proposer
against a mocked ``InvestigationModel`` (see ``app.investigation.llm_model.
NoConfiguredModel``/a test double), never a live API.
"""

from __future__ import annotations

from typing import Protocol

from syntax_tree_refurbished.core.models.architectural_explanation import (
    BoundedEvidence,
    ClaimProposal,
)


class ClaimProposer(Protocol):
    """Proposes structural claims from bounded evidence. MUST NOT assign
    support status -- a proposer's output is always pre-verification (see
    ``ClaimProposal``'s own docstring). Implementations must reject/omit
    (never fabricate) a proposition outside ``ALLOWED_PROPOSITION_SHAPES``
    or one referencing an entity id not present in ``evidence`` --
    ``core.models.architectural_explanation.validate_claim_proposal`` is
    available for implementations (or their callers) to enforce this.
    """

    def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
        ...


class NullClaimProposer:
    """No-op proposer, mirroring ``app.investigation.llm_model.
    NoConfiguredModel`` -- returns zero proposals unconditionally. Used
    wherever no live LLM is configured (test environment, missing API
    key) so the rest of the pipeline (verification, explanation
    composition) still runs deterministically end-to-end, just with an
    empty claim set, rather than requiring a live API for any test or
    degraded-mode run."""

    def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
        return ()
