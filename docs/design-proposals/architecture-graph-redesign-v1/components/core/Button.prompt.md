The text button used across Syntax Tree — pick the variant by role, not by looks.

```jsx
<Button variant="primary" size="lg" iconAfter={<Icon name="arrow-right" />}>Build architecture map</Button>
<Button variant="quiet" icon={<Icon name="message-square-text" size={14} />}>Ask about this</Button>
```

One `primary` per screen. Voice-rail actions are always `quiet`. `pill` is for recent paths and segment-like filters. Disabled buttons keep their label and drop to 48% opacity — never hide an action.
