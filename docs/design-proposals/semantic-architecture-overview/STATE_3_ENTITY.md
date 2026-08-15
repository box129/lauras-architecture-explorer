# State 3 — Entity Focus (preserve, minimal extension)

Design-only document. Per the design brief, State 3 is a Phase A success
and must be preserved, not redesigned — this document specifies only the
one addition needed to keep it consistent with the new Overview/State 2.

## What is preserved unchanged

- Selected entity centered; real, one-hop dependencies/dependents
  surrounding it (`ArchitectureMapProjector.neighborhood()`, unmodified).
- Architectural Explanation panel, reachable/visible from this state
  exactly as today.
- Mini-map, zoom, fit-view (already present, `ArchitectureMapCanvas.tsx`).
- Selected-state visuals, focus handling.

## The one addition: group/cluster context stays visible

Today's breadcrumb already carries this implicitly
(`Overview > sansio > sansio/app.py > _make_timedelta`). The only new
requirement, now that a module may sit inside a Layer-2 structural cluster
in addition to a Layer-1 directory, is that the breadcrumb (and, where
space allows, a small contextual line under the entity title) reflects
**both** ancestors when both exist:

```
Overview  >  backend/src/services  >  Structural cluster 1  >  auth.service.js  >  login()
```

No new component: this is the same `ArchitectureLensCrumb[]` mechanism
extended to allow a Layer-2 crumb segment between a Layer-1 segment and the
entity — see `STATE_2_GROUP.md` for the identical extension already
required there. `useArchitectureLens.ts` needs no change beyond what
State 2 already requires, since it is generic over node id/kind (confirmed
during Phase B: zero lines changed in this hook to support the
`structural_group` kind).

## Optional, non-blocking nicety (not required for this phase)

`concept-03`'s neighbor cards each carry a colored domain-membership chip
(e.g. "Configuration", "Middleware"). This is a legitimate mockup element
this design does **not** commit to restoring now — it requires resolving
each neighbor's own Layer-1/2 membership at Entity Focus render time,
which is a real but bounded additional query. Flagged as a candidate for a
later phase, not blocking Phase C1–C5.

## Fidelity target: **90%**

This state was already close to its mockup structurally under Phase A.
The only gap versus 100% is the domain-membership chip on neighbor cards
(explicitly deferred above) and the per-relationship tabs
(Dependency Graph/Calls Made By/Calls Made To/File Details) `concept-03`
shows, which Phase A collapsed into a single Simple/Technical/Evidence tab
set — a deliberate simplification carried forward unchanged by this
document, not a regression introduced here.
