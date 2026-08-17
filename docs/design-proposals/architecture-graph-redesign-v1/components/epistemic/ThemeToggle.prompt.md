Header and Settings theme control.

```jsx
<ThemeToggle value={theme} onChange={setTheme} />
<ThemeToggle value={theme} onChange={setTheme} variant="full" />
```

Resolve the preference in JS and always write the resolved value to `data-theme` on `<html>`; for `system`, listen to `matchMedia('(prefers-color-scheme: dark)')` and re-apply on change. Persist the preference (`light`/`dark`/`system`), never the resolved value.
