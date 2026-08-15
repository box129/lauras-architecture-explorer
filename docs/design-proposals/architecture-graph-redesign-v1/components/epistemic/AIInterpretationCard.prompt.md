The only place a model is allowed to name something. Generation is always an explicit click.

```jsx
<AIInterpretationCard state="generated" name="Authentication & Sessions"
  description="Handles credential checks, token validation and session lifecycle."
  groundTruth="Structural cluster 1 · 5 modules" generatedAt="cached from this run" onRegenerate={regen} />
```

Hard rules: never render it without `groundTruth`; never let it carry SUPPORTED / INSUFFICIENT EVIDENCE / CONTRADICTED; never auto-generate on scroll, hover or navigation. `unavailable` is a normal, non-apologetic state — the default one, in fact.
