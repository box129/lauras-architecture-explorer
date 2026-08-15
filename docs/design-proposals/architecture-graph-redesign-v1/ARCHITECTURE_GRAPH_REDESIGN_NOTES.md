# Architecture graph redesign notes

This package is a **design prototype revision**, not production Laura's code.

Goal: make the high-level map read as a software architecture graph rather
than a filesystem hierarchy.

Key prototype changes:

- architecture-first spatial composition;
- directory paths demoted to secondary structural basis;
- `Backend` / `Frontend` remain truthful containment frames;
- relation-oriented backend areas laid out by connectivity;
- service relation clusters foregrounded;
- optional AI semantic names visually attached to fixed deterministic groups;
- stronger aggregate relation arrows and filters;
- quiet residual/ungrouped treatment;
- semantic zoom, Map/Outline, minimap and entity focus retained;
- dark mode is the default review state.

Semantic names shown in the prototype are **AI interpretation design examples**.
They must not be hard-coded as verified architecture in production.

Syntax validation performed locally:

- `graph-data.js`: `node --check` PASS
- `GraphCanvas.jsx`: TypeScript JSX parse/emit PASS
- `GraphScreens.jsx`: TypeScript JSX parse/emit PASS
- inline JSX in `index.html`: TypeScript JSX parse/emit PASS

See:

- `reference/architecture-first-target.png`
- `design-package/19_ARCHITECTURE_GRAPH_SPEC.md`
- `design-package/20_ARCHITECTURE_FIRST_RECOMPOSITION.md`
