A deterministic relation cluster inside a directory region — and the residual bucket for files nothing groups.

```jsx
<ClusterCard label="Structural cluster 1" memberCount={5} relationCount={6} members={members}
  aiSlot={<AIInterpretationCard state="available" groundTruth="Structural cluster 1 · 5 modules" onGenerate={gen} />}
  onOpenBasis={showBasis} onEnter={enter} />
<ClusterCard residual label="Ungrouped" memberCount={24} members={rest} />
```

The neutral label always stays visible above the AI slot. The residual bucket is required whenever files were left out — forcing them into a cluster would fabricate membership.
