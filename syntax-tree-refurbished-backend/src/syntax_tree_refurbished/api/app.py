"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI

from syntax_tree_refurbished import __version__
from syntax_tree_refurbished.api.routes.analyze import router as analyze_router
from syntax_tree_refurbished.api.routes.architecture_map import router as architecture_map_router
from syntax_tree_refurbished.api.routes.architectural_explanation import (
    router as architectural_explanation_router,
)
from syntax_tree_refurbished.api.routes.anchors import router as anchors_router
from syntax_tree_refurbished.api.routes.browse import router as browse_router
from syntax_tree_refurbished.api.routes.grounding import router as grounding_router
from syntax_tree_refurbished.api.routes.health import router as health_router
from syntax_tree_refurbished.api.routes.investigation import router as investigation_router
from syntax_tree_refurbished.api.routes.orientation import router as orientation_router
from syntax_tree_refurbished.api.routes.docs import router as docs_router
from syntax_tree_refurbished.api.routes.flows import router as flows_router
from syntax_tree_refurbished.api.routes.query import router as query_router
from syntax_tree_refurbished.api.routes.runs import router as runs_router
from syntax_tree_refurbished.api.routes.settings import router as settings_router
from syntax_tree_refurbished.api.routes.source import router as source_router
from syntax_tree_refurbished.api.routes.symbols import router as symbols_router
from syntax_tree_refurbished.api.routes.system_overview import router as system_overview_router
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.analysis.sqlite_run_store import SQLiteRunStore
from syntax_tree_refurbished.app.architectural_explanation.runtime_config import (
    ArchExplanationRuntimeConfig,
)
from syntax_tree_refurbished.config import Settings, load_settings
from syntax_tree_refurbished.logging import configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or load_settings()
    configure_logging(resolved.log_level)

    app = FastAPI(
        title=resolved.app_name,
        version=__version__,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.state.settings = resolved
    app.state.run_store = (
        InMemoryRunStore()
        if resolved.database_path == ":memory:" or resolved.environment == "test"
        else SQLiteRunStore(resolved.database_path)
    )
    app.state.arch_explanation_runtime_config = ArchExplanationRuntimeConfig()
    app.include_router(analyze_router, prefix="/api")
    app.include_router(architecture_map_router, prefix="/api")
    app.include_router(architectural_explanation_router, prefix="/api")
    app.include_router(anchors_router, prefix="/api")
    app.include_router(browse_router, prefix="/api")
    app.include_router(grounding_router, prefix="/api")
    app.include_router(health_router, prefix="/api")
    app.include_router(investigation_router, prefix="/api")
    app.include_router(orientation_router, prefix="/api")
    app.include_router(docs_router, prefix="/api")
    app.include_router(flows_router, prefix="/api")
    app.include_router(query_router, prefix="/api")
    app.include_router(runs_router, prefix="/api")
    app.include_router(settings_router, prefix="/api")
    app.include_router(symbols_router, prefix="/api")
    app.include_router(system_overview_router, prefix="/api")
    app.include_router(source_router, prefix="/api")
    return app
