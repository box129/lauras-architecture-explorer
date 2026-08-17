The architecture map's card — an analyzed entity (238×104) or a repository section (`group`, larger, dashed-family styling).

```jsx
<LensNode label="architecture_map" kind="component" icon="network" accent="slate" status="verified"
  description="Projects parsed symbols into the map the frontend renders." evidenceCount={14} childrenCount={6} />
<LensNode group label="api_layer" icon="folder-tree" accent="stone" childrenCount={9}
  members={['routes', 'schemas', 'ws']} collapsedContainer />
```

Kind chip and drill-down chevron are always visible, never hover-only — a real user scrolled the map and never clicked because the affordance was hover-gated. Group cards say "repository section", never "domain".
