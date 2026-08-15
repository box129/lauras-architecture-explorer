# Current Overview-Generation Pipeline (as of HEAD `fdd77aa`)

Read-only trace. No source was changed to produce this document.

## End-to-end path (deployed default: no live investigation model configured
for map routes — see LLM_ROUTING.md for why that's true regardless of user
settings)

```
repository on disk
  -> AnalysisController (parses source -> ParsedSymbol, SourceRegion facts;
     unrelated to this document, upstream of everything below)
  -> app/analysis/static_structure.py: build_static_structure(job, store)
       one OverviewComponent per readable, SUPPORTED_LANGUAGES file
         (kind="module", label=<repo-relative POSIX path>,
          summary=<deterministic sentence>, confidence=0.98 constant)
       + import-edge OverviewRelationship list (AST-based for Python,
         regex-based for JS/TS)
  -> app/overview/system_overview_generator.py:
       SystemOverviewGenerator.get_or_generate()
         -> _degraded_overview() whenever the resolved model is
            NoConfiguredModel() (the map routes' default, see LLM_ROUTING.md)
         -> produces a SystemOverview with
              main_components = the OverviewComponents above
              relationships   = the import edges above
              status = "ready" if components else "degraded_no_llm"
              repo_shape = hardcoded {"kind": "static_module_graph", ...}
  -> app/architecture_map/projection.py: ArchitectureMapProjector.project()
       1. root = _root_node()               (repo-level summary node)
       2. component_nodes = one ArchitectureMapNode per OverviewComponent
          (level=1, kind via _node_kind() keyword match -- irrelevant here
          since every component.kind=="module")
       3. Phase B: structural_fallback.group_overview_components(run_id,
          main_components) -- pure function, directory-containment only
          (see DETERMINISTIC_CAPABILITY.md for exactly what it uses)
            -> () if not file-shaped, or fewer than 2 directory/root
               sections would result (flat-repo degrade)
            -> otherwise: one ArchitectureMapNode per directory bucket,
               kind="structural_group", level=1
       4. level1_nodes = group_nodes if any, else component_nodes
       5. edges = root->level1_nodes "contains" edges (import-edge
          relationships never match a group id, see Phase B REPORT.md)
       6. ArchitectureMapProjection{root, nodes=(root,*level1_nodes), edges,
          diagnostics, metadata} cached by overview_input_hash
  -> api/dto/architecture_map.py: ArchitectureMapResponse.from_domain()
       generic ArchitectureMapNodeDTO/ArchitectureMapEdgeDTO -- same shape
       for a group, a module, or a symbol; no group-specific DTO exists
  -> api/routes/architecture_map.py: GET /api/architecture-map
       (and GET .../nodes/{id}, .../children, .../evidence, .../explanation,
       .../implementation -- all generic, dispatch on node id, see
       ArchitectureMapProjector.node()/.children())
  -> syntax-tree-ui/src/features/architecture-map/mapAdapter.ts:
       adaptArchitectureMap(response)
         topLevelNodes = response.nodes minus root
         isGroupedOverview = every visible node kind=="structural_group"
         adaptArchitectureNode() maps kind -> icon/accent (kindIcons/
           kindAccents lookup tables, both hardcoded frontend constants)
  -> mapLayout.ts: layoutArchitectureNodes() -- pure grid placement, no data
  -> ArchitectureMapCanvas.tsx (ReactFlow canvas) + LensNode.tsx (card
     rendering) + accessible <details> table (same fixture.nodes, mirrored)
```

## Field-by-field provenance (Overview / group card)

| Field shown to user | Provenance | Where |
|---|---|---|
| Repo title | source structure (`snapshot.repo_name`) | `system_overview_generator._repo_identity` |
| "N source module(s) linked by M ... relationship(s)" summary sentence | deterministic derived (f-string over real counts) | `_degraded_overview` |
| Group card label (`"routes"`, `"Repository root files"`) | deterministic observed fact (literal directory path / fixed sentinel string) | `structural_fallback._directory_group_node`/`_root_group_node` |
| Group "N modules" | deterministic derived (`len(members)`) | same |
| Group "Contains: a.py, b.py, ..." | deterministic derived (alphabetical slice, no ranking) | same |
| Group description sentence | deterministic derived (f-string template, not generated prose) | same |
| Group kind chip "repository section" | hardcoded frontend constant string keyed off `kind` | `LensNode.tsx` |
| Group icon/color | hardcoded frontend lookup table keyed off `kind` | `mapAdapter.ts` kindIcons/kindAccents |
| Group map confidence | absent by design (`None` — no metric exists) | `structural_fallback` (Phase B fix) |
| Module label (`"app.py"`) | source structure (real file path) | `build_static_structure` |
| Module "defines X, Y, Z, and N more" | deterministic derived (first 8 real symbol names) | `static_structure._module_summary` |
| Module confidence "98%" | **hardcoded constant** (`0.98`), not measured per-file | `static_structure.build_static_structure` |
| Symbol label/signature | source structure (real `ParsedSymbol`) | parsing stage (upstream) |
| Import edges | deterministic derived (real AST/regex parse of import statements) | `static_structure._python_import_targets`/`_js_import_targets` |
| `diagnostics.repo_shape` = `"static_module_graph"` | **hardcoded literal string**, not derived from repo content | `_degraded_overview` |
| Node `kind` for a real component (`component`/`external_boundary`/`cross_cutting`) | **heuristic** — closed keyword match over label+kind text | `projection._node_kind` (only reachable for LLM-classified components in this deployed default; every degraded-path component is `kind="module"` and only reaches `_node_kind` if not grouped) |
| "Verified" status badge | deterministic derived (`support_status`/evidence presence, not an LLM judgment) | `projection._node_status` |
| Anything LLM-generated | **none, anywhere in this pipeline** | the map routes always resolve `NoConfiguredModel()` unless a model is explicitly injected into `request.app.state.investigation_model` — see LLM_ROUTING.md |

## Answer to "does Phase B ignore any deterministic data it could use?"

Yes, partially — see DETERMINISTIC_CAPABILITY.md. Phase B's grouping input
is exactly `OverviewComponent.label` (a path string) and `directory
containment` derived from it. It does **not** currently consume the
`ObservedProgramRelation` layer (imports/calls/inheritance edges already
recovered elsewhere in the pipeline for Entity Focus / neighborhood
queries) as a grouping signal at all — directory containment is the only
signal Phase B's grouping function looks at.
