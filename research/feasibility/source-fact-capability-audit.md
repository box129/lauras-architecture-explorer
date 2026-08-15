# Source-Fact Capability Audit — Laura's / syntax-tree-refurbished-backend

**Scope:** deterministic, non-LLM "structural comprehension" layer only (parsing, extraction, storage, and the API surfaces that serve raw facts). The LLM-assisted layer (system overview generation, component-lens drilldown, investigation engine) is out of scope except where it is the *only* consumer of a deterministic fact — those cases are flagged explicitly.

**Baseline audited:** commit `689c36d` (frozen accepted V1 baseline), branch `research/source-fact-audit`, path `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/`.

**Method:** every claim below is based on reading the actual extractor/model/route code (file + line evidence cited inline) and cross-checked against `syntax-tree-refurbished-backend/tests/*.py` where a corroborating test exists.

---

## 1. Summary Capability Matrix

| Fact / relation | Status | One-line note |
|---|---|---|
| File identity (path + hash) | **SUPPORTED RELIABLY** | Repo-relative POSIX path + SHA-256 content hash, computed by `os.walk`; stable within a run. |
| Modules (Python/JS/TS) | **SUPPORTED RELIABLY** | One `OverviewComponent(kind="module")` per readable file in a deep-parse language; deterministic id. |
| Classes (Python) | **SUPPORTED RELIABLY** | Extracted via stdlib `ast.ClassDef`; exact span, nesting, signature. |
| Classes (JS/TS) | **PARTIALLY SUPPORTED** | Regex/brace-counting parser, not a real AST; can mis-close blocks with unusual brace styles. |
| Functions/methods (Python) | **SUPPORTED RELIABLY** | `ast.FunctionDef`/`AsyncFunctionDef`; captures async, params, exported flag. |
| Functions/methods (JS/TS) | **PARTIALLY SUPPORTED** | Same regex parser; only common declaration forms matched; arrow-in-object-literal methods etc. missed. |
| Functions/classes (any other language: Go, Rust, Java, Ruby, PHP, C#, C/C++, Kotlin, Swift…) | **NOT CURRENTLY SUPPORTED** (as structured symbols) | Only a best-effort, low-confidence line-outline exists via `EvidenceBrowser._code_outline`; no `ParsedSymbol` rows are ever created. |
| Containment (module→class→method, class→nested class) | **SUPPORTED RELIABLY** (Python) / **PARTIALLY SUPPORTED** (JS/TS) | `parent_symbol_id` chain; Python nesting via AST recursion is exact, JS/TS via a brace-depth heuristic. |
| Imports (module-level, intra-repo) | **PARTIALLY SUPPORTED** | Deterministic edges built separately in `static_structure.py`, not attached to individual `ParsedSymbol`s; only resolves imports whose target is another file in the same snapshot; no external/third-party import facts; JS side is regex, not AST. |
| Calls (function/method call graph) | **NOT CURRENTLY SUPPORTED** | No call-site or call-edge model exists anywhere in `core/models`; "find references" is literal text search, not call resolution. |
| Inheritance / interfaces (extends/implements) | **NOT CURRENTLY SUPPORTED** | Python `ast.ClassDef.bases` are read by the parser's own AST walk but never captured into `ParsedSymbol` or any relation; TS `interface` is only a symbol *kind*, no `implements`/`extends` edges. |
| Routes/endpoints (in analyzed target repos) | **PARTIALLY SUPPORTED** | Regex-detected `http_route` semantic anchors for common decorator/route-table/JS router patterns only; not AST-based, not framework-aware beyond simple call/decorator shapes. |
| Database/data-access relations (ORM models, queries) | **PARTIALLY SUPPORTED** | Narrow heuristic: file-path signals ("migration", "schema.prisma", SQL DDL keywords) + a single-string-match on class signature (`(Base)`, `models.Model`, `sqlmodel`); no field/column extraction, no query-level facts. |
| Source spans (exact line ranges) | **SUPPORTED RELIABLY** | Every symbol/anchor/region carries `start_line`/`end_line`, content-hash-bound, exposed via `/api/evidence/read-range`. Column-level spans are **NOT SUPPORTED** (line granularity only). |
| Stable symbol IDs across re-analysis of same code | **NOT CURRENTLY SUPPORTED** | ID hash includes a fresh random `run_id` (`run:{uuid4().hex}`) every analysis, so identical code re-analyzed gets entirely different symbol/region/anchor IDs. IDs *are* deterministic and idempotent **within** one run. |
| Run isolation (no cross-run leakage) | **SUPPORTED RELIABLY** | Store is keyed by `run_id`; `CitationValidator` explicitly rejects a region/symbol whose `run_id` doesn't match the requesting run; API layer requires an explicit/resolved `run_id` and never silently mixes runs. |
| Package/manifest boundaries (package.json, pyproject.toml, go.mod, Cargo.toml, etc.) | **SUPPORTED RELIABLY** | Deterministic manifest detection + package-name parsing for 6 ecosystems. |
| Semantic anchors — CLI/worker/cron/webhook/queue/external-API/plugin-registry/deployment/auth-boundary/public-export/frontend-screen | **PARTIALLY SUPPORTED** | All regex/path-heuristic based with attached confidence scores (0.6–0.92) and an explicit `status` of `source_detected` vs `candidate`; genuinely source-backed spans, but pattern coverage is narrow and framework-specific. |
| "Find references" | **NOT CURRENTLY SUPPORTED** (as symbol references) | Literally implemented as `search_code()` text search relabeled with `method="text_search_fallback"`; no symbol-resolution semantics. |
| "Find definition" | **PARTIALLY SUPPORTED** | Substring/keyword scoring over parsed-symbol names, not exact reference→definition resolution; works well for exact-name queries only. |
| File outline for non-deep-parse languages | **PARTIALLY SUPPORTED** | Falls back to a generic multi-language regex outline (`_code_outline`) with confidence 0.55; not a `ParsedSymbol`. |
| Flows (behavioral/request flows) | **NOT CURRENTLY SUPPORTED** | `/api/flows` is a hardcoded stub returning `{"flows": [], "total": 0}`; `/api/flows/{id}` always 404s. |
| Docstrings / comments as structured facts | **NOT CURRENTLY SUPPORTED** | Not extracted into any field; only implicitly present as raw text inside a symbol's source region. |
| Decorators as structured facts | **NOT CURRENTLY SUPPORTED** | Present only as raw text inside the region/signature string; not modeled as a relation or list. |
| Staleness detection (`is_stale`) | **NOT CURRENTLY SUPPORTED** | Modeled field exists on `ArchitectureMapEvidence`/`ImplementationSourceTab` but is hardcoded `False` at every call site — never computed. |
| Durable persistence of System Overview / Architecture Map / Lens across backend restart | **NOT CURRENTLY SUPPORTED** | `SQLiteRunStore` persists jobs, snapshot, symbols, orientation items, anchors, regions, and stages — but does **not** override `put_system_overview`/`put_architecture_map`/`put_lens`, so those are lost on restart (in-memory only, even when SQLite is configured). |

---

## 2. Detailed Findings by Fact Category

### 2.1 Repository / file identity

- **Extractor:** `infra/filesystem/local_repo_reader.py::LocalRepoReader.build_snapshot` / `_inspect_file`.
- **Stored model:** `core/models/file_record.py::FileRecord` (`path`, `language`, `role`, `status`, `readable`, `size_bytes`, `line_count`, `content_hash`, `extension`), aggregated in `core/models/repo_snapshot.py::RepoSnapshot`.
- **API/service:** `GET /runs/{run_id}/snapshot` (`api/routes/runs.py`, DTO `api/dto/snapshot.py::RepoSnapshotDTO`), `GET /source/files` (`api/routes/source.py`).
- **Identity scheme:** repo-relative POSIX path (`abs_path.relative_to(root).as_posix()`) is the primary key; content identity is a full SHA-256 of file bytes (`_hash_file`, chunked read). No separate synthetic file ID — path is the ID, scoped implicitly by `run_id` on the containing `RepoSnapshot`.
- **Source span:** not applicable (whole-file granularity).
- **Run-scoped:** yes — one `RepoSnapshot` per `run_id`, no cross-file-record leakage possible since `FileRecord` doesn't carry global identity, only appears inside a run's snapshot.
- **Limitations:** symlinked files are explicitly skipped (`abs_path.is_symlink()` check); files over `max_file_size_bytes` or `max_lines_per_file` are recorded as `skipped_too_large` with `readable=False` (path/hash still known, content not); binary detection is a crude heuristic (`text_detection.py::looks_binary` — null-byte or >30% control-byte ratio in first 8KB), so some genuinely binary files could slip through as "readable" text with `errors="replace"` mangling.

### 2.2 Modules

- **Extractor:** `app/analysis/static_structure.py::build_static_structure`.
- **Stored model:** `core/models/system_overview.py::OverviewComponent` (`kind="module"`) — **note this is not a dedicated "Module" dataclass**; modules are represented as a generic overview component with `related_file_paths=(path,)`.
- **API/service:** exposed indirectly through `/runs/{run_id}/architecture-map` (module nodes) and `/query` local-search candidates (`app/query/local_search.py`); no dedicated `/modules` endpoint.
- **Source span:** a truncated whole-file-ish region (`read_range(path, 1, min(line_count, 2000))`), not an exact "module declaration" span — this is a convenience region, not a parsed boundary.
- **Run-scoped:** `OverviewComponent.id` is computed by `module_component_id(run_id, path)` (sha1 of `run_id|path`), so yes, scoped to `run_id`, though the dataclass itself carries no explicit `run_id` field (see §2.13 caveat).
- **Limitations:** module concept only exists for the 5 `SUPPORTED_LANGUAGES` in `static_structure.py` (`python, javascript, typescript, tsx, jsx` — note `tsx`/`jsx` are listed here as separate "languages" even though `file_classifier.py` never actually classifies any file as language `"tsx"` or `"jsx"`, only `"typescript"`/`"javascript"` — dead branches).

### 2.3 Classes

- **Extractor (Python):** `app/parsing/python_symbol_parser.py::parse_python_symbols`, using `ast.parse` + `ast.ClassDef` walk.
- **Extractor (JS/TS):** `app/parsing/js_ts_symbol_parser.py::parse_js_ts_symbols`, regex `^\s*(export\s+)?class\s+([A-Za-z_$][\w$]*)` plus a brace-depth stack to find the closing line.
- **Stored model:** `core/models/parsed_symbol.py::ParsedSymbol` (`kind="class"`).
- **API/service:** `GET /runs/{run_id}/symbols`, `GET /source/files/{path}/symbols` (`api/routes/symbols.py`, DTO `ParsedSymbolDTO`).
- **Source span:** exact `start_line`/`end_line` for Python (from `node.lineno`/`node.end_lineno`, i.e. real AST end line); JS/TS end line is computed by `_find_region_end` brace counting, which is heuristic.
- **Run-scoped:** yes, `run_id` field on `ParsedSymbol`, embedded in `_stable_symbol_id`.
- **Limitations:** Python `ClassDef.bases`, decorators, and metaclass keywords are visible to the AST walk but **discarded** — only `node.name`, line span, and a fixed `signature=f"class {node.name}"` string are kept. JS/TS class parsing is confirmed fragile by design comment ("Lightweight JavaScript/TypeScript symbol parser") and by its own brace-counting `_find_region_end`/`_brace_depth` helpers, which will misbehave on braces inside strings/template literals/regex/comments (no tokenizer, just `line.count("{")`).

### 2.4 Functions / Methods

- **Extractor (Python):** same file as above; `ast.FunctionDef` / `ast.AsyncFunctionDef`, kind is `"method"` if nested under a class else `"function"`.
- **Extractor (JS/TS):** same file; separate regex set for function declarations, arrow-function const assignments, and a generic `_match_method` regex used only while inside a tracked `class_stack`.
- **Stored model / API:** same as classes (`ParsedSymbol`, `kind` in `{"function","method"}`).
- **Source span:** Python exact (`ast` end_lineno); JS/TS end line via same brace-counting heuristic.
- **Run-scoped:** yes.
- **Limitations:**
  - Python: `exported` for a function is `not parent_name and not name.startswith("_")` — a purely name-convention heuristic, not `__all__`-aware (unlike the separate `__all__` handling done only for semantic-anchor `public_export` detection in `discover_semantic_anchors.py`, which is a *different* code path).
  - JS/TS: `_match_declaration`/`_match_method` only catch `function foo(...)`, `const foo = (...) => `, `const foo = async foo2 =>` variants, and bare `name(args) {` inside a class. Object-literal methods (`{ foo() {...} }`), class fields defined as arrow functions with complex generics, decorators (`@Injectable()`), and multi-line signatures are not matched or are matched incorrectly since the regex operates per single line (`for index, line in enumerate(lines...)`, no lookahead across lines for the signature itself, only for the body-end search).
  - No other language (Go/Rust/Java/Ruby/PHP/C#/C/C++/Kotlin/Swift/SQL) produces any `ParsedSymbol` at all — confirmed by `app/parsing/parser_capabilities.py::DEEP_PARSE_LANGUAGES = ("javascript", "python", "typescript")` and by test `test_unsupported_language_keeps_fallback_outline_and_raw_reading` in `tests/test_parser_precision.py`, which explicitly asserts `symbols == ()` for a `.go` file.

### 2.5 Containment (file→class→method, class→nested class)

- **Extractor:** implicit in the recursive `visit_body` (Python) / `class_stack` (JS/TS) parsers; expressed via `ParsedSymbol.parent_symbol_id`.
- **Stored model:** `ParsedSymbol.parent_symbol_id: str | None`.
- **API/service:** consumed by `app/architecture_map/projection.py::_module_children` / `_symbol_children` to build `contains` edges (`ArchitectureMapEdge(kind="contains")`) in the architecture-map graph endpoint.
- **Source span:** inherited from each symbol's own span.
- **Run-scoped:** yes (parent lookup is always filtered to `store.get_symbols(run_id)` in `_static_symbol`).
- **Limitations:** Python containment is exact and recursive to arbitrary depth (nested classes, closures). JS/TS containment is **flat, one level only** — `parse_js_ts_symbols` tracks a single `class_stack` and only assigns `parent_name` for `kind == "method"`; nested classes, functions nested in functions, or class-in-function patterns are not linked (`parent_id=None` is hardcoded for all JS/TS symbols regardless of actual nesting — read the code: `_symbol(..., parent_id=None)` is passed unconditionally for both declaration and method branches).

### 2.6 Imports

- **Extractor:** `app/analysis/static_structure.py::build_static_structure` → `_python_import_targets` (real `ast.Import`/`ast.ImportFrom` walk with package-relative resolution) and `_js_import_targets` (regex `JS_IMPORT_RE` over `import ... from '...'`, `export ... from '...'`, `require('...')`).
- **Stored model:** `core/models/system_overview.py::OverviewRelationship` (`label="imports"`, `from_component_id`/`to_component_id` = module `OverviewComponent` ids) — **not** attached to individual `ParsedSymbol`s, i.e., there is no per-import-statement fact, only a deduplicated module→module edge.
- **API/service:** surfaces only through the architecture-map projection (`/runs/{run_id}/architecture-map`) as `imports`-kind edges between module nodes; no dedicated `/imports` endpoint.
- **Source span:** `source_region_ids=source.source_region_ids[:1]` — points at the *importing module's* truncated whole-file region, not the specific `import` line.
- **Run-scoped:** yes, ids embed `run_id`.
- **Limitations (concrete):**
  - Python resolution only succeeds if the imported module maps to a path *already known in the same snapshot* (`module_paths.get(module)` against `known_paths`); **third-party/stdlib imports produce no edge at all** (silently dropped, not represented as "external" edges).
  - JS/TS: only relative imports (`module.startswith(".")`) are resolved (`if not module.startswith("."): continue`); bare-specifier imports (`import x from 'react'`) and TS path-alias imports (`@/lib/foo`) are never resolved.
  - Both directions are collapsed to a single `imports` edge kind and deduplicated per `(source, target)` pair — multiple distinct imported symbols from the same file collapse into one edge with no symbol-level detail (i.e., "file A imports file B" is knowable; "which specific names A imports from B" is not persisted as a fact).
  - No cross-run/global import graph; recomputed fresh per run from files present in that run's snapshot only.

### 2.7 Calls (function/method call graph)

- **Extractor:** none. Confirmed by full-codebase search for `Call`/`call_graph`/`CallGraph`/relation constructs — no file in `app/parsing`, `app/indexing`, `app/analysis`, or `core/models` builds call edges.
- **Stored model:** none exists.
- **API/service:** `POST /evidence/find-references` (`api/routes/symbols.py`) is the closest thing, but its implementation (`app/evidence/evidence_browser.py::find_references`) is literally `self.search_code(query=query, ...)` relabeled — a plain multi-term, case-insensitive line-text search across all readable files, explicitly tagged `method="text_search_fallback"` in both the code and its own DTO. It has no concept of "this call site invokes that specific function definition."
- **Verdict:** **NOT CURRENTLY SUPPORTED.** Test `test_find_definition_and_reference_routes` in `tests/test_parser_precision.py` itself asserts `{hit["method"] for hit in refs} == {"text_search_fallback"}`, i.e. the test suite documents this as a known, intentional fallback rather than a real reference resolver.

### 2.8 Inheritance / interfaces

- **Extractor:** none captures `bases`/`extends`/`implements`. `ast.ClassDef.bases` is available inside `python_symbol_parser.py`'s own `ast.parse` tree but is never read (only `node.name`, `node.lineno`, `node.end_lineno`, and `node.body` are consulted). The one place `class` signature text is inspected downstream is `discover_semantic_anchors.py::_db_schema_anchors`, which does a **substring check** on the lowercased `signature` string (`"(base)" in signature or "models.model" in signature or "sqlmodel" in signature`) — but `signature` itself is always just `f"class {name}"` (see §2.3), which **never contains the base-class text at all**, since `_function_signature`/class signature construction discards `ClassDef.bases`. This means the `_db_schema_anchors` substring checks are effectively **dead code that can never match** for Python classes produced by this parser (verified by reading `_symbol()`'s `signature=f"class {node.name}"` in `python_symbol_parser.py` line 34 — no base info is ever embedded there). The `db_schema` anchor test passes only because of the file-path/DDL-keyword heuristic path (`file.path` containing "models"/"migration"/"schema.prisma"), not the class-signature path.
- **Stored model:** none.
- **API/service:** none.
- **Verdict:** **NOT CURRENTLY SUPPORTED**, and worth flagging to the user as a **latent bug**: the ORM-model detection heuristic that appears to key off base classes (`(Base)`, `models.Model`, `sqlmodel`) cannot actually fire for Python-parsed classes given the current signature format.

### 2.9 Routes / endpoints (detected in analyzed target repos)

- **Extractor:** `app/indexing/discover_semantic_anchors.py::_http_route_anchors`, three regexes: `ROUTE_DECORATOR_RE` (`@app.get('/path')`/`@router.post(...)`/`@blueprint.route(...)` style), `PY_ROUTE_MAP_RE` (`routes['GET /path'] = ...` dict-assignment style), `JS_ROUTE_RE` (`app.get('/path', ...)`/`router.post(...)` style).
- **Stored model:** `core/models/semantic_anchor.py::SemanticAnchor` (`kind="http_route"`).
- **API/service:** `GET /runs/{run_id}/anchors?kind=http_route` (`api/routes/anchors.py`, DTO `SemanticAnchorDTO`).
- **Source span:** exact single-line span at the decorator/call-site line, expanded to a `SourceRegion` via `reader.read_range`.
- **Confidence/status:** confidence 0.86–0.92 depending on extraction method; `status="source_detected"` when confidence ≥ 0.7.
- **Run-scoped:** yes.
- **Limitations:** purely line-level regex matching, not AST-based even for Python (unlike symbol extraction). Framework coverage is narrow: matches `@app.`/`@router.`/`@blueprint.`/`@bp.` decorator prefixes and `app.`/`router.`/`server.` JS call prefixes only — a route registered through an included/mounted sub-router with a different variable name, a class-based view (Django `class OrdersView(View):` + `urls.py` mapping), or FastAPI's `APIRouter().include_router(...)` composition is invisible. No path-parameter structure, no HTTP-method verification beyond the literal captured word, no linkage back to the handler function as a `ParsedSymbol` (anchors link to symbols only via a *proximity* heuristic, `_related_symbols`, matching by overlapping/enclosing line range — not a guaranteed 1:1 handler binding).

### 2.10 Database / data-access relations

- **Extractor:** `discover_semantic_anchors.py::_db_schema_anchors`.
- **Stored model:** `SemanticAnchor(kind="db_schema")`.
- **API/service:** same anchors endpoint as above, `kind=db_schema`.
- **Source span:** exact line for symbol-based matches (`symbol.start_line`/`end_line`), or line 1 (or first DDL-keyword line) for file-based matches.
- **Run-scoped:** yes.
- **Limitations:**
  - Two independent, narrow signal sources: (a) file-path/extension heuristic — `file.language == "sql"` or path containing `migration(s)`/`schema.prisma`/`models?`; (b) class-signature substring match — confirmed **non-functional for Python** per §2.8 finding.
  - No table/column/field extraction whatsoever — a detected "db_schema" anchor tells you *a file or class probably relates to a schema*, not what the schema/columns/relations are.
  - No query-level facts (no SQL statement parsing, no ORM query call detection, no N+1 or query-shape analysis).
  - JS/TS ORM classes (Sequelize, TypeORM, Prisma client usage beyond the `schema.prisma` filename check, Mongoose schemas) are not covered by the class-heuristic branch at all — that branch only inspects `symbol.kind == "class"` `ParsedSymbol`s, which for JS/TS exist (see §2.3) but the substring check (`"(base)"`, `"models.model"`, `"sqlmodel"`) is Python-ORM-flavored and won't match idiomatic JS ORM class declarations.

### 2.11 Source spans (exact line/col ranges)

- **Extractor/model:** `app/evidence/source_reader.py::SourceReader.read_range` / `_region`, producing `core/models/source_region.py::SourceRegion` for essentially every fact type (symbols, anchors, orientation-derived regions, claim citations).
- **API/service:** `POST /evidence/read-range`, `POST /evidence/read-whole-file`, `POST /evidence/expand-region`, `GET /source-regions/{region_id}` (`api/routes/source.py`).
- **Precision:** **line-level only** — `SourceRegion.start_line`/`end_line` (1-indexed, inclusive), no column/character offsets anywhere in `SourceRegion`, `ParsedSymbol`, or `SemanticAnchor`. Every region is bound to `content_hash` of the whole file at read time, so a stale region can be detected by hash mismatch (used by `CitationValidator._validate_region_bounds_and_hash`, which explicitly downgrades a citation whose `content_hash` no longer matches).
- **Run-scoped:** yes — `region.id` is `sha1(run_id|path|start_line|end_line|content_hash|region_type)`, and `SourceRegion.run_id` is checked explicitly by the grounding validator (`region.run_id != self._job.run_id` → invalid).
- **Limitations:** no column-level spans anywhere in the deterministic layer; a caller wanting "the exact token range of an identifier" cannot get it — only whole-line ranges.

### 2.12 Stable symbol IDs (deterministic across re-analysis?)

- **ID scheme:** `symbol:{sha1(run_id | qualified_name | start_line | end_line)[:24]}` (`python_symbol_parser.py::_stable_symbol_id`, identical scheme duplicated in `js_ts_symbol_parser.py`). Region IDs, anchor IDs, and most other derived IDs (`_stable_id` in `static_structure.py`, `component_lens.py`, `projection.py`, `discover_semantic_anchors.py::_anchor_id`) follow the same pattern: a SHA-1 hash **that always includes `run_id` as an input**.
- **`run_id` generation:** `app/analysis/analysis_controller.py::start_or_reuse` — `run_id = f"run:{uuid.uuid4().hex}"`, a fresh random UUID **every time `analyze()`/`start()` is called**, regardless of whether the target repository or its content is identical to a previous run.
- **Verdict:** IDs are **deterministic and idempotent within a single run** (re-reading the same symbol during the same run always yields the same ID — useful for the in-run dedup/caching seen throughout `store.get_or_create_stage`, `ArchitectureMapProjector.project` caching by `overview_input_hash`, etc.), but **not stable across two separate analyses of byte-identical source code**, because the random `run_id` is baked into the hash. A consumer trying to diff "this function's identity" between two runs of the same repo (e.g., to track a symbol across incremental re-analysis) has no path to do so via `ParsedSymbol.id` — they would need to fall back to `(path, qualified_name, start_line, end_line)` tuple matching themselves, which the backend does not do for them anywhere.
- **This is the most consequential gap for provenance/diffing use cases** (see §3).

### 2.13 Run isolation

- **Storage:** `app/analysis/run_store.py::InMemoryRunStore` keys almost everything by `run_id`: `_symbols_by_run`, `_orientation_by_run`, `_anchors_by_run`, `_system_overviews_by_run` (keyed by `SystemOverview.analysis_run_id`), `_architecture_maps_by_run`, `_lenses_by_parent` (keyed by `(run_id, parent_component_id)` tuple), `_stages_by_run`.
- **Exception:** `_regions: dict[str, SourceRegion] = {}` is a single **global** dict keyed by `region.id`, not nested under `run_id`. This is safe only because `region.id` itself is a hash that includes `run_id` as an input (§2.11/§2.12), so two different runs reading the same file/line-range produce different, non-colliding region IDs — there is no actual collision risk observed, but it does mean `get_region(region_id)` alone (used e.g. in `GET /source-regions/{region_id}`, `api/routes/source.py`) does **not** itself check that the region belongs to the caller's active run; a caller who already knows another run's region ID (e.g. leaked via logs) could fetch it cross-run through that specific endpoint, since that route doesn't call `resolve_ready_run`/cross-check `run_id` at all. This is a narrow, low-severity gap (requires already knowing an opaque, unguessable 24-hex-char ID from another run) rather than a leakage-by-default bug.
- **Explicit enforcement:** `app/grounding/citation_validator.py::_validate_source_region` and `_validate_parsed_symbol` both explicitly compare `region.run_id != self._job.run_id` / `symbol.run_id != self._job.run_id` and reject the citation as invalid if it doesn't match — this is a deliberate, tested guard (not an accidental byproduct).
- **API-level resolution:** `api/run_resolution.py::resolve_ready_run` resolves the target run from (in order) explicit query param → `X-Syntax-Tree-Run-Id` header → the store's single `active_run_id`, and 404/409s rather than guessing; comment in the code states the intent explicitly ("never silently cross repositories").
- **Verdict:** **SUPPORTED RELIABLY** for the primary code paths (symbols, anchors, orientation, citations, snapshot); the one confirmed soft spot is the unguarded `GET /source-regions/{region_id}` lookup, which is a minor defense-in-depth gap rather than a demonstrated leak (no test exercises or catches this either way — this is an audit-time code-reading finding, not something reproduced by running a test).

### 2.14 Additional deterministic facts found beyond the requested list

- **Package/manifest boundaries** — `infra/filesystem/file_classifier.py::manifest_for`/`package_boundary_for`, model `core/models/file_record.py::ManifestRecord`/`PackageBoundary`, exposed on `RepoSnapshotDTO`. Covers `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, plus lockfile/workspace manifests as non-boundary manifests. **SUPPORTED RELIABLY**, whole-file granularity only (no per-dependency fact extraction beyond the single `package_name`).
- **Language/role classification per file** (`production`/`test`/`example`/`docs`/`config`/`tooling`/`generated`/`infrastructure`/`unknown`) — **SUPPORTED RELIABLY**, purely path/name-pattern heuristic (`file_classifier.py::classify_role`), not content-aware (e.g., a file with test-like content but a non-matching path/name would be classified `production`).
- **Orientation inventory** (README/docs/manifest/config/deployment-note signal extraction) — `app/indexing/build_orientation_inventory.py`, model `core/models/orientation.py::OrientationItem`. Explicitly marked `trust_level="guidance_only"` / `proof_allowed=False` in the model itself — the backend's own domain model documents that this is **not** a verifiable source fact, just indexed prose/metadata for orientation. Correctly classified by the codebase's own conventions as non-authoritative.
- **Public export surface** (`public_export` anchors) — reasonably solid for the specific patterns covered: Python `__init__.py` `from .x import y` / `__all__ = [...]`, and Node `package.json` `exports`/`main` fields, plus any `exported=True` parsed symbol in an `index.ts`/`index.js`/`main.ts`/`main.js` file. **PARTIALLY SUPPORTED** — same JS/TS regex-parser caveats apply transitively.

---

## 3. Notable Implementation Findings (surprising / worth flagging)

1. **No tree-sitter, no real JS/TS parser.** Despite the project name ("syntax-tree-refurbished"), Python is parsed with the stdlib `ast` module (solid), but JavaScript/TypeScript symbol extraction (`app/parsing/js_ts_symbol_parser.py`) is a hand-rolled, single-pass, line-by-line regex + brace-counting parser with no tokenizer — it cannot correctly handle braces inside strings/template literals/regex/comments, and containment is flattened to one level (§2.5).
2. **Zero call-graph and zero inheritance-graph modeling anywhere in `core/models`.** These are not "partially supported with gaps" — there is no data structure for either concept at all in the deterministic layer. "Find references" is a plainly-labeled text-search fallback, confirmed by the project's own tests.
3. **A likely-dead heuristic branch:** the ORM base-class substring check in `discover_semantic_anchors.py::_db_schema_anchors` (`"(base)" in signature`) can never match Python classes, because the Python parser's `signature` field for a class is unconditionally `f"class {name}"` — base classes are parsed by `ast` but thrown away before signature construction. The `db_schema` anchor tests pass only via the unrelated file-path heuristic, masking that this specific code path is non-functional.
4. **Symbol/region/anchor IDs are not stable across re-analysis** because every ID hash includes a freshly-generated random `run_id`. Anyone trying to build a "track this symbol across commits/re-analyses" or "diff two runs" feature on top of this backend today would get no help from ID stability and would have to implement their own `(path, qualified_name, start_line, end_line)` matching.
5. **`is_stale` is fully unimplemented** — it's a modeled boolean on `ArchitectureMapEvidence` and `ImplementationSourceTab` that is hardcoded `False` at all 6 call sites across `projection.py`, `query_lens_adapter.py`, and `local_search.py`. The system models staleness awareness but has not built it.
6. **System Overview / Architecture Map / Lens are not durably persisted even when SQLite is configured.** `SQLiteRunStore` (which otherwise carefully mirrors jobs, snapshots, symbols, orientation, anchors, regions, and stages to disk with a restore-on-boot path, verified by `test_completed_analysis_restores_core_artifacts_from_sqlite`) does not override `put_system_overview`, `put_architecture_map`, or `put_lens` — those three remain in-memory-only dicts inherited from `InMemoryRunStore`, so a backend restart silently loses them while the "lower-level" deterministic facts survive. This is invisible unless you read both classes side by side.
7. **`/api/flows` is a stub, not a partial implementation.** It's hardcoded to return an empty list and 404 any specific flow ID — there is no flow-detection logic anywhere in the codebase to partially credit.
8. **Run isolation is actively enforced, not just structurally implied** — `CitationValidator` explicitly checks `region.run_id != job.run_id` and rejects mismatches; this is deliberate defensive code, which is good evidence the team was already thinking about cross-run contamination. The one soft spot found is the direct `GET /source-regions/{region_id}` lookup route, which doesn't re-verify the region belongs to the resolved run (low severity — requires guessing/leaking an opaque ID).

## 4. Most Significant Gaps for Provenance Purposes

In priority order, for anyone wanting to build provenance/traceability claims on top of this backend:

1. **No call graph** — cannot answer "what calls this function" or "what does this function call" as a structured fact; only free-text search.
2. **No inheritance/interface graph** — cannot answer "what implements/extends this" for any language, including Python where the AST data is available but discarded.
3. **Symbol IDs are not stable across re-analysis** — any provenance story that needs to say "this is the same logical symbol as in a prior run" needs external reconciliation logic; the backend provides none.
4. **Only 2 of many languages get structured symbol facts** (Python solidly, JS/TS heuristically); everything else (Go, Rust, Java, Ruby, PHP, C#, C/C++, Kotlin, Swift, SQL, and template-based frontend frameworks like Svelte/Vue beyond simple screen-anchor detection) has zero structured symbol extraction — only whole-file text search and a low-confidence generic outline.
5. **Imports are file-granularity, intra-repo-only edges** — no symbol-level "imports name X from Y," no external-package import facts at all (silently dropped), and JS/TS bare-specifier/path-alias imports are unresolved.
6. **Route/DB-access detection is pattern-narrow and not framework-general** — reliable for the small set of shapes covered by the audited regexes, silently produces nothing for anything else (no partial/low-confidence signal emitted for unmatched-but-plausible route/ORM code).

---

## 5. Corroborating Tests Read

- `tests/test_parser_precision.py` — Python AST exactness, JS/TS symbol shape, outline fallback confidence values, `find-definition`/`find-references` methods (confirms text-search-fallback labeling), unsupported-language empty-symbols behavior.
- `tests/test_semantic_anchors.py` — anchor kind coverage (`http_route`, `frontend_screen`, `auth_boundary`, `db_schema`, `deployment_unit`, `public_export`, `cli_command`, `worker`, `cron_job`, `queue_boundary`, `external_api_client`, `plugin_registry`), confidence/status wiring, anchors-endpoint `by_kind` counting.
- `tests/test_sqlite_persistence.py` — confirms which artifact types survive a `SQLiteRunStore` restart (symbols/orientation/anchors/regions/stages) and, by omission, that system-overview/architecture-map/lens are not asserted (and are not in fact persisted, per source reading).
- `tests/test_grounding_validation.py` — citation validation behavior corroborating run-scoping and content-hash staleness checks in `CitationValidator`.
