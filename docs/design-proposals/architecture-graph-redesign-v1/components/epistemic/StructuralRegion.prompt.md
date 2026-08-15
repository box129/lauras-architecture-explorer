The Overview's containment box. Nest it to show real directory hierarchy.

```jsx
<StructuralRegion path="backend" moduleCount={51} onToggle={t} onEnter={e}>
  <StructuralRegion path="src/services" moduleCount={50} depth={1} onToggle={t2} />
</StructuralRegion>
```

Toggle expands in place (no navigation); Enter pushes a breadcrumb. Keep the path monospace — it is a fact, not a label.
