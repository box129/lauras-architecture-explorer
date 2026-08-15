"""Uvicorn entrypoint."""

from syntax_tree_refurbished.api.app import create_app

app = create_app()

