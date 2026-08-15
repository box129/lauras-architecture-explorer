# 11. Theme system

Implementation: `../tokens/theme.css`. Specimen cards: Design System tab → Theme.

## Mechanism

- No attribute on `<html>` → follow `prefers-color-scheme`, and keep following it.
- `data-theme="light" | "dark"` → explicit, persisted in `localStorage`.
- The persisted value is the *preference* (`light`/`dark`/`system`), never a
  resolved colour.
- One control, two forms: compact icon group in the header, labelled row in Settings.

## Semantic tokens

| Concept | Light | Dark |
|---|---|---|
| background.app | `#F8F5F1` | `#131210` |
| background.surface | `#FCFAF7` | `#1C1B17` |
| background.elevated | `#FFFFFF` | `#24231E` |
| background.code | `#171821` | `#101018` |
| text.primary | `#1A1916` | `#F1EEE7` |
| text.muted | `#625F59` | `#A39E93` |
| border.default | `#DED8CF` | `#37342C` |
| action.primary | `#3D5A80` | `#8FB0D9` |
| structural.container | stone 4% tint / 46% border | same recipe, dark base |
| structural.cluster | white 62% over canvas / slate 26% border | dark recipe |
| ai.accent | `#6E4B8E` | `#C4A9E8` |
| verification.supported | `#755D00` | `#D9B84A` |
| verification.insufficient | `#A0522D` | `#D28C64` |
| verification.contradicted | `#873D31` | `#E08A79` |
| evidence.highlight | citrine 20% + 85% edge | citrine 22% + 90% edge |
| focus.ring | `#3D5A80` | `#8FB0D9` |

Tints are built with `color-mix`, so one base change re-derives the family.

## Dark is not an inversion

- The dark base is **warm charcoal**, not black — the product's paper character
  is a brand property, not a light-mode accident.
- Shadows switch from ink-tinted to true black at higher opacity, because a
  warm shadow disappears on a warm dark surface.
- Accents lighten rather than saturate, keeping AA against the dark surface.
- The epistemic distinctions are re-checked in dark: iris stays outside the
  status hues, the cluster border stays cooler than the region border, and the
  evidence highlight keeps its solid edge.
