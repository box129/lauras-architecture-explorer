# Settings — AI Mental-Model Redesign

Design-only document. Directly addresses post-P2 diagnosis finding: the
current Settings panel (`SettingsPanel.tsx`, titled "Architectural
Explanations") lets a user reasonably infer that enabling AI affects more
of the product than it actually does — confirmed by live, read-only
inspection (`qa-audit/post-p2-architecture-gap-diagnosis/LLM_ROUTING.md`):
saving Provider/Model/Enabled only ever changes the model behind the
entity-only Architectural Explanation panel; it has zero effect on
Overview, group drill-down, Entity Focus, or (in this deployment) Doc
Studio.

## Revised Settings copy — explicit surface list

Replace the current single-purpose framing with an explicit map, updated
to include the new Layer-3 surface this design proposes:

```
AI features enabled for:
  ✓ Architectural Explanation  (per-entity claims, when you open one)
  ✓ Architecture group interpretation  (optional name/description for a
    deterministic structural cluster, generated only when you click
    "Generate AI interpretation")

Always deterministic, no AI involved:
  • Source analysis and symbol extraction
  • Import / call / inheritance relation extraction
  • Structural grouping and clustering (which modules belong together)
  • Evidence verification (SUPPORTED / INSUFFICIENT EVIDENCE / CONTRADICTED)

Architecture Overview and Repository Sections work fully without any AI
configured.
```

This is a direct, mechanical translation of the surface-by-surface table
already produced in `LLM_ROUTING.md` — nothing here requires new
investigation, only presenting what was already traced.

## Two configuration boundaries — should they stay separate?

The diagnosis found two non-overlapping boundaries: (1) the
Settings-UI-controlled Architectural Explanation model, and (2) an
env-var-only "investigation model" with no UI at all, gating Doc Studio
and (structurally, though currently unreachable via any UI path) the map
routes. This design does not propose merging them technically — but it
does propose that **the Settings screen must at least state that boundary
(2) exists and is not user-configurable today**, rather than let its
silence imply there is nothing else to configure. Whether boundary (2)
should eventually get its own UI control is a product decision outside
this design's scope (it touches Doc Studio's provider gating, listed
below) — flagged, not decided here.

## Doc Studio's environment-variable gating — still defensible?

**Assessment: defensible to keep as-is for this design pass, but the
silence should end.** Doc Studio falling back to `make_live_model(settings)`
(boundary 2) only when `SYNTAX_TREE_LLM_PROVIDER` is set is a legitimate,
deliberate choice — it is a heavier, repo-wide generation feature, and
env-var gating is a reasonable extra deployment-level safety rail beyond
per-feature settings for something that heavy. What is **not** defensible
is a user having no way to discover this from the product itself. The
minimum fix (design-only, not implemented here): Settings should state
plainly that Doc Studio uses a separate, deployment-level configuration
not exposed in this screen, rather than leaving a user to infer it from
silence — same principle as the explicit surface list above, applied to
the one surface that genuinely isn't reachable from Settings.

## Not proposed here

- No change to where credentials are stored (still process-local/in-memory
  per `LLM_ROUTING.md`'s finding — a separate, legitimate hardening
  question, out of scope for this design pass).
- No new "advanced"/reasoning-effort tier — the diagnosis found no evidence
  Participant #2 needed one; the actual gap was scope-communication, not a
  missing dial.
- No change to the map routes' hard `NoConfiguredModel()` gate — that
  remains correct and is the mechanism this design's Layer-3 "explicit
  generate button" pattern is built to respect, not bypass.
