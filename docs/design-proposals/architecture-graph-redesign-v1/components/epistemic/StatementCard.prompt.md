The verified-statement component. Structurally different from `AIInterpretationCard` — square corners, left status bar, uppercase verdict, dot badge.

```jsx
<StatementCard statement="AuthController calls JwtService" status="supported" relation="calls · direct_relation" evidenceCount={3} onOpenEvidence={open} />
```

It cannot accept an AI-authored sentence, and `AIInterpretationCard` cannot accept a status — that separation is the product's core promise. Unproven statements stay visible and dashed, never hidden.
