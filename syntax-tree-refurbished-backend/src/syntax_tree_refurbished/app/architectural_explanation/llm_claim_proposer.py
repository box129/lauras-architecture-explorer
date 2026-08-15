"""L1: the real (LLM-backed) ``ClaimProposer`` implementation.

Builds on ``app.investigation.llm_model.InvestigationModel`` -- the
existing provider abstraction used by ``InvestigationEngine`` -- rather
than introducing a second LLM-calling mechanism. There is no JSON-schema
-constrained decoding available in this codebase; "structured output"
here means the same discipline ``InvestigationEngine``/``OpenAICompatible
InvestigationModel`` already follow: strong prompt instructions asking
for compact JSON only, plus tolerant, never-crash parsing of whatever
comes back.

Design constraints this module exists to enforce (see
``core.models.architectural_explanation`` for the frozen contract these
serve):

- **Bounded prompt only.** The prompt built here lists *only* the
  entities and relations present in the caller-supplied ``BoundedEvidence``
  -- never the raw repository, never anything outside ``evidence``. See
  ``_build_messages``.
- **Proposer, never verifier.** This class only ever constructs
  ``ClaimProposal`` values (which structurally cannot carry a support
  status -- see ``ClaimProposal``'s own docstring). It never assigns, or
  even represents, whether a proposal is true.
- **Vocabulary + evidence-membership enforcement.** Every raw item in the
  model's response is passed through ``ClaimProposal`` construction (which
  enforces ``ALLOWED_PROPOSITION_SHAPES``) and then
  ``validate_claim_proposal`` (which enforces every referenced entity id
  is one the model was actually shown). A raw item failing either check is
  silently skipped -- never crashes the call, never gets forced into a
  shape that doesn't fit.
- **Callers own model selection.** This class takes an already-configured
  ``InvestigationModel``. It does not decide whether a live LLM is
  configured -- that selection (``NoConfiguredModel()`` vs.
  ``make_live_model(settings)``) is the caller's responsibility, mirroring
  ``api/routes/query.py``'s existing ``_model(request)`` helper. If a
  caller passes a ``NoConfiguredModel`` (or any model whose
  ``complete_json`` raises), that exception propagates out of
  ``propose_claims`` unmodified -- callers who want zero-proposal
  degraded behavior should use ``NullClaimProposer`` instead of calling
  this class with an unconfigured model.
"""

from __future__ import annotations

import logging
from typing import Any

from syntax_tree_refurbished.app.investigation.llm_model import (
    JSON_INSTRUCTION,
    InvestigationModel,
)
from syntax_tree_refurbished.core.models.architectural_explanation import (
    ALLOWED_PROPOSITION_SHAPES,
    BoundedEvidence,
    ClaimProposal,
    validate_claim_proposal,
)
from syntax_tree_refurbished.core.models.provenance import ProducerInfo

logger = logging.getLogger(__name__)

#: Version tag recorded on every ClaimProposal.producer this class
#: constructs -- a prompt/version tag per ProducerInfo's own docstring,
#: bumped whenever the prompt shape below changes in a way that could
#: affect proposal content.
_PRODUCER_VERSION = "l1-claim-proposer-v1"

_DEFAULT_MAX_TOKENS = 2048

_SYSTEM_PROMPT = """You are a precision-first architectural claim proposer for a static-analysis tool.

You will be shown a bounded list of code entities and the structural relations already observed between them. Your job is to propose candidate structural claims about these entities -- NOT to decide whether they are true. A separate, deterministic verifier will check every claim you propose against real evidence; you are only a proposer.

Rules you MUST follow:
1. You may reference ONLY the entity ids explicitly listed under "entities" below. Never invent an entity id, never reference an id you were not shown, never guess at an id you think might exist.
2. You may only propose claims of these exact (kind, relation_kind) shapes -- nothing else:
   - kind="direct_relation", relation_kind="calls"
   - kind="direct_relation", relation_kind="inherits"
   - kind="reachability", relation_kind="calls"
3. For kind="direct_relation": propose subject_entity_id and object_entity_id only (no path_entity_ids).
4. For kind="reachability": propose path_entity_ids as the full ordered chain of entity ids from subject to object inclusive (at least 2 entries, first entry equal to subject_entity_id, last entry equal to object_entity_id).
5. Do not assign truth, confidence, or support status to any claim. That is not your role.
6. If you cannot find any claim worth proposing from the entities and relations shown, return an empty "proposals" array. Do not fabricate a claim just to have something to return.

Respond with a single JSON object of exactly this shape:
{
  "proposals": [
    {
      "proposition": {
        "kind": "direct_relation",
        "subject_entity_id": "<entity id from the list you were shown>",
        "relation_kind": "calls",
        "object_entity_id": "<entity id from the list you were shown>",
        "path_entity_ids": []
      },
      "proposed_statement": "<optional short human-readable description of this claim>"
    }
  ]
}

"path_entity_ids" is only meaningful (and required, with >= 2 entries) when "kind" is "reachability"; omit it or leave it empty for "direct_relation". "proposed_statement" is optional, presentation-only prose -- it is never treated as authoritative."""  # noqa: E501


class LLMClaimProposer:
    """Implements ``ClaimProposer`` using a real (or fake, for tests)
    ``InvestigationModel``.

    Callers must supply an already-configured ``InvestigationModel`` and
    are responsible for not calling ``propose_claims`` with
    ``app.investigation.llm_model.NoConfiguredModel`` unless they want its
    ``RuntimeError`` to surface -- this class does not itself decide
    whether a live LLM is available (see module docstring).
    """

    def __init__(self, model: InvestigationModel, *, max_tokens: int = _DEFAULT_MAX_TOKENS):
        self._model = model
        self._max_tokens = max_tokens

    def propose_claims(self, evidence: BoundedEvidence) -> tuple[ClaimProposal, ...]:
        """Propose candidate structural claims for ``evidence``.

        Calls the underlying model's ``complete_json`` exactly once. If
        that call raises (e.g. ``NoConfiguredModel``'s ``RuntimeError``, a
        network error, or a parse failure inside the model adapter), the
        exception propagates -- it is not swallowed here. Once a reply is
        obtained, every raw proposal item is independently validated;
        malformed or out-of-vocabulary or out-of-evidence items are
        skipped (and counted for diagnostics via a debug log), never
        raised, and never allowed to abort the other, valid items in the
        same reply.
        """
        producer = ProducerInfo(
            producer_type="llm",
            name=self._model.model_name,
            version=_PRODUCER_VERSION,
        )
        reply = self._model.complete_json(
            system=_SYSTEM_PROMPT,
            messages=_build_messages(evidence),
            max_tokens=self._max_tokens,
        )

        raw_proposals = reply.data.get("proposals") if isinstance(reply.data, dict) else None
        if not isinstance(raw_proposals, list):
            logger.debug(
                "LLMClaimProposer: model reply had no usable 'proposals' list (run_id=%s)",
                evidence.run_id,
            )
            return ()

        accepted: list[ClaimProposal] = []
        skipped = 0
        for raw in raw_proposals:
            if not isinstance(raw, dict):
                skipped += 1
                continue
            try:
                proposal = ClaimProposal.from_dict(raw, producer=producer)
            except (KeyError, TypeError, ValueError):
                skipped += 1
                continue
            try:
                validate_claim_proposal(proposal, evidence)
            except ValueError:
                skipped += 1
                continue
            accepted.append(proposal)

        if skipped:
            logger.debug(
                "LLMClaimProposer: skipped %d malformed/out-of-scope proposal item(s) (run_id=%s)",
                skipped,
                evidence.run_id,
            )
        return tuple(accepted)


def _build_messages(evidence: BoundedEvidence) -> list[dict[str, str]]:
    """Build the single user message for one ``propose_claims`` call.

    Lists ONLY ``evidence.symbols`` and ONLY ``evidence.relations`` --
    never the raw repository, never anything outside ``evidence`` -- per
    the module docstring's bounded-prompt requirement.
    """
    entity_lines = [
        f'- id="{symbol.id}" name="{symbol.name}" kind="{symbol.kind}" '
        f'qualified_name="{symbol.qualified_name}" path="{symbol.path}"'
        + (" (target entity)" if symbol.id == evidence.target_entity_id else "")
        for symbol in evidence.symbols
    ]
    if evidence.relations:
        relation_lines = [
            f'- source_entity_id="{relation.source_entity_id}" '
            f'relation_kind="{relation.relation_kind}" '
            f'target_entity_id="{relation.target_entity_id or ""}" '
            f'target_reference="{relation.target_reference or ""}" '
            f'resolution_status="{relation.resolution_status}"'
            for relation in evidence.relations
        ]
    else:
        relation_lines = ["(no observed relations in this bounded evidence set)"]

    allowed_shapes_text = ", ".join(
        f"{kind}/{relation_kind}" for kind, relation_kind in sorted(ALLOWED_PROPOSITION_SHAPES)
    )

    content = (
        f"target_entity_id: {evidence.target_entity_id}\n\n"
        "entities (the ONLY ids you may reference):\n"
        + "\n".join(entity_lines)
        + "\n\nobserved relations (structural facts already extracted; you may use these as "
        "grounds for a proposal, but you are not restricted to restating them verbatim -- you "
        "may also propose a reachability claim spanning several of them):\n"
        + "\n".join(relation_lines)
        + f"\n\nAllowed proposal shapes (kind/relation_kind): {allowed_shapes_text}.\n\n"
        + JSON_INSTRUCTION
    )
    return [{"role": "user", "content": content}]
