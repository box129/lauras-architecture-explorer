A claim plus its verification status; click to reveal the evidence chain.

```jsx
<ul style={{display:'grid',gap:10,padding:0,margin:0}}>
  <ClaimCard statement="create_order calls OrderRepository.save" supportStatus="supported" relation="direct relation: calls">
    <EvidenceRow filePath="app/orders/service.py" startLine={48} endLine={61} reason="python_call_extractor@0.3.0 observed the call" status="verified" />
  </ClaimCard>
  <ClaimCard statement="OrderService publishes to the event bus" supportStatus="insufficient_evidence" relation="inferred relation: publishes" />
</ul>
```

Hard rule: an insufficient or contradicted claim is muted and dashed, always carries its caption and disclaimer, and never reads with a supported claim's confidence.
