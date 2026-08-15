The row that ties a claim to real code.

```jsx
<EvidenceRow filePath="app/architecture_map/projection.py" startLine={112} endLine={140}
  reason="python_call_extractor@0.3.0 observed this call" preview="def project(...):" status="verified" onClick={openSource} />
```

Span text is mono and always exact. If there is no source region, drop `onClick` and say so in `reason` — silence or a dead button is worse.
