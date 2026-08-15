The architecture trail, always visible in the top bar.

```jsx
<BreadcrumbTrail items={[{id:null,label:'Overview'},{id:'g1',label:'api_layer'},{id:'s1',label:'create_order'}]} onSelect={goToLevel} />
```

Labels are the real entity names — never "Level 2". The current item is plain ink text, not a button.
