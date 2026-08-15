# Refurbished Backend Implementation Architecture Plan

## Summary

The refurbished backend should be a small layered backend, not a large knowledge-graph platform.

The core internal model is:

```text
RepoSnapshot
OrientationItem
SourceRegion
ParsedSymbol
SemanticAnchor
SystemOverview
Lens
InvestigationTrace
```

Everything else is delivery, compatibility, storage, or tooling.

The frontend can remain mostly intact through compatibility adapters, but the new backend brain should stay simple:

```text
SystemOverview + Lens + SourceRegion + SemanticAnchor
```

## Architectural Layers

```text
API Layer
  -> Application Use Cases
  -> Core Domain
  -> Infrastructure Adapters
```

### API Layer

Owns HTTP routes, request/response DTOs, and frontend compatibility.

It should not own product intelligence.

### Application Use Cases

Owns workflows such as:

- build repo snapshot;
- index readable source;
- parse supported files;
- build orientation inventory;
- discover semantic anchors;
- run LLM investigation;
- generate system overview;
- create lenses;
- validate citations.

### Core Domain

Owns stable models and policies.

It should not know about FastAPI, SQLite, OpenRouter, Blackbox, or current frontend DTOs.

### Infrastructure Adapters

Owns practical implementation details:

- local filesystem;
- SQLite;
- tree-sitter;
- text search;
- LLM providers;
- retry/timeout behavior.

## Proposed File Tree

```text
syntax-tree-refurbished-backend/
  pyproject.toml
  README.md
  .env.example

  docs/
    DESIGN_STARTING_POINTS.md
    ARCHITECTURE_AND_FRONTEND_COMPATIBILITY.md
    IMPLEMENTATION_ARCHITECTURE_PLAN.md
    API_CONTRACT.md
    SYSTEM_OVERVIEW_SCHEMA.md
    EVIDENCE_BROWSER_SCHEMA.md

  src/
    syntax_tree_refurbished/
      __init__.py

      main.py
      config.py
      logging.py

      api/
        __init__.py
        app.py

        routes/
          health.py
          analyze.py
          runs.py
          system_overview.py
          architecture_map_compat.py
          source.py
          evidence_browser.py
          query.py
          docs.py
          frontend_compat.py

        dto/
          analysis.py
          system_overview.py
          lens.py
          source_region.py
          architecture_map_compat.py
          query_compat.py
          docs_compat.py

      core/
        __init__.py

        models/
          repo_snapshot.py
          file_record.py
          orientation.py
          source_region.py
          parsed_symbol.py
          semantic_anchor.py
          system_overview.py
          lens.py
          investigation.py
          support_status.py

        policies/
          trust_policy.py
          budget_policy.py
          citation_policy.py
          file_role_policy.py

        ports/
          storage.py
          file_system.py
          parser.py
          llm.py
          search.py
          clock.py

      app/
        __init__.py

        analysis/
          analysis_controller.py
          analysis_job.py
          analysis_progress.py
          analysis_pipeline.py

        indexing/
          build_repo_snapshot.py
          build_raw_source_index.py
          build_orientation_inventory.py

        parsing/
          parse_supported_files.py
          build_symbol_index.py

        anchors/
          discover_anchors.py
          rank_anchors.py
          relate_anchors.py

        evidence/
          evidence_browser.py
          region_expander.py
          outline_builder.py
          definition_finder.py
          reference_finder.py
          related_file_finder.py

        investigation/
          investigation_engine.py
          tool_loop.py
          prompt_builder.py
          grounding_gate.py
          citation_validator.py

        overview/
          generate_system_overview.py
          system_overview_cache.py

        lenses/
          create_component_lens.py
          create_question_lens.py
          create_docs_lens.py
          lens_store.py

        compatibility/
          architecture_map_adapter.py
          implementation_slice_adapter.py
          query_lens_adapter.py
          docs_adapter.py

      infra/
        __init__.py

        storage/
          sqlite/
            connection.py
            schema.py
            migrations.py
            repo_snapshot_store.py
            source_region_store.py
            symbol_store.py
            anchor_store.py
            overview_store.py
            lens_store.py
            investigation_store.py

          memory/
            memory_store.py

        filesystem/
          local_repo_reader.py
          file_classifier.py
          ignore_rules.py
          text_detection.py

        parsing/
          tree_sitter_parser.py
          python_adapter.py
          typescript_adapter.py
          javascript_adapter.py
          parser_capabilities.py
          fallback_outline.py

        search/
          fts_search.py
          simple_text_search.py

        llm/
          llm_client.py
          providers.py
          blackbox_provider.py
          openrouter_provider.py
          retry_policy.py
          response_parser.py

      prompts/
        system_overview.md
        component_lens.md
        question_lens.md
        docs_plan.md
        docs_generate.md
        grounding.md

  tests/
    unit/
      test_file_classifier.py
      test_source_regions.py
      test_orientation_inventory.py
      test_anchor_discovery.py
      test_evidence_browser.py
      test_citation_validator.py

    integration/
      test_analyze_realistic_app.py
      test_httpx_overview.py
      test_frontend_compat_architecture_map.py
      test_query_lens.py
      test_docs_from_overview.py

    fixtures/
      realistic_app/
      mini_http_client/
      legacy_mixed_app/
```

## Core Models

### RepoSnapshot

Represents what exists in the repo.

Fields should include:

- run ID;
- repo path;
- repo name;
- files;
- language counts;
- manifests;
- parser coverage;
- skipped file counts;
- created timestamp.

### SourceRegion

The source proof unit.

Fields should include:

- region ID;
- run ID;
- path;
- start line;
- end line;
- content hash;
- text;
- region type;
- token count;
- parser confidence.

Every code reference should ultimately point to one or more `SourceRegion` objects.

### OrientationItem

Represents README/docs/examples/manifests/config guidance.

Fields should include:

- ID;
- path;
- kind;
- title;
- headings;
- signals;
- summary;
- `proof_allowed=false`.

Orientation guides investigation. It does not prove runtime behavior by default.

### SemanticAnchor

Represents a behavioral door into the system.

Examples:

- HTTP route;
- CLI command;
- frontend screen;
- worker;
- cron job;
- webhook;
- DB schema;
- queue consumer;
- external API client;
- public export;
- plugin registration.

Fields should include:

- ID;
- anchor type;
- label;
- path;
- source region ID;
- confidence;
- extraction method;
- related symbols/files.

### SystemOverview

The canonical source-grounded understanding artifact for the current analysis run.

Fields should include:

- ID;
- run ID;
- title;
- summary;
- repo shape;
- components;
- relationships;
- anchor IDs;
- important source region IDs;
- gaps;
- suggested questions.

The architecture map, question agent, and docs generator should all start from this.

### Lens

The general response object.

A lens can represent:

- architecture view;
- component deep dive;
- question answer;
- behavior walkthrough;
- documentation context.

Fields should include:

- ID;
- run ID;
- lens type;
- title;
- summary;
- nodes;
- edges;
- steps;
- claims;
- source region IDs;
- gaps.

Flow Lens should not be a separate core primitive. If a lens needs steps, it has steps.

## Main Pipeline

The analysis pipeline should be simple and readable.

```text
1. create run
2. build repo snapshot
3. build raw source index
4. parse supported files
5. build orientation inventory
6. discover semantic anchors
7. generate system overview
8. mark run ready
```

Conceptually:

```python
snapshot = build_repo_snapshot(repo_path)
source_index = build_raw_source_index(snapshot)
symbols = parse_supported_files(snapshot)
orientation = build_orientation_inventory(snapshot)
anchors = discover_anchors(snapshot, symbols, source_index)
overview = generate_system_overview(snapshot, orientation, anchors, source_index)
```

The scan should not fully understand every file or behavior.

It should produce a strong overview and let deeper lenses happen on demand.

## Evidence Browser

The evidence browser lets the LLM inspect source like an engineer.

Core operations:

- `search_code(query, filters)`
- `search_files(query, filters)`
- `read_range(path, start, end)`
- `read_whole_file(path, max_tokens)`
- `read_enclosing_region(path, line, mode="auto")`
- `expand_region(region_id, mode)`
- `get_file_outline(path)`
- `find_definition(name_or_symbol)`
- `find_references(name_or_symbol)`
- `get_related_files(path)`

Each operation should return exact source regions or structured results with exact file paths and line ranges.

The LLM decides what kind of evidence it wants.

The backend resolves that into exact regions.

## Investigation Engine

The investigation engine should be controlled.

Input:

- objective;
- System Overview if available;
- relevant anchors;
- budget;
- evidence browser tools.

Output:

- Lens;
- InvestigationTrace.

Budgets should include:

- max tool calls;
- max source tokens read;
- max files opened;
- max time.

The LLM can reason, but the backend controls what source it receives.

## Grounding

The grounding gate validates citations.

It should check:

- cited region exists;
- file exists;
- line range exists;
- content hash matches;
- cited region was actually returned to the LLM;
- claimed support status is compatible with evidence.

Support statuses:

- verified;
- inferred;
- orientation_only;
- uncertain;
- unsupported;
- not_inspected.

## Frontend Compatibility

Current frontend DTOs must not define the internal backend.

Compatibility adapters should translate:

```text
SystemOverview -> ArchitectureMapResponse
OverviewComponent -> ArchitectureMapNodeDTO
Lens -> QuestionLensDTO
SourceRegion[] -> ImplementationSliceDTO
SystemOverview + Lens references -> docs plan/generate responses
```

Compatibility routes should include:

```text
GET /api/architecture-map
GET /api/architecture-map/nodes/{id}
GET /api/architecture-map/nodes/{id}/children
GET /api/architecture-map/nodes/{id}/explanation
GET /api/architecture-map/nodes/{id}/evidence
GET /api/architecture-map/nodes/{id}/implementation
GET /api/implementation-slices
GET /api/query-lenses/{id}
GET /api/files/{path}
```

The internal model should remain:

```text
SystemOverview + Lens + SourceRegion + SemanticAnchor
```

## Clean Endpoints

The cleaner future endpoints should include:

```text
POST /api/analyze
GET  /api/analyze/{job_id}/status
GET  /api/runs/{run_id}/snapshot
GET  /api/runs/{run_id}/orientation
GET  /api/runs/{run_id}/anchors
GET  /api/system-overview
POST /api/investigate
POST /api/query
POST /api/docs/plan
POST /api/docs/generate
GET  /api/source-regions/{id}
```

## Storage

Start with SQLite as a local cache/index, but do not make it the product brain.

Store:

- runs;
- files;
- source regions;
- parsed symbols;
- orientation items;
- semantic anchors;
- system overviews;
- lenses;
- investigation traces.

Avoid:

- giant semantic concept soup;
- duplicate explanation tables;
- separate precomputed flow subsystem;
- storing every intermediate guess as a core artifact.

## Build Order

Recommended implementation order:

```text
1. core models
2. repo snapshot
3. source regions
4. evidence browser
5. parser layer
6. orientation inventory
7. semantic anchors
8. system overview
9. architecture-map adapter
10. question/docs adapters
```

## Core Rule

Internally simple.

Externally compatible.

Do not let legacy DTOs shape the new backend brain.

