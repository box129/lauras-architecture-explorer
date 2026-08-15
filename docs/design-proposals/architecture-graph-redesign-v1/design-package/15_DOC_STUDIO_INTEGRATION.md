# 15. Doc Studio

Doc Studio becomes the **export end of exploration**, not a separate tool.

## Model

A section picker, where each section is one provenance layer and carries its
chip into the export:

- Repository structure — STRUCTURE
- Structural clusters, with the relations that justify them — STRUCTURAL CLUSTER
- Verified statements, each with its own verdict and evidence links — VERIFIED
- AI-interpreted architecture (unverified) — AI INTERPRETATION, off by default

## Rules

- Provenance survives the export. A document is exactly the artifact that gets
  read out of context, so the marking has to travel with it.
- Statements export per-statement with their verdicts. They are never flattened
  into prose.
- Only interpretations the user actually generated can be included — Doc Studio
  never generates them silently.
- No bulk "what this repository does" narrative. Every AI sentence traces to one
  inspectable cluster or statement.
- Entry points: global nav, and an "Add to document" action on any group or
  statement (later phase).

---

## Final revision — Doc Studio AI configuration

The previous copy ("Doc Studio uses a separate deployment-level model
configuration that is not exposed here") described an implementation boundary
and has been removed from the product surface. A second, hidden configuration
mechanism is not an acceptable user mental model.

**Target experience.** Doc Studio's AI content uses the single provider
configured in *Settings › AI*. Doc Studio itself exposes no provider or model
setting; it shows one line of attribution next to Export:

> AI sections use the provider set in Settings › AI. No separate configuration.

**Implementation work required** (tracked as B-4 in
`17_IMPLEMENTATION_PRIORITIES.md`): route Doc Studio generation through the
same provider resolution as architectural explanation and group interpretation,
and retire the deployment-level model config as a user-visible fallback. Until
that lands, Doc Studio exports deterministic sections only when no provider is
configured — which is the same rule as every other AI surface, so the mental
model stays intact.
