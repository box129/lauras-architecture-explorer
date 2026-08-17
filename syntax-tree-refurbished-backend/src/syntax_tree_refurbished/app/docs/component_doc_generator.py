"""Per-component evidence-grounded LLM documentation generation.

Pipeline position: runs strictly AFTER the L1/L2 architectural-explanation
pipeline (``verify_target_entity``) has produced deterministically verified
``ArchitecturalClaim``s for the component. This module's single LLM call
only writes *presentation prose* -- purpose, responsibilities, and
per-claim relationship notes -- it never proposes, verifies, or re-labels
a claim.

Grounding discipline enforced deterministically here (not by prompt trust):

- ``relationship_notes`` in the model reply are filtered against the exact
  set of verified claim ids the model was shown. A note whose ``claim_id``
  is unknown is discarded (and counted), never coerced onto another claim.
- The verified claims themselves pass through this module untouched --
  ``support_status`` is assigned upstream by ``verify_proposition`` and
  nothing an LLM writes here can change it. An ``insufficient_evidence``
  claim therefore structurally cannot be "upgraded" by confident prose:
  the prose is attached alongside the claim, while the status the UI
  renders always comes from the verifier's claim object.
- ``purpose``/``responsibilities`` are interpretive, AI-generated text and
  are returned as such -- callers (the docs route / Doc Studio) must
  present them under an explicit AI-generated label, never as
  deterministically verified fact.

Model selection is the caller's job (mirroring ``LLMClaimProposer``):
this module takes an already-configured ``InvestigationModel`` and lets
its exceptions (e.g. ``NoConfiguredModel``'s ``RuntimeError``, network
errors) propagate unmodified.
"""

from __future__ import annotations

from dataclasses import dataclass

from syntax_tree_refurbished.app.docs.docs_prompts import (
    COMPONENT_DOC_SYSTEM_PROMPT,
    build_component_doc_user_prompt,
)
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel
from syntax_tree_refurbished.core.models.provenance import ArchitecturalClaim

_DEFAULT_MAX_TOKENS = 1600

#: Hard caps applied to the model reply so a malformed/verbose reply can
#: never balloon the response payload.
_MAX_RESPONSIBILITIES = 12
_MAX_NOTE_CHARS = 600
_MAX_PURPOSE_CHARS = 2000


@dataclass(frozen=True)
class RelationshipNote:
    """One LLM-written presentation note attached to a verified claim.

    ``claim_id`` is guaranteed (by ``generate_component_documentation``'s
    filtering) to reference a claim in the verified set the model was
    shown. The note is prose ABOUT the claim -- the claim's
    ``support_status`` remains the only authority on whether the
    relationship is established.
    """

    claim_id: str
    note: str


@dataclass(frozen=True)
class GeneratedComponentDoc:
    purpose: str
    responsibilities: tuple[str, ...]
    relationship_notes: tuple[RelationshipNote, ...]
    #: Notes the model returned that were deterministically discarded for
    #: referencing an unknown claim id (or being malformed/empty).
    discarded_relationship_notes: int
    model: str
    tokens_in: int
    tokens_out: int
    latency_ms: int


def format_claims_for_prompt(claims: tuple[ArchitecturalClaim, ...]) -> str:
    if not claims:
        return "(no verified claims are available for this component)"
    lines: list[str] = []
    for claim in claims:
        lines.append(
            f'- claim_id={claim.id} status={claim.support_status} statement="{claim.statement}"'
        )
    return "\n".join(lines)


def generate_component_documentation(
    *,
    model: InvestigationModel,
    component_facts: str,
    claims: tuple[ArchitecturalClaim, ...],
    max_tokens: int = _DEFAULT_MAX_TOKENS,
) -> GeneratedComponentDoc:
    """Run the single documentation-writing LLM call for one component.

    Exceptions from ``model.complete_json`` propagate unmodified (the
    route maps them to its 503 unavailable contract). Once a reply is
    obtained, this function never raises over malformed content -- bad
    items are dropped/truncated deterministically.
    """
    reply = model.complete_json(
        system=COMPONENT_DOC_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": build_component_doc_user_prompt(
                    component_facts=component_facts,
                    claims_text=format_claims_for_prompt(claims),
                ),
            }
        ],
        max_tokens=max_tokens,
    )

    data = reply.data if isinstance(reply.data, dict) else {}
    purpose = str(data.get("purpose") or "").strip()[:_MAX_PURPOSE_CHARS]

    responsibilities: list[str] = []
    raw_responsibilities = data.get("responsibilities")
    if isinstance(raw_responsibilities, list):
        for raw in raw_responsibilities[:_MAX_RESPONSIBILITIES]:
            text = str(raw or "").strip()
            if text:
                responsibilities.append(text[:_MAX_NOTE_CHARS])

    valid_claim_ids = {claim.id for claim in claims}
    notes: list[RelationshipNote] = []
    discarded = 0
    raw_notes = data.get("relationship_notes")
    if isinstance(raw_notes, list):
        seen_claim_ids: set[str] = set()
        for raw in raw_notes:
            if not isinstance(raw, dict):
                discarded += 1
                continue
            claim_id = str(raw.get("claim_id") or "").strip()
            note = str(raw.get("note") or "").strip()
            if claim_id not in valid_claim_ids or not note or claim_id in seen_claim_ids:
                discarded += 1
                continue
            seen_claim_ids.add(claim_id)
            notes.append(RelationshipNote(claim_id=claim_id, note=note[:_MAX_NOTE_CHARS]))

    return GeneratedComponentDoc(
        purpose=purpose,
        responsibilities=tuple(responsibilities),
        relationship_notes=tuple(notes),
        discarded_relationship_notes=discarded,
        model=reply.model,
        tokens_in=reply.tokens_in,
        tokens_out=reply.tokens_out,
        latency_ms=reply.latency_ms,
    )
