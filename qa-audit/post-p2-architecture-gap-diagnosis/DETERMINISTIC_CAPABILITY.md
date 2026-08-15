# Deterministic Data Capability — Inventory and Concrete Clustering Exercise

Read-only investigation. No source or repository under test was modified.

## 1. Inventory of deterministic facts available after analysis

| Fact | Classification |
|---|---|
| File paths | deterministic observed fact |
| Package/directory structure | deterministic observed fact |
| Module (file) identity | deterministic observed fact |
| Classes/functions/methods (symbols) | deterministic observed fact (`ParsedSymbol`) |
| Containment (`parent_symbol_id`) | deterministic observed fact |
| Imports | deterministic derived fact (AST for Python, regex for JS/TS/JSX/TSX — `static_structure.py`) |
| Calls | deterministic derived fact — **Python-only** (`python_call_extractor.py`) |
| Inheritance | deterministic derived fact — **Python-only** (`python_inheritance_extractor.py`) |
| Source spans | deterministic observed fact (`SourceRegion`) |
| Relation resolution status | deterministic observed fact (`resolved`/`partial`/`unresolved`) |
| Dependency direction | deterministic observed fact (edge source/target) |
| Fan-in/fan-out | deterministic derived fact (not currently computed anywhere in the product, but computable from existing edge facts) |
| Entry-point candidates | not currently derived; no explicit signal exists today |
| Test/source/docs/examples distinction | not currently derived deterministically; only a directory-name coincidence (e.g. a folder literally named `tests/`) would hint at it — not a real classifier |
| Symbol names/signatures | deterministic observed fact |
| Decorators/annotations | not confirmed as separately modeled; not used by any grouping code today |
| Module docstrings | not consumed by the Overview/grouping pipeline today (module summaries are built from symbol names, not docstring text) |
| Existing summaries/descriptions | deterministic derived (f-string templates over real counts/names) — **never LLM-generated** on the deployed default path |

**Critical, repo-shape-dependent limitation:** `calls` and `inherits` are
extracted **only for Python** today (confirmed in code:
`analysis_controller.py`'s own comment, *"Python-only for now, matching
both extractors' current scope — no JS/TS relation extraction is attempted
here"*). For any JS/TS/JSX/TSX repository (which includes both of the
concrete repositories inspected in this investigation — `topic-similarity-
mvp`'s backend is 100% JS — and Flask's own frontend tooling class of
repos), **the only deterministic cross-file relation signal available for
richer clustering is `imports`.** This bounds every clustering strategy
below for a large fraction of real-world repositories the product must
support.

## 2. Structural grouping vs. semantic architectural naming — kept explicit

- **Structural grouping** = "these modules are graph-adjacent under a
  formally defined deterministic rule" (directory containment, import
  density, connected components, community detection). This is checkable,
  reproducible, and (for a fixed algorithm/library version) deterministic.
- **Semantic architectural naming** = "this group of modules collectively
  implements concept X" ("Authentication", "Reporting"). This is not a
  structural relation at all — see STRATEGY_COMPARISON.md's epistemic
  table. No deterministic mechanism inspected in this investigation can
  produce it truthfully; every deterministic naming shortcut available
  (majority filename token, first-alphabetical member, path fragment)
  either produces a non-answer or silently reintroduces the
  `_architecture_label`-style keyword-heuristic risk the project has
  already flagged once as unsafe to present as ground truth.

## 3. Concrete data-sufficiency exercise — `topic-similarity-mvp`

Repository actually inspected (Node/Express backend, JS only):
`backend/src/{config(7), controllers(31), middleware(2), services(50, flat),
utils(5)}` + `server.js`/`server.test.js` at root.

**What Phase B's current directory-only rule produces:** 6 top-level
sections. Five are reasonably sized; `services/` remains a 50-member flat
wall (Phase B does not recurse and `services/` has no subdirectories to
recurse into regardless).

**Real import-graph analysis performed** (built the actual `require()`
graph over all 51 non-test files):

- 88 real import edges; **76 of 88 (86%) cross directory boundaries** —
  meaning directory grouping is actively *hiding* most of the real coupling
  in this repository, not just failing to add detail to it.
- Whole-repository connected-component analysis collapses to one blob of
  48/51 files, dominated by two shared-infrastructure hub files
  (`config/database.js`, in-degree 17; `config/logger.js`, in-degree 9) —
  naive whole-graph clustering is **not usable as-is**; it requires
  deliberate hub-suppression before it produces anything meaningful.
- **Isolating just the `services/` subgraph** (the one directory Phase B
  currently cannot improve on) and running greedy modularity community
  detection found **5 real sub-clusters among the 26/50 files that have any
  sibling edge**, e.g. `{auth, email, notification, notificationEvent,
  submission}.service.js` and `{contextSimilarity,
  evaluationMetrics}.service.js`. 24/50 remain edge-isolated and would need
  a residual flat bucket regardless of method.

**Assessment against the required questions:**

- **Stable?** Deterministic for a fixed algorithm/library version (no
  randomness in the run); **not a canonically unique partition** — a
  different modularity implementation/tie-breaking rule could produce a
  different, still-defensible split. This matters: "deterministic" here
  means *reproducible*, not *the one true answer*.
- **Improves on directory grouping?** Yes, concretely, for the one section
  Phase B could not otherwise subdivide.
- **Generalizes cross-repository?** Doubtful as a universal default. It
  depends on (a) the language having any deterministic relation extraction
  at all beyond `imports` — most `SUPPORTED_LANGUAGES` entries are in the
  same JS/TS-only-imports boat as this repo, (b) the repository having real
  internal coupling rather than routing everything through shared hub
  files, and (c) hub-edge suppression being solved well, which is
  nontrivial algorithm design, not a drop-in library call.

## 4. Direct answer

**Can deterministic clustering identify useful higher-level structural
communities beyond directory grouping?** Yes, concretely demonstrated on
the flat `services/` directory of a real repository a participant actually
used — but only using `imports` (the one relation kind available for a
JS/TS repo), and only after nontrivial hub-suppression work; it is not a
trivial win, and its cross-repository reliability is unproven beyond this
one case.

**Can deterministic data assign meaningful semantic names to those
communities?** No. Every mechanism inspected either produces nothing
usable or is a keyword/lexical heuristic dressed as fact. This is not a
missing-feature gap; it follows directly from `PropositionKind`'s
deliberately closed vocabulary (see STRATEGY_COMPARISON.md) — there is
structurally no way to assert "this is Authentication" as a checkable fact
from relation edges alone.
