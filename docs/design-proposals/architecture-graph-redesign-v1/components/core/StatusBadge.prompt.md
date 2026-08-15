The evidence-status dot — the single most load-bearing mark in Syntax Tree; every claim, node and evidence row carries one.

```jsx
<StatusBadge status="verified" showLabel />
<StatusBadge status="insufficient" />
```

Never invent statuses or restyle the dots: shape (filled / half / hollow / dashed / slashed) does the work so the meaning survives without color. A dot always ships with its description via `title`/`aria-label`.
