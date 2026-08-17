# 19. Architecture graph — architecture-first Map canvas

The primary Overview is a **spatial architecture lens**, not a filesystem tree.
Repository containment remains available as provenance and as the secondary
**Outline** representation, but it no longer controls the user's first visual
impression.

Prototype: `ui_kits/lauras-graph/index.html`.

## 19.1 Visual hierarchy

The map foregrounds three different things:

| Visual object | Source of truth | Primary treatment |
|---|---|---|
| **Structural region** | deterministic repository containment | large enclosing frame (`Backend`, `Frontend`) with path as secondary metadata |
| **Architectural area** | a fixed deterministic section, positioned according to relation flow | medium subsystem card; optional AI name sits above the deterministic path/basis |
| **Structural cluster** | deterministic relation clustering | teal relation card inside its owning section, with module + relation counts |

A module appears only when the user zooms into or enters a cluster/area.

The default screen should therefore read visually as:

```
Frontend
   components -> app

Backend
   Request/API -> Application Services -> Configuration / Utilities
                      |  |  |  |  |
                    deterministic clusters
   Tests -----------> Application Services

Root / build files
```

not as:

```
backend
  backend/src
    backend/src/controllers
    backend/src/services
```

Paths remain visible as structural basis, but do not dominate the map.

## 19.2 Optional AI architectural interpretation

The model may propose only a **human-readable name + short description** for a
fixed area/cluster. In the prototype examples:

- `controllers` may be shown as **Request / API Layer**
- `services` may be shown as **Application Services**
- Structural cluster 1 may be shown as **Authentication & Sessions**

Every such name is visibly labelled **AI INTERPRETATION**. Turning AI labels
off restores the deterministic names (`controllers`, `services`, `Cluster 1`)
without changing geometry, membership, edge counts or navigation.

The AI never:

- changes cluster membership;
- creates an edge;
- changes a relation count;
- changes verification status;
- promotes an interpretation to `SUPPORTED`.

## 19.3 Relations are first-class

The graph is architecture-like because connectivity is visible at the same
level as containment.

Group-level edges are deterministic aggregates of member-level relations.
Example contract:

```
aggregate_count(A, B, imports) =
  count(resolved member relation r
        where r.source ∈ members(A)
        and r.target ∈ members(B)
        and r.kind = imports)
```

Default filter: **Strongest** (prototype threshold ≥ 6).

Available filters:

- Strongest
- All relations
- Imports
- Calls
- Inheritance
- None

Selection fades unrelated architecture and promotes the selected object's
incoming/outgoing relationships.

## 19.4 Semantic zoom

Zoom changes the *information level*, not merely the pixel size.

| Zoom | Level of detail |
|---|---|
| `< 68%` | top-level regions + architectural areas + strongest aggregate edges |
| `68–95%` | areas + deterministic clusters + representative members |
| `≥ 95%` | cluster members/modules and finer relation context |

At repository scale, users should never face hundreds of peer module nodes.

## 19.5 Expand vs Enter

- **Expand** reveals internal structure without changing scope.
- **Enter** makes an area/cluster the current architecture scope and pushes one breadcrumb level.

Entering `Application Services` shows its deterministic clusters as a graph.
Entering a cluster shows member modules connected by their concrete internal
relations. Back pops one scope level.

## 19.6 Map and Outline

**Map** is primary.

**Outline** is the compact/accessible structural representation. It mirrors the
same selection and scope, but is not the default architecture experience.

`Both` is useful on wide screens only. At laptop widths, the inspector and
Outline should not simultaneously crush the graph.

## 19.7 Inspector

The inspector is narrow and collapsible. It shows:

- selected architectural label;
- structural basis/path;
- module + relation counts;
- boundary relations;
- AI interpretation if generated;
- Enter action.

Run ids, projection ids, provider internals and fallback diagnostics never
appear here.

## 19.8 Repository-shape fallbacks

1. **Clear containment + useful relations** → architecture areas + clusters.
2. **Flat but relation-dense** → relation clusters become primary visual objects.
3. **Flat and relation-weak** → honest module overview plus a quiet residual set.
4. **Very large repository** → only a bounded number of top-level regions appear initially; children are lazy/progressive.

No semantic category is fabricated merely to make the screen attractive.

## 19.9 Production capability still required

The prototype uses authored coordinates. Production requires a containment-aware
auto-layout that:

1. ranks sibling areas using aggregate relation direction;
2. packs children inside their parent region;
3. sizes parents from child bounds;
4. reserves routing gutters;
5. routes cross-boundary edges without crossing unrelated regions;
6. reflows after expand/collapse;
7. keeps a stable mental map where practical.

This is a real graph-engineering task, not CSS-only restyling.
