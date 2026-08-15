What the canvas shows when there is nothing to draw, or the request failed.

```jsx
<StateCard icon="alert-triangle" tone="error" title="The map could not be built"
  message="The backend returned no projection for this run." action={<Button icon={<Icon name="refresh-cw" size={15} />}>Retry</Button>} />
```

Message says what happened and what to do — never "Oops" and never a bare spinner.
