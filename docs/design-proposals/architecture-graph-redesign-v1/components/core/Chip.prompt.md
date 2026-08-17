Metadata pill used in the voice rail, node meta rows and orientation panel.

```jsx
<Chip tone="clay" icon={<StatusBadge status="verified" />}>Verified</Chip>
<Chip tone="measure" title={MAP_CONFIDENCE_EXPLANATION}>72% map confidence</Chip>
```

Any number that is a static-analysis score uses `tone="measure"` (dashed, unfilled) so it can't be mistaken for a verification status — this is a product rule, not styling.
