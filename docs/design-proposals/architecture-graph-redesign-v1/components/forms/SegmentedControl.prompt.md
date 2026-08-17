Analysis-mode / budget / scope selector from the entry screen's advanced settings.

```jsx
<SegmentedControl label="Budget" value={budget} onChange={setBudget}
  options={[{value:'strict',label:'Strict'},{value:'balanced',label:'Balanced'},{value:'max_quality',label:'Max quality'}]} />
```

Labels are sentence case. The active segment is slate text on a 9% slate tint — never a solid fill.
