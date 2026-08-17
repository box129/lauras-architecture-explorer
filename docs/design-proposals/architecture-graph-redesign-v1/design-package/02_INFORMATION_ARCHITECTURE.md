# 2. Information architecture

## Five kinds of fact, five visual treatments

| Layer | What it is | Shape | Icon | Word | Colour |
|---|---|---|---|---|---|
| **L1 Structure** | real directory containment | enclosing region, 1.5px solid border, 12px radius, header bar | `folder-tree` | STRUCTURE | neutral stone |
| **L2 Cluster** | relation-derived grouping | nested card, 1px border, **4px radius** (deliberately squarer than everything else), inset from its parent | `waypoints` | STRUCTURAL CLUSTER | slate |
| **L3 AI interpretation** | model-authored name/description | **pill-cornered** callout with a 3px left bar, always above a neutral ground-truth line | `sparkles` | AI INTERPRETATION | iris (outside every other palette) |
| **L4 Verified statement** | verifier output | left status bar + uppercase verdict + shape-coded dot; dashed border when not supported | `shield-check` / status dot | SUPPORTED / INSUFFICIENT EVIDENCE / CONTRADICTED | citrine / clay / muted red |
| **L5 Evidence** | file + line range | monospace locator row, numbered chain | `file-code-2` | evidence kind (call site, definition, import) | neutral |

Four independent channels carry the distinction — **shape, icon, word,
colour** — so removing any one of them (greyscale, dark mode, screen reader)
still leaves three.

## Hard separations

- `AIInterpretationCard` cannot accept a verification status; `StatementCard`
  cannot accept an AI sentence. Enforced in the props contract, not by convention.
- A structural group is never labelled "verified".
- No numeric confidence is shown where no meaningful value exists. The old
  "map confidence not available" line is removed rather than rephrased.

## Navigation model

```
Projects ──▶ Architecture ──▶ Doc Studio ──▶ Settings      (global, always)

Overview  ›  Region  ›  Cluster  ›  Module  ›  Statement    (breadcrumb, one stack)
```

- **One Back.** One control, one meaning: pop exactly one crumb. Browser Back
  is bound to the same stack. There is no "Close", no "Back to parent", no
  "Exit".
- **Expansion is not navigation.** Expanding a region in place changes nothing
  in the breadcrumb, the URL or the history. Entering a region pushes one crumb.
- Crumb click truncates the stack to that point.

## Vocabulary cleanup

| Was | Now | Where the old string goes |
|---|---|---|
| `system-overview-architecture-map-v3` | — | Settings → Technical details |
| "fallback no llm" | "No model configured. Analysis is unaffected." | product copy |
| "map confidence not available" | removed | — |
| "0 evidence" | "no evidence found" | product copy |
| "child areas" | "modules" / "sections" | product copy |
| run hash | "analysed 6 minutes ago", hash behind Technical details | Settings |
| "Claim" | "Architectural statement" | product copy |
| "Areas · links" | "51 source modules · 1 region · 6 sections · 5 clusters" | product copy |
