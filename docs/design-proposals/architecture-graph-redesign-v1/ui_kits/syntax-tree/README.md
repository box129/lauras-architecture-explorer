# UI kit — Syntax Tree Observatory

A click-through recreation of the app's real journey, built only from upstream code
(`syntax-tree-ui/src/features/observatory`, `architecture-map`, `architectural-explanation` and
`src/index.css`). Sample content describes Flask, the repository the upstream QA runs used.

**Flow:** entry screen → *Build architecture map* → live scan progress (stages, meter, orientation panel) →
*Open the map* → architecture map with node cards and edges → select a card → voice rail
(simple / technical / evidence) → open an evidence row → code companion with the cited line highlighted.
The top-bar menu → *Analyze another repository* returns to the entry screen.

**Files**
- `index.html` — mounts the kit; loads `styles.css`, `_ds_bundle.js`, then the screens.
- `data.js` — the fake run: nodes, edges, claims, evidence, orientation, stages.
- `EntryScreen.jsx` — entry + progress + orientation panel (`OrientationPanel` is exported for the rail's idle state).
- `ObservatoryScreen.jsx` — top bar, map canvas, voice rail, question dock, code companion.

**Deliberately omitted** (not visible in the source with enough fidelity to copy): the React Flow minimap and
zoom controls, the docs studio editor, the saved-lens drawer, the flow and question lens canvases, and the
settings overlay. Nothing here is invented UI.
