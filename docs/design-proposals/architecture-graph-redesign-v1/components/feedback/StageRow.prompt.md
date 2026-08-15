Analysis progress, one stage per row, two columns on desktop.

```jsx
<StageRow state="done" label="Reading source files" />
<StageRow state="current" label="Building the code graph" />
<StageRow state="waiting" label="Tracing flows and frontend bridges" />
```

Always translate pipeline stage ids into human copy (`graph_index` → "Building the code graph"). Failed and skipped states are distinct colors *and* distinct icons.
