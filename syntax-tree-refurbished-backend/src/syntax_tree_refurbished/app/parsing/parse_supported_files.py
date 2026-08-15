"""Parse supported source files into a small symbol index."""

from __future__ import annotations

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.evidence.source_reader import SourceReader
from syntax_tree_refurbished.app.parsing.js_ts_symbol_parser import parse_js_ts_symbols
from syntax_tree_refurbished.app.parsing.parser_capabilities import is_deep_parse_language
from syntax_tree_refurbished.app.parsing.python_symbol_parser import parse_python_symbols
from syntax_tree_refurbished.core.models.parsed_symbol import ParsedSymbol


def parse_supported_files(job: AnalysisJob) -> tuple[ParsedSymbol, ...]:
    if not job.snapshot:
        return ()
    reader = SourceReader(job)
    symbols: list[ParsedSymbol] = []
    for file in job.snapshot.files:
        if not file.readable or not is_deep_parse_language(file.language):
            continue
        try:
            if file.language == "python":
                symbols.extend(parse_python_symbols(reader, file, job.run_id))
            elif file.language in {"javascript", "typescript"}:
                symbols.extend(parse_js_ts_symbols(reader, file, job.run_id))
        except Exception:
            # Parser precision must never break source access or analysis.
            continue
    return tuple(sorted(symbols, key=lambda symbol: (symbol.path, symbol.start_line, symbol.name)))

