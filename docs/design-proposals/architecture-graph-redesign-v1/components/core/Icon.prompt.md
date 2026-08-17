One lucide glyph that inherits the surrounding text color — use it anywhere the brand shows an icon.

```jsx
<Icon name="shield-check" size={17} />
```

Glyphs are **vendored** into `iconGlyphs` (sources in `assets/icons/`, copied from lucide-icons/lucide), so they
work offline and survive rasterisation — never swap this for a CDN fetch or a CSS mask. Names are lucide
kebab-case (`git-branch`, `folder-tree`, `waypoints`, `sparkles`, `chevron-right`). Color comes from the parent's
`color`; never set a fill. An unknown name logs a warning and renders nothing — add the glyph, don't draw one.
