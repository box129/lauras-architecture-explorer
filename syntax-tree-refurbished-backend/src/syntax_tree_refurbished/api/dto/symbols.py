"""Parsed symbol DTOs."""

from __future__ import annotations

from pydantic import BaseModel, Field

from syntax_tree_refurbished.api.dto.source import SourceRegionDTO
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol


class ParsedSymbolDTO(BaseModel):
    id: str
    analysis_run_id: str
    path: str
    language: str
    name: str
    qualified_name: str
    kind: str
    start_line: int
    end_line: int
    source_region_id: str
    signature: str
    exported: bool
    async_: bool
    parent_symbol_id: str | None
    stable_entity_key: str = ""

    @classmethod
    def from_domain(cls, symbol: ParsedSymbol) -> "ParsedSymbolDTO":
        return cls(
            id=symbol.id,
            analysis_run_id=symbol.run_id,
            path=symbol.path,
            language=symbol.language,
            name=symbol.name,
            qualified_name=symbol.qualified_name,
            kind=symbol.kind,
            start_line=symbol.start_line,
            end_line=symbol.end_line,
            source_region_id=symbol.source_region_id,
            signature=symbol.signature,
            exported=symbol.exported,
            async_=symbol.async_,
            parent_symbol_id=symbol.parent_symbol_id,
            stable_entity_key=symbol.stable_entity_key,
        )


class SymbolListResponse(BaseModel):
    analysis_run_id: str
    symbols: list[ParsedSymbolDTO]
    total: int


class FindDefinitionRequest(BaseModel):
    query: str = Field(min_length=1)
    run_id: str | None = None
    path: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class DefinitionHitDTO(BaseModel):
    symbol: ParsedSymbolDTO
    region: SourceRegionDTO
    score: float
    method: str


class FindDefinitionResponse(BaseModel):
    analysis_run_id: str
    query: str
    hits: list[DefinitionHitDTO]
    total: int


class FindReferencesRequest(BaseModel):
    query: str = Field(min_length=1)
    run_id: str | None = None
    path: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class ReferenceHitDTO(BaseModel):
    region: SourceRegionDTO
    matched_lines: list[int]
    score: float
    method: str


class FindReferencesResponse(BaseModel):
    analysis_run_id: str
    query: str
    hits: list[ReferenceHitDTO]
    total: int

