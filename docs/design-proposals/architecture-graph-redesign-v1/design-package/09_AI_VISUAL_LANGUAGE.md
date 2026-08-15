# 9. AI visual language

## The component

`AIInterpretationCard` — iris surface, iris hairline border, 3px left accent
bar, **pill corners**, `sparkles` icon, the words AI INTERPRETATION, and a
dashed rule above a permanent ground-truth line.

```
✦ AI INTERPRETATION                     cached from this run
Authentication & Sessions
Handles credential checks, token validation and the notifications
sent when a session or submission changes state.
↻ Regenerate
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
⋯ Structural cluster 1 · 5 modules, grouped by 6 real relations
```

## Rules

1. **Never without ground truth.** The deterministic identity is always
   visible below the AI content. A user who ignores the AI still sees what
   the analysis actually found.
2. **Never a verdict.** The component cannot render SUPPORTED / INSUFFICIENT
   EVIDENCE / CONTRADICTED, and cannot accept a status prop.
3. **Never automatic.** Generation is a click. Not on scroll, not on hover,
   not on navigation. Cached per run; a changed member set invalidates it.
4. **Never structural.** An interpretation cannot change membership, add an
   edge, or reorder anything.
5. **Four states, all normal:** unavailable (no model — the default),
   available, generating, generated. "Unavailable" is stated without apology.
6. **Iris is reserved.** It appears nowhere else in the product, in either theme.

## Where it appears

Overview cluster cards · group panel · Doc Studio section picker. Nowhere else.
