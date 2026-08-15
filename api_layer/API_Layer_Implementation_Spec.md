# Syntax Tree — API Layer Implementation Spec

> **Purpose:** Complete implementation guide for the API Layer (Subsystem D, Part 1). Covers all REST endpoints, WebSocket streaming, view projections, and background job management.

> **Companion document:** API Layer Design — defines all endpoints, request/response formats, view projection algorithms, and constraints.

---

## Project Context

Built inside the same `syntax_tree` package. Adds modules under `syntax_tree/api/`.

### New Dependencies

```toml
[tool.poetry.dependencies]
fastapi = ">=0.110.0"
uvicorn = {version = ">=0.27.0", extras = ["standard"]}
python-multipart = ">=0.0.6"
httpx = ">=0.27.0"  # for testing async endpoints
```

---

## CRITICAL RULES

1. **Routers are thin.** They parse requests, call subsystem APIs, format responses. No business logic.

2. **View projections compute positions server-side.** The frontend receives pre-positioned nodes.

3. **source_text excluded from list endpoints.** Only detail endpoints include full source.

4. **One analysis at a time.** Second analysis while one is running returns 409.

5. **All endpoints return JSON.** Consistent error format.

6. **All tests use FastAPI TestClient with mocked graph and LLM.** No real API calls, no real filesystem access.

---

## TASK 1: Core API + Graph Endpoints

### Goal
After this task: the FastAPI app exists, node/edge/traverse/search/stats endpoints work, file endpoints work, and the analysis trigger endpoint starts a background job. No view projections yet.

### Files to Create

#### 1. `syntax_tree/api/app.py`

Application factory. Exact implementation from design doc Section 4.2.
Include CORS middleware, include all routers, add global exception handler.

#### 2. `syntax_tree/api/dependencies.py`

```python
"""Shared dependencies injected into routers."""
from syntax_tree.graph import KnowledgeGraph, KnowledgeGraphConfig
from syntax_tree.agents import LLMClient, LLMConfig, QueryAgent

# Global instances (initialized on first request or at startup)
_graph: KnowledgeGraph | None = None
_llm: LLMClient | None = None
_query_agent: QueryAgent | None = None
_repository_path: str | None = None

def get_graph() -> KnowledgeGraph:
    if _graph is None:
        raise HTTPException(503, detail="No analysis loaded. Run POST /api/analyze first.")
    return _graph

def get_llm() -> LLMClient:
    if _llm is None:
        _llm = LLMClient(LLMConfig())
    return _llm

def get_query_agent() -> QueryAgent:
    if _query_agent is None:
        raise HTTPException(503, detail="No analysis loaded.")
    return _query_agent

def set_graph(graph: KnowledgeGraph, repo_path: str):
    global _graph, _query_agent, _repository_path
    _graph = graph
    _repository_path = repo_path
    _query_agent = QueryAgent(graph=graph, llm=get_llm())
```

#### 3. `syntax_tree/api/jobs.py`

Background job management. JobManager and JobState classes from design doc Section 5.

#### 4. `syntax_tree/api/models/requests.py`

Pydantic request models for all endpoints:
- `AnalyzeRequest(repository_path: str, config: dict = {})`
- `QueryRequest(question: str, conversation_id: str | None = None)`
- `CommentRequest(text: str)`
- `EditRequest(body: str)`
- `GenerateDocsRequest(scope_qn: str, focus: str = "", user_request: str = "")`

#### 5. `syntax_tree/api/models/responses.py`

Pydantic response models matching every response format from design doc Section 2.
Key models: `NodeResponse`, `EdgeResponse`, `PaginatedNodes`, `TraversalResponse`, `SearchResponse`, `StatsResponse`, `ViewProjectionResponse`, `DocSectionResponse`, `QueryResponseModel`, etc.

#### 6. `syntax_tree/api/routers/analysis.py`

- POST /api/analyze → starts background job, returns job_id
- GET /api/analyze/{job_id}/status → returns job status
- WebSocket /ws/analyze/{job_id} → streams progress events

#### 7. `syntax_tree/api/routers/nodes.py`

- GET /api/nodes → paginated, filtered node list
- GET /api/nodes/{qn} → single node with source_text
- GET /api/nodes/at-location → node at file:line with architectural context

For at-location, also look up the node's component, subsystem, and layer:
```python
@router.get("/nodes/at-location")
async def get_node_at_location(file_path: str, line: int, graph = Depends(get_graph)):
    node = graph.get_node_at_location(file_path, line)
    if not node:
        raise HTTPException(404, "No node at this location")
    
    # Get architectural context
    context = {}
    comp_edges = graph.get_edges(source_qn=node.qualified_name, edge_type="BELONGS_TO_COMPONENT")
    if comp_edges:
        comp = graph.get_node(comp_edges[0].target_qn)
        context["component"] = comp.qualified_name if comp else None
        
        sub_edges = graph.get_edges(source_qn=comp_edges[0].target_qn, edge_type="BELONGS_TO_SUBSYSTEM")
        if sub_edges:
            context["subsystem"] = sub_edges[0].target_qn
    
    return {"node": node_to_response(node), "context": context}
```

#### 8. `syntax_tree/api/routers/edges.py`

- GET /api/edges → filtered edge list with pagination
- GET /api/traverse → graph traversal with optional detail inclusion
- GET /api/search → full-text search with snippets

#### 9. `syntax_tree/api/routers/architecture.py`

- GET /api/components, /api/components/{qn}
- GET /api/subsystems, /api/subsystems/{qn}
- GET /api/layers
- GET /api/patterns
- GET /api/violations
- GET /api/architecture/overview

Each endpoint reads from the graph and formats the response. Component detail includes members, dependencies, layer, and subsystem.

#### 10. `syntax_tree/api/routers/files.py`

- GET /api/files → list from file_manifest
- GET /api/files/{path} → read file content from disk, include entity list from graph

```python
@router.get("/files/{path:path}")
async def get_file_content(path: str, graph = Depends(get_graph)):
    full_path = os.path.join(_repository_path, path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "File not found")
    
    content = open(full_path, "r", encoding="utf-8").read()
    
    entities = graph.find_nodes(file_path=path)
    entity_list = [{"qualified_name": e.qualified_name, "type": e.type, 
                    "name": e.name, "line_start": e.line_start, 
                    "line_end": e.line_end} for e in entities]
    
    return {"file_path": path, "content": content, "entities": entity_list,
            "line_count": content.count("\n") + 1, "language": entities[0].language if entities else "unknown"}
```

#### 11. `syntax_tree/api/routers/stats.py`

- GET /api/stats → delegates to graph.get_stats()

### Test Files

**`tests/test_api_core.py`:**

```python
from fastapi.testclient import TestClient

@pytest.fixture
def client(fully_analyzed_graph):
    """TestClient with a pre-analyzed graph loaded."""
    from syntax_tree.api.app import create_app
    from syntax_tree.api import dependencies
    dependencies._graph = fully_analyzed_graph
    dependencies._repository_path = "/test/repo"
    
    app = create_app()
    return TestClient(app)

def test_get_nodes(client):
    r = client.get("/api/nodes?type=function")
    assert r.status_code == 200
    data = r.json()
    assert "nodes" in data
    assert "total" in data

def test_get_node_by_qn(client):
    r = client.get("/api/nodes/python%3Asrc%2Futils.py%3A%3Avalidate_name")
    assert r.status_code == 200
    assert r.json()["type"] == "function"

def test_get_node_not_found(client):
    r = client.get("/api/nodes/nonexistent")
    assert r.status_code == 404

def test_search(client):
    r = client.get("/api/search?q=validate")
    assert r.status_code == 200
    assert len(r.json()["results"]) > 0

def test_stats(client):
    r = client.get("/api/stats")
    assert r.status_code == 200
    assert r.json()["total_nodes"] > 0

def test_edges(client):
    r = client.get("/api/edges?edge_type=CALLS")
    assert r.status_code == 200

def test_traverse(client):
    r = client.get("/api/traverse?start_qn=python%3Asrc%2Futils.py%3A%3Avalidate_name&direction=incoming&max_depth=2")
    assert r.status_code == 200

def test_components(client):
    r = client.get("/api/components")
    assert r.status_code == 200
    assert len(r.json()["components"]) > 0

def test_architecture_overview(client):
    r = client.get("/api/architecture/overview")
    assert r.status_code == 200
    assert "health_score" in r.json()

def test_files_list(client):
    r = client.get("/api/files")
    assert r.status_code == 200

def test_no_graph_returns_503(self):
    """Endpoints return 503 when no analysis has been run."""
    from syntax_tree.api import dependencies
    dependencies._graph = None
    
    app = create_app()
    client = TestClient(app)
    r = client.get("/api/nodes")
    assert r.status_code == 503
```

Implement tests AE-01 through AE-05, NE-01 through NE-06, FE-01 through FE-03 from design doc Section 9.

### Task 1 Completion Criteria

`poetry run pytest tests/test_api_core.py -v` — ALL pass.

---

## TASK 2: View Projections + Documentation/Query Endpoints

### Goal
After this task: all five view projection endpoints return positioned, render-ready data. Documentation and query endpoints work. The complete API layer is functional.

### Files to Create

#### 1. `syntax_tree/api/projections/layout.py`

Layout algorithms: `tree_layout`, `grid_layout`, `spring_layout_wrapper`, `layered_layout`.
Implementation from design doc Section 3.

#### 2. `syntax_tree/api/projections/architecture_view.py`

**Function: `compute_architecture_view(graph) -> dict`**

1. Get all subsystems, components, membership edges.
2. Build component interaction edges (aggregate CALLS/IMPORTS between component members).
3. Compute positions: grid layout for subsystems, spring layout for components within subsystems.
4. Return the view structure from design doc Section 2.4.

#### 3. `syntax_tree/api/projections/layered_view.py`

**Function: `compute_layered_view(graph) -> dict`**

1. Get all layers sorted by position.
2. Get components per layer.
3. Compute positions: horizontal bands per layer, components distributed on x-axis.
4. Compute edges with violation marking (is_violation = True if wrong direction or layer skip).
5. Return the view structure.

#### 4. `syntax_tree/api/projections/dependency_view.py`

**Function: `compute_dependency_view(graph, scope_qn, depth, edge_types) -> dict`**

1. If scope_qn provided, traverse outgoing from it to depth.
2. Get full node data for traversal results.
3. Compute positions: spring layout centered on scope.
4. Return the view structure.

#### 5. `syntax_tree/api/projections/call_flow_view.py`

**Function: `compute_call_flow_view(graph, start_qn, max_depth) -> dict`**

1. Traverse outgoing CALLS from start_qn to max_depth.
2. Build tree structure (parent-child based on call edges).
3. Compute positions: tree layout, root at top.
4. Return the view structure with depth annotations.

#### 6. `syntax_tree/api/projections/data_flow_view.py`

**Function: `compute_data_flow_view(graph) -> dict`**

1. Get all READS_FROM and WRITES_TO edges.
2. Get component and infrastructure nodes involved.
3. Compute positions: components on left, infrastructure on right.
4. Return the view structure with dashed-line styling for heuristic edges.

#### 7. `syntax_tree/api/routers/views.py`

- GET /api/views/architecture → compute_architecture_view(graph)
- GET /api/views/layered → compute_layered_view(graph)
- GET /api/views/dependency → compute_dependency_view(graph, scope_qn, depth, edge_types)
- GET /api/views/call-flow → compute_call_flow_view(graph, start_qn, max_depth)
- GET /api/views/data-flow → compute_data_flow_view(graph)

Each endpoint calls its projection function and returns the result.

#### 8. `syntax_tree/api/routers/documentation.py`

All documentation endpoints from design doc Section 2.5:
- GET /api/docs → build hierarchical TOC from documentation_section nodes
- GET /api/docs/{qn} → return full section data
- POST /api/docs/{qn}/comment → delegate to DocumentationAgent.add_comment
- PUT /api/docs/{qn}/edit → delegate to DocumentationAgent.save_edit
- POST /api/docs/{qn}/regenerate → delegate to DocumentationAgent.regenerate
- POST /api/docs/generate → delegate to DocumentationAgent.generate_for_scope
- GET /api/docs/staleness → delegate to DocumentationAgent.check_staleness

#### 9. `syntax_tree/api/routers/query.py`

- POST /api/query → delegate to QueryAgent.query(), return QueryResponse
- WebSocket /ws/query → delegate to QueryAgent.query() and stream chunks

```python
@router.websocket("/ws/query")
async def query_websocket(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_json()
            question = data.get("question")
            conv_id = data.get("conversation_id")
            
            query_agent = get_query_agent()
            
            # For initial build: non-streaming query, send result as one message
            # TODO: implement streaming in future iteration
            response = query_agent.query(question, conv_id)
            
            await websocket.send_json({
                "type": "complete",
                "data": {
                    "answer_text": response.answer_text,
                    "intent": response.intent,
                    "citations": [c.__dict__ for c in response.citations],
                    "confidence": response.confidence,
                    "follow_ups": list(response.follow_up_suggestions),
                    "diagrams": list(response.embedded_diagrams),
                    "conversation_id": response.conversation_id,
                    "turn_number": response.turn_number,
                }
            })
    except WebSocketDisconnect:
        pass
```

### Test Files

**`tests/test_api_views.py`:**

Implement tests VP-01 through VP-05 from design doc Section 9.3.

```python
def test_architecture_view_has_positions(client):
    r = client.get("/api/views/architecture")
    assert r.status_code == 200
    data = r.json()
    for node in data.get("nodes", []):
        assert "position" in node
        assert "x" in node["position"]
        assert "y" in node["position"]

def test_layered_view_sorted(client):
    r = client.get("/api/views/layered")
    assert r.status_code == 200
    layers = r.json()["layers"]
    positions = [l["position"] for l in layers]
    assert positions == sorted(positions)

def test_call_flow_view(client):
    # Use a known function QN
    r = client.get("/api/views/call-flow?start_qn=python%3Asrc%2Fservice.py%3A%3AUserService.create_user&max_depth=2")
    assert r.status_code == 200
    data = r.json()
    assert data["start"] is not None
    assert len(data["nodes"]) > 0

def test_view_edges_have_weights(client):
    r = client.get("/api/views/architecture")
    data = r.json()
    for edge in data.get("edges", []):
        assert "data" in edge
```

**`tests/test_api_docs.py`:**

Implement tests DE-01 through DE-05 from design doc Section 9.4.

**`tests/test_api_query.py`:**

Implement tests QE-01 through QE-03 from design doc Section 9.5.

### Task 2 Completion Criteria

`poetry run pytest tests/ -v` — ALL tests pass across the entire project. The API layer is complete.

### Running the Full Stack

After both tasks:

```bash
# Terminal 1: Start the API server
poetry run uvicorn syntax_tree.api.app:create_app --factory --reload --port 8000

# Terminal 2: Trigger analysis
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repository_path": "/path/to/your/repo"}'

# Terminal 3: Query the API
curl http://localhost:8000/api/stats
curl http://localhost:8000/api/components
curl http://localhost:8000/api/views/architecture
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How is this codebase organized?"}'

# Interactive API docs
open http://localhost:8000/docs
```

---

## Summary

| Task | Creates | Tests | After Completion |
|------|---------|-------|-----------------|
| Task 1 | FastAPI app, dependencies, job manager, node/edge/traverse/search/stats/architecture/files routers, request/response models | ~25 tests | Core API works. Can query nodes, edges, architecture data, files. Analysis trigger exists. |
| Task 2 | 5 view projections with layout algorithms, documentation endpoints, query endpoints with WebSocket, views router | ~15 tests | Complete API layer. View projections return positioned data. Docs and query endpoints work. |

After both tasks, the entire backend is API-accessible. The React frontend (Part 2 of Subsystem D) can be built against these endpoints. The FastAPI auto-generated docs at /docs provide an interactive API explorer for testing during frontend development.
