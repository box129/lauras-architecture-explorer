# Syntax Tree — API Layer Design

> **Subsystem D (Part 1) — Complete System Design**
> REST Endpoints, WebSocket Streaming, View Projections, Analysis Pipeline Control
> Version 1.0 | March 2026

---

## 1. Purpose & Boundaries

### 1.1 What This Layer Does

The API Layer is the HTTP interface between the Python backend (Subsystems A, B, C) and the React frontend. It exposes REST endpoints for graph data, architecture analysis results, documentation, and source code. It provides WebSocket endpoints for streaming query responses and analysis progress. It computes view projections that transform raw graph data into render-ready structures for React Flow.

### 1.2 What This Layer Does NOT Do

- Does NOT render HTML, SVG, or any visual output. It returns JSON. The frontend renders.
- Does NOT own business logic. It delegates to the Knowledge Graph API, the Agent pipeline, and the Query Agent. It is a thin translation layer between HTTP and Python.
- Does NOT handle authentication in the initial build. The tool runs locally.
- Does NOT serve the React frontend. The frontend is served separately (dev server or static build).

### 1.3 Technology Stack

- **Framework:** FastAPI (async, automatic OpenAPI docs, WebSocket support)
- **Server:** Uvicorn (ASGI server)
- **Serialization:** Pydantic models for request/response validation
- **WebSocket:** FastAPI's built-in WebSocket support

### 1.4 Architecture

```
React Frontend (port 3000)
    ↕ HTTP (REST) + WebSocket
FastAPI Application (port 8000)
    ├── REST Endpoints → KnowledgeGraph API / Agent Pipeline
    ├── WebSocket /ws/query → QueryAgent.query_streaming()
    ├── WebSocket /ws/analyze → PipelineOrchestrator with progress callback
    └── View Projections → graph data → render-ready JSON
```

---

## 2. Endpoint Specification

### 2.1 Analysis Pipeline

#### POST /api/analyze

Trigger a full analysis pipeline on a repository.

**Request:**
```json
{
    "repository_path": "/absolute/path/to/repo",
    "config": {
        "max_file_size_bytes": 1048576,
        "follow_symlinks": false
    }
}
```

- `repository_path` (required): absolute path to the repository root.
- `config` (optional): extraction configuration overrides. See ExtractionConfig.

**Response (202 Accepted):**
```json
{
    "job_id": "uuid-string",
    "status": "started",
    "message": "Analysis pipeline started"
}
```

The analysis runs asynchronously in a background task. Poll status or connect via WebSocket for progress.

**Errors:**
- 400: repository_path is missing or not a directory.
- 409: another analysis is already running.

#### GET /api/analyze/{job_id}/status

Get the current status of an analysis job.

**Response (200):**
```json
{
    "job_id": "uuid-string",
    "status": "running",
    "stage": "clustering",
    "progress": {
        "files_discovered": 44,
        "files_parsed": 30,
        "files_total": 40,
        "current_stage": "clustering",
        "stages_completed": ["extraction", "ingestion"],
        "stages_remaining": ["clustering", "architecture", "documentation"]
    },
    "started_at": "2026-03-28T10:00:00Z",
    "elapsed_seconds": 12.5
}
```

**Status values:** "queued", "running", "completed", "failed".

**Errors:**
- 404: job_id not found.

#### WebSocket /ws/analyze/{job_id}

Stream analysis progress events in real-time.

**Outgoing messages (server → client):**
```json
{"event": "discovery_complete", "data": {"total_files": 44}}
{"event": "file_parsed", "data": {"file_path": "src/service.py", "current": 15, "total": 40}}
{"event": "stage_started", "data": {"stage": "clustering"}}
{"event": "stage_completed", "data": {"stage": "clustering", "duration_seconds": 5.2}}
{"event": "pipeline_complete", "data": {"duration_seconds": 28.5, "total_nodes": 192, "total_edges": 311}}
{"event": "pipeline_failed", "data": {"error": "...", "stage": "extraction"}}
```

### 2.2 Graph Data

#### GET /api/nodes

Query nodes with filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by node type. Comma-separated for multiple: "function,method". |
| file_path | string | Filter by exact file path. |
| file_path_prefix | string | Filter by file path prefix (directory). |
| language | string | Filter by language. |
| source | string | "parsed" or "inferred". |
| name | string | Filter by exact name. |
| name_pattern | string | Filter by name pattern (SQL LIKE). |
| is_exported | boolean | Filter by export status. |
| parent_class | string | Filter methods by parent class QN. |
| limit | integer | Maximum results. Default: 100. Max: 1000. |
| offset | integer | Pagination offset. Default: 0. |

**Response (200):**
```json
{
    "nodes": [
        {
            "qualified_name": "python:src/utils.py::validate_name",
            "type": "function",
            "name": "validate_name",
            "file_path": "src/utils.py",
            "language": "python",
            "line_start": 6,
            "line_end": 10,
            "source": "parsed",
            "is_exported": true,
            "is_async": false,
            "parameters": [{"name": "name", "type_annotation": "str", "default_value": ""}],
            "return_type": "bool",
            "decorators": [],
            "docstring": "\"\"\"Check if name is valid.\"\"\"",
            "parent_class": "",
            "superclasses": [],
            "confidence": null,
            "metadata": {}
        }
    ],
    "total": 192,
    "limit": 100,
    "offset": 0
}
```

**Notes:**
- `source_text` is NOT included by default (too large). Use GET /api/nodes/{qn} for full data.
- Pagination via limit/offset.

#### GET /api/nodes/{qn}

Get a single node with all fields including source_text.

**Path Parameter:** `qn` — URL-encoded QualifiedName.

**Response (200):**
```json
{
    "qualified_name": "python:src/utils.py::validate_name",
    "type": "function",
    "name": "validate_name",
    "file_path": "src/utils.py",
    "source_text": "def validate_name(name: str) -> bool:\n    ...",
    "...": "(all fields)"
}
```

**Errors:**
- 404: node not found.

#### GET /api/nodes/at-location

Find the node at a specific file and line.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| file_path | string (required) | Relative file path. |
| line | integer (required) | 1-indexed line number. |

**Response (200):**
```json
{
    "node": { "...": "(full node data)" },
    "context": {
        "component": "component:input_validation_utilities",
        "subsystem": "subsystem:user_management_system",
        "layer": "layer:utility_layer"
    }
}
```

Returns the most specific (innermost) node at that location, plus its architectural context (component, subsystem, layer) if available.

**Errors:**
- 404: no node at that location.

#### GET /api/edges

Query edges with filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| source_qn | string | Filter by source node QN. |
| target_qn | string | Filter by target node QN. |
| edge_type | string | Filter by edge type. Comma-separated for multiple. |
| source | string | "parsed" or "inferred". |
| limit | integer | Default: 500. Max: 5000. |
| offset | integer | Default: 0. |

**Response (200):**
```json
{
    "edges": [
        {
            "source_qn": "python:src/service.py::UserService.create_user",
            "target_qn": "python:src/utils.py::validate_name",
            "edge_type": "CALLS",
            "source": "parsed",
            "metadata": {"line": 14, "resolution": "import"}
        }
    ],
    "total": 311,
    "limit": 500,
    "offset": 0
}
```

At least one of source_qn, target_qn, or edge_type must be provided.

#### GET /api/traverse

Traverse the graph from a starting node.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| start_qn | string (required) | Starting node QN. |
| edge_types | string | Comma-separated edge types to follow. Default: all. |
| direction | string | "outgoing", "incoming", or "both". Default: "outgoing". |
| max_depth | integer | Maximum hops. Default: 3. Use -1 for unlimited. |
| include_details | boolean | If true, return full node objects. If false, return QNs only. Default: false. |

**Response (200):**
```json
{
    "start_qn": "python:src/service.py::UserService.create_user",
    "direction": "outgoing",
    "max_depth": 3,
    "reachable_count": 5,
    "nodes": ["python:src/utils.py::validate_name", "..."],
    "details": [{"...": "(full node data, if include_details=true)"}]
}
```

#### GET /api/search

Full-text search across nodes.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string (required) | Search query. Supports FTS5 syntax (AND, OR, NOT, phrases). |
| limit | integer | Default: 20. Max: 100. |

**Response (200):**
```json
{
    "query": "validate",
    "results": [
        {
            "qualified_name": "python:src/utils.py::validate_name",
            "type": "function",
            "name": "validate_name",
            "file_path": "src/utils.py",
            "line_start": 6,
            "snippet": "...validates a name string..."
        }
    ],
    "total": 3
}
```

The `snippet` field is a text extract showing where the search term appears (from source_text or docstring).

#### GET /api/stats

Graph statistics.

**Response (200):**
```json
{
    "total_nodes": 22,
    "total_edges": 17,
    "parsed_count": 8,
    "inferred_count": 14,
    "nodes_by_type": {"function": 2, "method": 2, "class": 1, "module": 2, "constant": 1, "component": 2, "...": "..."},
    "edges_by_type": {"DEFINES": 4, "CONTAINS": 2, "IMPORTS": 1, "CALLS": 1, "BELONGS_TO_COMPONENT": 7, "...": "..."},
    "nodes_by_language": {"python": 8},
    "avg_in_degree": 1.5,
    "avg_out_degree": 1.5,
    "connected_component_count": 1,
    "most_connected": [["python:src/utils.py::validate_name", 3], "..."]
}
```

### 2.3 Architecture Data

#### GET /api/components

List all components.

**Response (200):**
```json
{
    "components": [
        {
            "qualified_name": "component:input_validation_utilities",
            "name": "Input Validation Utilities",
            "description": "Provides name validation and text sanitization.",
            "domain": "utility",
            "member_count": 3,
            "cohesion": 1.0,
            "coupling": 0.14,
            "confidence": 0.5,
            "layer": "Utility Layer",
            "subsystem": "User Management System"
        }
    ]
}
```

#### GET /api/components/{qn}

Component detail with members and relationships.

**Response (200):**
```json
{
    "component": { "...": "(component node data)" },
    "members": [
        {"qualified_name": "python:src/utils.py::validate_name", "type": "function", "name": "validate_name", "...": "..."}
    ],
    "dependencies": [
        {"target_component": "component:user_service_layer", "calls_count": 1, "imports_count": 0, "direction": "called_by"}
    ],
    "layer": {"name": "Utility Layer", "position": 1},
    "subsystem": {"name": "User Management System"},
    "patterns": [],
    "violations": []
}
```

#### GET /api/subsystems

List all subsystems.

**Response (200):**
```json
{
    "subsystems": [
        {
            "qualified_name": "subsystem:user_management_system",
            "name": "User Management System",
            "description": "Handles user creation with input validation.",
            "component_count": 2,
            "architectural_style": "monolithic",
            "confidence": 0.5
        }
    ]
}
```

#### GET /api/subsystems/{qn}

Subsystem detail with components and interactions.

#### GET /api/layers

List all architectural layers sorted by position.

**Response (200):**
```json
{
    "layers": [
        {"qualified_name": "layer:service_layer", "name": "Service Layer", "position": 0, "component_count": 1},
        {"qualified_name": "layer:utility_layer", "name": "Utility Layer", "position": 1, "component_count": 1}
    ]
}
```

#### GET /api/patterns

List detected patterns.

**Response (200):**
```json
{
    "patterns": [
        {
            "qualified_name": "pattern:layered_architecture_main",
            "name": "Layered Architecture",
            "pattern_type": "layered_architecture",
            "confidence": 0.85,
            "participating_components": ["component:api_handlers", "component:user_service"],
            "description": "3-layer architecture with consistent top-down dependencies."
        }
    ]
}
```

#### GET /api/violations

List architectural violations.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| severity | string | Filter by severity: "low", "medium", "high". |
| violation_type | string | Filter by type. |

**Response (200):**
```json
{
    "violations": [
        {
            "qualified_name": "violation:boundary_crossing_1",
            "name": "API Layer accesses Data Layer directly",
            "violation_type": "boundary_crossing",
            "severity": "medium",
            "description": "The api_handlers component calls data_repository directly, bypassing the service layer.",
            "source_entity": "component:api_handlers",
            "target_entity": "component:data_repository",
            "confidence": 0.8
        }
    ],
    "summary": {"high": 0, "medium": 1, "low": 0, "total": 1}
}
```

#### GET /api/architecture/overview

System architecture overview.

**Response (200):**
```json
{
    "system_summary": "A well-structured application with clear separation of concerns.",
    "health_score": 0.9,
    "key_findings": ["Clean top-down dependency structure", "..."],
    "total_subsystems": 1,
    "total_layers": 2,
    "total_components": 2,
    "total_patterns": 0,
    "total_violations": 0
}
```

### 2.4 View Projections

These endpoints return pre-computed data structures ready for React Flow rendering. They are the most important endpoints for the frontend because they eliminate the need for complex graph logic in JavaScript.

#### GET /api/views/architecture

The architecture drill-down view. Returns everything needed to render the full architecture diagram.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| level | string | "subsystem" (top level), "component" (mid level). Default: "subsystem". |
| expand_qn | string | QN of a subsystem or component to expand inline. |

**Response (200):**
```json
{
    "view_type": "architecture",
    "nodes": [
        {
            "id": "subsystem:user_management_system",
            "type": "subsystem",
            "label": "User Management System",
            "data": {
                "description": "Handles user creation...",
                "component_count": 2,
                "health_score": 0.9
            },
            "position": {"x": 200, "y": 100},
            "children": [
                {
                    "id": "component:input_validation_utilities",
                    "type": "component",
                    "label": "Input Validation Utilities",
                    "data": {"member_count": 3, "domain": "utility", "layer": "Utility Layer"},
                    "position": {"x": 100, "y": 200}
                },
                {
                    "id": "component:user_service_layer",
                    "type": "component",
                    "label": "User Service Layer",
                    "data": {"member_count": 4, "domain": "business_logic", "layer": "Service Layer"},
                    "position": {"x": 300, "y": 200}
                }
            ]
        }
    ],
    "edges": [
        {
            "id": "edge_1",
            "source": "component:user_service_layer",
            "target": "component:input_validation_utilities",
            "label": "1 call",
            "data": {"calls_count": 1, "imports_count": 1, "total_weight": 2},
            "type": "dependency",
            "animated": false
        }
    ],
    "violations": []
}
```

**Position computation:** The API layer computes x,y positions using a layout algorithm (hierarchical layout for architecture view). The frontend passes these directly to React Flow. For subsystems, use a grid layout. For components within a subsystem, use a force-directed or hierarchical layout based on layer positions.

#### GET /api/views/layered

The layered diagram view. Components arranged by layer.

**Response (200):**
```json
{
    "view_type": "layered",
    "layers": [
        {
            "position": 0,
            "name": "Service Layer",
            "y": 100,
            "height": 200,
            "nodes": [
                {"id": "component:user_service_layer", "label": "User Service Layer", "x": 200, "y": 150}
            ]
        },
        {
            "position": 1,
            "name": "Utility Layer",
            "y": 350,
            "height": 200,
            "nodes": [
                {"id": "component:input_validation_utilities", "label": "Input Validation Utilities", "x": 200, "y": 400}
            ]
        }
    ],
    "edges": [
        {
            "id": "edge_1",
            "source": "component:user_service_layer",
            "target": "component:input_validation_utilities",
            "data": {"direction": "top_down", "is_violation": false},
            "style": {"stroke": "#4CAF50"}
        }
    ],
    "violations": []
}
```

Edges going top-down are green/normal. Edges going bottom-up (wrong direction) are red with `is_violation: true`. Layer skip edges are highlighted.

#### GET /api/views/dependency

Dependency graph for a specific scope.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| scope_qn | string | QN of the scope (component, subsystem, or omit for full system). |
| depth | integer | How many hops from the scope to show. Default: 1. |
| edge_types | string | Comma-separated. Default: "CALLS,IMPORTS". |

**Response (200):**
```json
{
    "view_type": "dependency",
    "scope": "component:user_service_layer",
    "nodes": [
        {"id": "component:user_service_layer", "label": "User Service Layer", "type": "component", "is_scope": true, "position": {"x": 300, "y": 200}},
        {"id": "component:input_validation_utilities", "label": "Input Validation Utilities", "type": "component", "is_scope": false, "position": {"x": 300, "y": 400}}
    ],
    "edges": [
        {"id": "e1", "source": "component:user_service_layer", "target": "component:input_validation_utilities", "label": "2 deps"}
    ]
}
```

#### GET /api/views/call-flow

Call flow from a starting function.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| start_qn | string (required) | Starting function QN. |
| max_depth | integer | Default: 3. |

**Response (200):**
```json
{
    "view_type": "call_flow",
    "start": "python:src/service.py::UserService.create_user",
    "nodes": [
        {"id": "python:src/service.py::UserService.create_user", "label": "create_user", "type": "method", "file_path": "src/service.py", "line_start": 11, "depth": 0, "position": {"x": 300, "y": 50}},
        {"id": "python:src/utils.py::validate_name", "label": "validate_name", "type": "function", "file_path": "src/utils.py", "line_start": 6, "depth": 1, "position": {"x": 300, "y": 200}}
    ],
    "edges": [
        {"id": "e1", "source": "python:src/service.py::UserService.create_user", "target": "python:src/utils.py::validate_name", "label": "calls"}
    ]
}
```

Nodes include `depth` (distance from start) and positions computed in top-down tree layout.

#### GET /api/views/data-flow

Data flow showing infrastructure interactions.

**Response (200):**
```json
{
    "view_type": "data_flow",
    "nodes": [
        {"id": "component:user_service_layer", "label": "User Service Layer", "type": "component", "position": {"x": 200, "y": 200}},
        {"id": "sql:migrations/001.sql::users", "label": "users", "type": "database_table", "position": {"x": 500, "y": 200}}
    ],
    "edges": [
        {"id": "e1", "source": "component:user_service_layer", "target": "sql:migrations/001.sql::users", "edge_type": "READS_FROM", "label": "reads", "style": {"strokeDasharray": "5 5"}}
    ]
}
```

Infrastructure interaction edges are rendered as dashed lines (heuristic, low confidence).

### 2.5 Documentation

#### GET /api/docs

List all documentation sections as a table of contents.

**Response (200):**
```json
{
    "sections": [
        {
            "qualified_name": "doc:system:system_overview",
            "title": "System Overview",
            "doc_level": "system",
            "summary": "A small Python application...",
            "is_stale": false,
            "user_edited": false,
            "has_pending_comments": false,
            "children": [
                {
                    "qualified_name": "doc:subsystem:user_management_system",
                    "title": "User Management System",
                    "doc_level": "subsystem",
                    "is_stale": false,
                    "children": [
                        {"qualified_name": "doc:component:input_validation_utilities", "title": "Input Validation Utilities", "doc_level": "component", "children": ["..."]},
                        {"qualified_name": "doc:component:user_service_layer", "title": "User Service Layer", "doc_level": "component", "children": ["..."]}
                    ]
                }
            ]
        }
    ]
}
```

This is a tree structure matching the documentation hierarchy. The frontend renders it as a collapsible table of contents.

#### GET /api/docs/{qn}

Get a documentation section with full content.

**Response (200):**
```json
{
    "qualified_name": "doc:component:user_service_layer",
    "title": "User Service Layer",
    "doc_level": "component",
    "summary": "Handles user creation with validation and persistence.",
    "body": "The User Service Layer component centers on the UserService class...",
    "code_references": [
        {"qn": "python:src/service.py::UserService", "display_name": "UserService", "file_path": "src/service.py", "line_start": 5},
        {"qn": "python:src/service.py::UserService.create_user", "display_name": "create_user", "file_path": "src/service.py", "line_start": 11}
    ],
    "embedded_diagrams": [
        {"diagram_type": "call_flow", "start_node_qn": "python:src/service.py::UserService.create_user", "max_depth": 2, "caption": "Call flow from create_user", "position": "after_paragraph_1"}
    ],
    "parent_section": "doc:subsystem:user_management_system",
    "child_sections": ["doc:function:create_user", "doc:function:__init__"],
    "is_stale": false,
    "stale_reason": "",
    "user_edited": false,
    "user_comments": [],
    "target_entity_qn": "component:user_service_layer",
    "confidence": 0.7
}
```

#### POST /api/docs/{qn}/comment

Add a user comment.

**Request:**
```json
{
    "text": "Please mention error handling in this section."
}
```

**Response (200):**
```json
{
    "comment_index": 0,
    "status": "pending",
    "timestamp": "2026-03-28T14:30:00Z"
}
```

#### PUT /api/docs/{qn}/edit

Save a user edit.

**Request:**
```json
{
    "body": "The User Service Layer... (user's edited text)"
}
```

**Response (200):**
```json
{
    "user_edited": true,
    "message": "Edit saved. Original AI version preserved for comparison."
}
```

#### POST /api/docs/{qn}/regenerate

Regenerate a single section incorporating pending comments.

**Response (200):**
```json
{
    "regenerated": true,
    "comments_addressed": 1,
    "user_edit_preserved": false,
    "message": "Section regenerated with user feedback."
}
```

If the section has user_edited=true, the AI version goes to ai_generated_body. Response includes `user_edit_preserved: true`.

#### POST /api/docs/generate

On-demand documentation generation.

**Request:**
```json
{
    "scope_qn": "component:user_service_layer",
    "focus": "error handling",
    "user_request": "Explain the error handling in this component."
}
```

**Response (200):**
```json
{
    "section_qn": "doc:custom:user_service_layer_error_handling",
    "title": "Error Handling in User Service Layer",
    "body": "...",
    "confidence": 0.7
}
```

#### GET /api/docs/staleness

Check staleness of all documentation sections.

**Response (200):**
```json
{
    "total_sections": 8,
    "stale_count": 2,
    "stale_sections": [
        {"qualified_name": "doc:function:validate_name", "reason": "Entity source changed"},
        {"qualified_name": "doc:function:create_user", "reason": "Entity source changed"}
    ]
}
```

### 2.6 Query

#### POST /api/query

Submit a question and get a complete response (non-streaming).

**Request:**
```json
{
    "question": "How does create_user work?",
    "conversation_id": "optional-conv-id"
}
```

**Response (200):**
```json
{
    "question": "How does create_user work?",
    "intent": "explanatory",
    "answer_text": "The [create_user](python:src/service.py::UserService.create_user) method...",
    "citations": [
        {"entity_qn": "python:src/service.py::UserService.create_user", "entity_name": "create_user", "entity_type": "method", "file_path": "src/service.py", "line_start": 11, "is_valid": true}
    ],
    "confidence": 0.9,
    "follow_up_suggestions": ["What breaks if create_user changes?", "How does validate_name work?"],
    "embedded_diagrams": [{"diagram_type": "call_flow", "start_node_qn": "python:src/service.py::UserService.create_user", "max_depth": 3, "caption": "Call flow from create_user"}],
    "conversation_id": "conv-uuid",
    "turn_number": 1,
    "duration_seconds": 3.2
}
```

#### WebSocket /ws/query

Streaming query interface.

**Incoming message (client → server):**
```json
{
    "question": "How does create_user work?",
    "conversation_id": "optional-conv-id"
}
```

**Outgoing messages (server → client), in order:**
```json
{"type": "intent", "data": {"intent": "explanatory"}}
{"type": "entities", "data": {"count": 1, "names": ["create_user"]}}
{"type": "text_chunk", "data": {"text": "The "}}
{"type": "text_chunk", "data": {"text": "[create_user]"}}
{"type": "text_chunk", "data": {"text": "(python:src/service.py..."}}
{"type": "text_chunk", "data": {"text": "..."}}
{"type": "complete", "data": {
    "citations": ["..."],
    "follow_ups": ["..."],
    "diagrams": ["..."],
    "confidence": 0.9,
    "conversation_id": "conv-uuid",
    "turn_number": 1
}}
```

### 2.7 Source Code

#### GET /api/files

List all files in the analyzed repository.

**Response (200):**
```json
{
    "files": [
        {"file_path": "src/utils.py", "language": "python", "line_count": 14, "size_bytes": 218, "status": "parsed"},
        {"file_path": "src/service.py", "language": "python", "line_count": 18, "size_bytes": 384, "status": "parsed"}
    ]
}
```

#### GET /api/files/{path}

Get the source content of a file.

**Path Parameter:** `path` — URL-encoded relative file path.

**Response (200):**
```json
{
    "file_path": "src/utils.py",
    "language": "python",
    "line_count": 14,
    "content": "\"\"\"Utility functions for validation.\"\"\"\n\nMAX_LENGTH = 255\n...",
    "entities": [
        {"qualified_name": "python:src/utils.py::validate_name", "type": "function", "name": "validate_name", "line_start": 6, "line_end": 10},
        {"qualified_name": "python:src/utils.py::_sanitize", "type": "function", "name": "_sanitize", "line_start": 13, "line_end": 14}
    ]
}
```

The `entities` list tells the frontend which lines correspond to which graph nodes, enabling click-to-inspect from the code viewer.

**Errors:**
- 404: file not found.
- 400: file was not parsed (skipped_unsupported, etc.).

---

## 3. View Projection Engine

### 3.1 Purpose

View projections transform raw graph data into structures the React Flow component can render directly. Without projections, the frontend would need to: query nodes, query edges, filter, aggregate, compute layouts, and handle edge cases. Projections move this logic to the server.

### 3.2 Position Computation

**Architecture view:** Grid layout for subsystems. Within each subsystem, force-directed layout for components. Use NetworkX's spring_layout or a simple grid algorithm.

**Layered view:** Horizontal bands. Each layer occupies a y-range. Components within a layer are distributed along the x-axis. Layer height scales with component count.

**Call flow:** Top-down tree layout. Root at top, callees below. Use a simple recursive layout: root at (center, 0), children evenly spaced one level below, grandchildren below that.

**Dependency view:** Force-directed layout centered on the scope node. NetworkX spring_layout with the scope node fixed at center.

**Data flow:** Left-to-right layout. Components on the left, infrastructure nodes on the right. Edges flow left to right.

### 3.3 Layout Algorithm

For the initial build, use simple algorithms:

```python
def tree_layout(root, children_map, x_start=0, y_start=0, 
                x_spacing=200, y_spacing=150):
    """Compute positions for a tree rooted at root."""
    positions = {}
    
    def layout(node, depth, x_offset, x_range):
        x = x_offset + x_range / 2
        y = y_start + depth * y_spacing
        positions[node] = {"x": x, "y": y}
        
        children = children_map.get(node, [])
        if children:
            child_width = x_range / len(children)
            for i, child in enumerate(children):
                layout(child, depth + 1, x_offset + i * child_width, child_width)
    
    layout(root, 0, x_start, len(children_map) * x_spacing)
    return positions
```

For force-directed layouts on components (fewer than 50 nodes), NetworkX's spring_layout is fast enough to compute server-side and returns (x, y) coordinates that can be scaled to pixel positions.

### 3.4 Edge Aggregation

For architecture and layered views, edges between individual functions are aggregated to component-level edges:

```python
def aggregate_edges(graph, source_component, target_component, membership):
    """Count edges between members of two components."""
    source_members = membership[source_component]
    target_members = membership[target_component]
    
    calls = 0
    imports = 0
    
    for member in source_members:
        edges = graph.get_edges(source_qn=member, edge_type=["CALLS", "IMPORTS"])
        for edge in edges:
            if edge.target_qn in target_members:
                if edge.edge_type == "CALLS":
                    calls += 1
                elif edge.edge_type == "IMPORTS":
                    imports += 1
    
    return {"calls_count": calls, "imports_count": imports, "total_weight": calls + imports}
```

---

## 4. Application Structure

### 4.1 File Structure

```
syntax-tree/
├── syntax_tree/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py                  # FastAPI application factory
│   │   ├── dependencies.py         # Shared dependencies (graph, llm, job manager)
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── analysis.py         # POST /api/analyze, GET status, WS progress
│   │   │   ├── nodes.py            # GET /api/nodes, /api/nodes/{qn}, /at-location
│   │   │   ├── edges.py            # GET /api/edges, /api/traverse, /api/search
│   │   │   ├── architecture.py     # GET /api/components, subsystems, layers, etc.
│   │   │   ├── views.py            # GET /api/views/architecture, layered, etc.
│   │   │   ├── documentation.py    # GET/POST/PUT /api/docs/*
│   │   │   ├── query.py            # POST /api/query, WS /ws/query
│   │   │   ├── files.py            # GET /api/files, /api/files/{path}
│   │   │   └── stats.py            # GET /api/stats
│   │   ├── projections/
│   │   │   ├── __init__.py
│   │   │   ├── architecture_view.py
│   │   │   ├── layered_view.py
│   │   │   ├── dependency_view.py
│   │   │   ├── call_flow_view.py
│   │   │   ├── data_flow_view.py
│   │   │   └── layout.py           # Shared layout algorithms
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── requests.py         # Pydantic request models
│   │   │   └── responses.py        # Pydantic response models
│   │   └── jobs.py                 # Background job management for analysis
│   └── ...
```

### 4.2 Application Factory

```python
# syntax_tree/api/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def create_app() -> FastAPI:
    app = FastAPI(
        title="Syntax Tree API",
        description="Code Intelligence Platform",
        version="1.0.0",
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # React dev server
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    from .routers import analysis, nodes, edges, architecture, views, documentation, query, files, stats
    app.include_router(analysis.router, prefix="/api", tags=["Analysis"])
    app.include_router(nodes.router, prefix="/api", tags=["Nodes"])
    app.include_router(edges.router, prefix="/api", tags=["Edges"])
    app.include_router(architecture.router, prefix="/api", tags=["Architecture"])
    app.include_router(views.router, prefix="/api", tags=["Views"])
    app.include_router(documentation.router, prefix="/api", tags=["Documentation"])
    app.include_router(query.router, prefix="/api", tags=["Query"])
    app.include_router(files.router, prefix="/api", tags=["Files"])
    app.include_router(stats.router, prefix="/api", tags=["Stats"])
    
    return app
```

### 4.3 Running the Server

```bash
# Development
poetry run uvicorn syntax_tree.api.app:create_app --factory --reload --port 8000

# Production
poetry run uvicorn syntax_tree.api.app:create_app --factory --host 0.0.0.0 --port 8000
```

### 4.4 Dependencies

Add to pyproject.toml:

```toml
fastapi = ">=0.110.0"
uvicorn = {version = ">=0.27.0", extras = ["standard"]}
python-multipart = ">=0.0.6"   # for file uploads
```

---

## 5. Background Job Management

### 5.1 Job Manager

Analysis runs are long (10-120 seconds). They run as background tasks, not in the request handler.

```python
class JobManager:
    def __init__(self):
        self._jobs = {}  # job_id -> JobState
        self._current_job = None  # only one analysis at a time
    
    def start_job(self, repository_path, config) -> str:
        if self._current_job and self._current_job.status == "running":
            raise ConflictError("Another analysis is already running")
        
        job_id = str(uuid.uuid4())
        job = JobState(job_id=job_id, status="running", ...)
        self._jobs[job_id] = job
        self._current_job = job
        
        # Start in background thread
        thread = threading.Thread(target=self._run_pipeline, args=(job, repository_path, config))
        thread.start()
        
        return job_id
    
    def _run_pipeline(self, job, repository_path, config):
        try:
            # Extraction
            job.current_stage = "extraction"
            result = orchestrator.extract(repository_path)
            
            # Ingestion
            job.current_stage = "ingestion"
            graph.ingest(result)
            
            # Agents
            job.current_stage = "clustering"
            # ... run agents ...
            
            job.status = "completed"
        except Exception as e:
            job.status = "failed"
            job.error = str(e)
```

### 5.2 Progress Events

The job manager emits progress events that WebSocket connections can subscribe to. Events are stored in a queue per job. WebSocket handlers read from the queue and forward to the client.

---

## 6. Error Handling

### 6.1 Error Response Format

All error responses use a consistent JSON format:

```json
{
    "error": "Short error message",
    "detail": "Longer explanation (optional)",
    "code": "ERROR_CODE"
}
```

### 6.2 Error Codes

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | INVALID_REQUEST | Missing required parameter, invalid value |
| 404 | NOT_FOUND | Node, section, file, or job not found |
| 409 | CONFLICT | Analysis already running |
| 422 | VALIDATION_ERROR | Pydantic validation failure |
| 500 | INTERNAL_ERROR | Unhandled exception |

### 6.3 Exception Handler

```python
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc), "code": "INTERNAL_ERROR"},
    )
```

---

## 7. Performance Requirements

| Endpoint Category | Target Response Time |
|-------------------|---------------------|
| Single node lookup (GET /api/nodes/{qn}) | Under 50ms |
| Node list with filters (GET /api/nodes) | Under 200ms |
| Edge queries (GET /api/edges) | Under 200ms |
| Traversal (GET /api/traverse) | Under 300ms |
| Full-text search (GET /api/search) | Under 500ms |
| View projections (GET /api/views/*) | Under 1 second |
| Architecture overview | Under 200ms |
| Documentation TOC (GET /api/docs) | Under 200ms |
| Documentation section (GET /api/docs/{qn}) | Under 100ms |
| Query (POST /api/query, non-streaming) | Under 15 seconds |
| Query streaming first token | Under 3 seconds |
| File content (GET /api/files/{path}) | Under 100ms |
| Stats (GET /api/stats) | Under 500ms |

---

## 8. Constraints & Anti-Patterns

### 8.1 Hard Constraints

- The API layer is a thin translation layer. Business logic lives in the subsystems, not in the routers.
- View projections compute positions server-side. The frontend does NOT compute graph layouts.
- All endpoints return JSON. No HTML, no SVG.
- Only one analysis job runs at a time. Starting a second while one is running returns 409.
- WebSocket connections are stateless per-message. The server does not maintain WebSocket state between messages (except for conversation_id tracking in query).
- CORS is configured to allow the React dev server origin. In production, restrict to the actual frontend origin.
- source_text is excluded from list endpoints (/api/nodes) for performance. Use the detail endpoint (/api/nodes/{qn}) for full data.

### 8.2 Anti-Patterns

- Do NOT put graph query logic in the routers. Routers call the KnowledgeGraph API.
- Do NOT compute layouts in the frontend. The API returns positioned nodes.
- Do NOT return the entire graph in any single endpoint. Use pagination (limit/offset) and scoped queries.
- Do NOT block the request thread during analysis. Use background tasks.
- Do NOT serve the React frontend from the FastAPI server. They run separately.

---

## 9. Test Specifications

> **TEST STRATEGY:** API tests use FastAPI's TestClient for synchronous endpoints and httpx.AsyncClient for WebSocket tests. The Knowledge Graph and agents use mocked LLM. Tests verify request/response format, status codes, error handling, and data correctness.

### 9.1 Analysis Endpoint Tests

| ID | Description | Verification |
|----|-------------|--------------|
| AE-01 | POST /api/analyze with valid path returns 202 with job_id | Assert 202, job_id in response. |
| AE-02 | POST /api/analyze with invalid path returns 400 | Assert 400. |
| AE-03 | POST /api/analyze while running returns 409 | Assert 409. |
| AE-04 | GET status returns current stage and progress | Assert status fields present. |
| AE-05 | GET status for unknown job returns 404 | Assert 404. |

### 9.2 Node Endpoint Tests

| ID | Description | Verification |
|----|-------------|--------------|
| NE-01 | GET /api/nodes returns paginated list | Assert nodes array, total, limit, offset. |
| NE-02 | GET /api/nodes?type=function filters correctly | Assert all returned nodes are functions. |
| NE-03 | GET /api/nodes/{qn} returns full node with source_text | Assert source_text is present. |
| NE-04 | GET /api/nodes/{nonexistent} returns 404 | Assert 404. |
| NE-05 | GET /api/nodes/at-location returns correct node | Assert innermost node returned. |
| NE-06 | GET /api/nodes/at-location with context includes component info | Assert context.component present. |

### 9.3 View Projection Tests

| ID | Description | Verification |
|----|-------------|--------------|
| VP-01 | GET /api/views/architecture returns nodes with positions | Assert every node has position.x and position.y. |
| VP-02 | GET /api/views/layered returns layers sorted by position | Assert layers[0].position < layers[1].position. |
| VP-03 | GET /api/views/call-flow returns tree from start node | Assert start node at depth 0. Assert children at depth 1. |
| VP-04 | GET /api/views/architecture has edges with weights | Assert edges have data.total_weight. |
| VP-05 | GET /api/views/layered marks violation edges | Assert violation edges have is_violation=true. |

### 9.4 Documentation Endpoint Tests

| ID | Description | Verification |
|----|-------------|--------------|
| DE-01 | GET /api/docs returns hierarchical TOC | Assert tree structure with children. |
| DE-02 | GET /api/docs/{qn} returns full section | Assert body is non-empty. Assert code_references present. |
| DE-03 | POST /api/docs/{qn}/comment stores comment | Assert 200. GET same section shows comment in user_comments. |
| DE-04 | PUT /api/docs/{qn}/edit sets user_edited flag | Assert user_edited=true after edit. |
| DE-05 | POST /api/docs/generate creates on-demand section | Assert new section QN returned. Assert it's queryable. |

### 9.5 Query Endpoint Tests

| ID | Description | Verification |
|----|-------------|--------------|
| QE-01 | POST /api/query returns complete response | Assert answer_text, citations, follow_ups. |
| QE-02 | POST /api/query with conversation_id tracks turns | Assert turn_number increments. |
| QE-03 | POST /api/query about nonexistent entity has low confidence | Assert confidence < 0.8. |

### 9.6 File Endpoint Tests

| ID | Description | Verification |
|----|-------------|--------------|
| FE-01 | GET /api/files lists all files | Assert files array. Assert each has file_path, language. |
| FE-02 | GET /api/files/{path} returns content and entities | Assert content is non-empty. Assert entities list. |
| FE-03 | GET /api/files/{nonexistent} returns 404 | Assert 404. |

---

## 10. Extensibility

### 10.1 Adding New View Projections

Each view projection is a module in `api/projections/`. To add a new view: create a new module that reads from the graph and returns a positioned node/edge structure, add a route in `routers/views.py`, add the layout algorithm to `layout.py` if needed.

### 10.2 Adding Authentication

When moving from local to multi-user: add JWT authentication middleware, add user_id to comment and edit operations, add authorization checks per endpoint.

### 10.3 File Upload

The initial build takes a local path. To support browser-based upload: add a POST /api/upload endpoint that accepts a ZIP file, extracts it to a temp directory, then starts analysis on that directory.
