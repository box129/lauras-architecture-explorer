# 13. Responsive

Targets: 1920×1080, 1366×768, 1280×720.

| Element | ≥1600 | 1366 | 1280 | <1180 |
|---|---|---|---|---|
| Global nav | 52px, labels | 52px, labels | 52px, labels | icons only |
| Breadcrumb bar | 44px | 44px | 44px, middle crumbs truncate to `…` | current + parent only |
| Context panel | 348px fixed | 320px | overlay, opened from the panel button | overlay |
| Canvas controls | docked bottom-right, 36px | same | same | same |
| Region padding | 20px | 16px | 14px | 12px |
| Cluster grid | 3 up | 3 up | 2 up | 1 up |
| Evidence + source | side by side | side by side | side by side, source min 520px | stacked |

## Reclaimed space at 1366×768

The old layout spent 48 + ~96 (bottom bar) + 360 (rail) on chrome. The new one
spends 52 + 44 + 320, and the canvas controls float rather than reserve a strip:
**about 150px of vertical map space returned**, and the panel can be dismissed
entirely for a full-width canvas.

Rules: no design below 1280 assumes hover; expansions collapse to one level by
default at ≤1366 so a region fits without scrolling.
