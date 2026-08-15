"""Bounded, source-backed retrieval used when no external model is configured."""

from __future__ import annotations

from dataclasses import dataclass, replace
import re
from typing import Any

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.analysis.static_structure import module_component_id
from syntax_tree_refurbished.app.evidence.source_reader import SourceReadError, SourceReader
from syntax_tree_refurbished.core.models.source_region import SourceRegion
from syntax_tree_refurbished.core.models.system_overview import SystemOverview


STOP_WORDS = {
    "a", "all", "an", "and", "are", "component", "does", "file", "files",
    "find", "for", "how", "in", "is", "it", "of", "repository", "the",
    "this", "to", "what", "where", "which",
}
ALIASES = {
    "analysis": "analyze", "analyzer": "analyze", "analyzes": "analyze",
    "called": "call", "calls": "call", "calling": "call",
    "dependencies": "depend", "dependency": "depend", "depends": "depend",
    "docs": "document", "documentation": "document", "documents": "document",
    "errors": "error", "generated": "generate", "generates": "generate",
    "handles": "handle", "imports": "import", "parses": "parse", "parser": "parse",
    "started": "start", "starting": "start", "stored": "store", "stores": "store",
    "typescript": "typescript", "validates": "validate", "validation": "validate",
}
REFERENCE_ACTIONS = {"call", "import", "reference", "use"}
CONCEPT_TERMS = {
    "analyze": {"analyze", "process", "service", "workflow"},
    "depend": {"depend", "import", "model", "record", "reference", "repository", "type"},
    "document": {"describe", "display", "doc", "document", "guide", "readme", "report"},
    "error": {"catch", "error", "exception", "invalid", "raise", "validate"},
    "generate": {"build", "create", "describe", "generate", "render"},
    "handle": {"analyze", "controller", "handle", "process", "service", "validate"},
    "parse": {"decode", "parse"},
    "start": {"api", "bootstrap", "create", "entry", "index", "main", "start"},
    "store": {"database", "model", "persist", "record", "repository", "store"},
    "validate": {"check", "error", "invalid", "validate"},
}


@dataclass(frozen=True)
class SearchCandidate:
    id: str
    kind: str
    name: str
    qualified_name: str
    path: str
    language: str
    start_line: int
    end_line: int
    signature: str
    region: SourceRegion
    module_id: str
    score: float = 0.0


class LocalSearchEngine:
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore, overview: SystemOverview):
        self._job = job
        self._store = store
        self._overview = overview
        self._reader = SourceReader(job)

    def search(self, question: str, *, limit: int = 10) -> list[dict[str, Any]]:
        terms = _query_terms(question)
        if not terms:
            return []
        reference_intent = bool(set(terms) & REFERENCE_ACTIONS)
        target_terms = tuple(term for term in terms if term not in REFERENCE_ACTIONS)
        scored: list[SearchCandidate] = []
        for candidate in self._candidates():
            score = _score_candidate(candidate, terms, target_terms, reference_intent)
            if score > 0:
                scored.append(replace(candidate, score=score))
        scored.sort(key=lambda item: (-item.score, item.path, item.start_line, item.name))
        return [self._lens(candidate, question, rank=index + 1) for index, candidate in enumerate(scored[:limit])]

    def lens_for_subject(self, subject_id: str) -> dict[str, Any] | None:
        candidate = next((item for item in self._candidates() if item.id == subject_id), None)
        return self._lens(replace(candidate, score=1.0), candidate.name, rank=1) if candidate else None

    def _candidates(self) -> tuple[SearchCandidate, ...]:
        output: list[SearchCandidate] = []
        for symbol in self._store.get_symbols(self._job.run_id):
            region = self._store.get_region(symbol.source_region_id)
            if not region:
                try:
                    region = self._reader.read_range(symbol.path, symbol.start_line, symbol.end_line)
                except SourceReadError:
                    continue
                self._store.put_region(region)
            output.append(SearchCandidate(
                id=symbol.id,
                kind=symbol.kind,
                name=symbol.name,
                qualified_name=symbol.qualified_name,
                path=symbol.path,
                language=symbol.language,
                start_line=symbol.start_line,
                end_line=symbol.end_line,
                signature=symbol.signature,
                region=region,
                module_id=module_component_id(self._job.run_id, symbol.path),
            ))
        by_path = {
            component.related_file_paths[0]: component
            for component in self._overview.main_components
            if component.kind == "module" and component.related_file_paths
        }
        for path, component in by_path.items():
            try:
                file = self._reader.get_file(path)
                region = self._reader.read_range(path, 1, max(1, min(file.line_count, 2_000)))
            except SourceReadError:
                continue
            self._store.put_region(region)
            output.append(SearchCandidate(
                id=component.id,
                kind="module",
                name=path,
                qualified_name=path,
                path=path,
                language=file.language,
                start_line=region.start_line,
                end_line=region.end_line,
                signature="",
                region=region,
                module_id=component.id,
            ))
        return tuple(output)

    def _lens(self, candidate: SearchCandidate, question: str, *, rank: int) -> dict[str, Any]:
        confidence = min(1.0, 0.35 + candidate.score / 24.0)
        summary = (
            f"{candidate.kind.replace('_', ' ').title()} `{candidate.qualified_name}` in "
            f"`{candidate.path}` at lines {candidate.start_line}-{candidate.end_line}."
        )
        evidence = {
            "id": f"evidence:{candidate.region.id}",
            "analysis_run_id": self._job.run_id,
            "node_id": candidate.id,
            "evidence_kind": "local_source_search",
            "source_ref_kind": "source_span",
            "source_ref_id": candidate.region.id,
            "file_path": candidate.path,
            "language": candidate.language,
            "start_line": candidate.start_line,
            "end_line": candidate.end_line,
            "text_preview": _preview(candidate.region.text),
            "status": "verified",
            "confidence": confidence,
            "score": candidate.score,
            "reason": f"Source-backed local match for: {question}",
            "is_stale": False,
        }
        source_tab = {
            "file_path": candidate.path,
            "language": candidate.language,
            "role": "primary",
            "summary": summary,
            "reason": "Ranked local source match.",
            "source_span_ids": [candidate.region.id],
            "highlights": [{
                "span_id": candidate.region.id,
                "start_line": candidate.start_line,
                "end_line": candidate.end_line,
                "status": "verified",
                "confidence": confidence,
            }],
            "is_stale": False,
        }
        return {
            "id": candidate.id,
            "analysis_run_id": self._job.run_id,
            "type": "semantic_search_result",
            "title": candidate.name,
            "summary": summary,
            "status": "verified",
            "intent": "source_retrieval",
            "subject_type": "source_span",
            "subject_id": candidate.region.id,
            "description": summary,
            "simple_explanation": summary,
            "technical_explanation": candidate.signature or summary,
            "confidence": confidence,
            "steps": [{
                "id": f"{candidate.id}:source",
                "label": f"Open {candidate.path}",
                "step_type": "source_definition" if candidate.kind != "module" else "source_module",
                "status": "verified",
                "confidence": confidence,
                "source_span_id": candidate.region.id,
                "file_path": candidate.path,
                "start_line": candidate.start_line,
                "end_line": candidate.end_line,
                "gap_reason": "",
            }],
            "evidence": [evidence],
            "source_tabs": [source_tab],
            "related_architecture_node_ids": [candidate.module_id],
            "related_concept_ids": [],
            "related_flow_ids": [],
            "gaps": [],
            "searched_areas": [candidate.path],
            "unsupported_reason": "",
            "metadata": {
                "relevance_score": confidence,
                "raw_relevance_score": candidate.score,
                "rank": rank,
                "kind": candidate.kind,
                "path": candidate.path,
                "qualified_name": candidate.qualified_name,
                "module_id": candidate.module_id,
                "retrieval": "local_source_index",
            },
        }


def local_query_response(
    *,
    job: AnalysisJob,
    question: str,
    conversation_id: str,
    lenses: list[dict[str, Any]],
    intent: str,
) -> dict[str, Any]:
    answer_text = (
        f"Found {len(lenses)} source-backed result(s) in {job.snapshot.repo_name}."
        if lenses
        else f"No source-backed matches were found in {job.snapshot.repo_name}."
    )
    evidence_count = sum(len(lens["evidence"]) for lens in lenses)
    return {
        "analysis_run_id": job.run_id,
        "answer_text": answer_text,
        "intent": intent,
        "citations": [
            {
                "entity_qn": lens["metadata"]["qualified_name"],
                "entity_name": lens["title"],
                "file_path": lens["metadata"]["path"],
                "line_start": lens["steps"][0]["start_line"],
                "line_end": lens["steps"][0]["end_line"],
                "support_status": "verified",
            }
            for lens in lenses
        ],
        "confidence": max((lens["confidence"] for lens in lenses), default=0.0),
        "follow_ups": [],
        "diagrams": [],
        "visual_lenses": lenses,
        "lens_count": len(lenses),
        "unsupported_reasons": [],
        "evidence_coverage": {
            "lens_count": len(lenses),
            "evidence_count": evidence_count,
            "source_tab_count": len(lenses),
            "statuses": ["verified"] if lenses else [],
            "types": ["semantic_search_result"] if lenses else [],
        },
        "conversation_id": conversation_id,
        "turn_number": 1,
        "run_metadata": {
            "llm_call_count": 0,
            "tokens_in": 0,
            "tokens_out": 0,
            "fallback_used": True,
            "model": "local_source_index",
            "files_inspected": sorted({lens["metadata"]["path"] for lens in lenses}),
            "symbols_inspected": [lens["metadata"]["qualified_name"] for lens in lenses],
            "evidence_sources": [lens["subject_id"] for lens in lenses],
            "unresolved_gaps": [] if lenses else ["No lexical source match for the submitted query."],
        },
    }


def _score_candidate(
    candidate: SearchCandidate,
    terms: tuple[str, ...],
    target_terms: tuple[str, ...],
    reference_intent: bool,
) -> float:
    name_terms = _token_set(candidate.name)
    qualified_terms = _token_set(candidate.qualified_name)
    path_terms = _token_set(candidate.path)
    signature_terms = _token_set(candidate.signature)
    source_terms = _token_set(candidate.region.text[:300_000])
    score = 0.0
    matched = 0
    for term in terms:
        term_score = _concept_match_score(
            term,
            name_terms=name_terms,
            qualified_terms=qualified_terms,
            path_terms=path_terms,
            signature_terms=signature_terms,
            source_terms=source_terms,
        )
        if term_score:
            matched += 1
            score += term_score
    if matched:
        score += 4.0 * matched / len(terms)
    if reference_intent and target_terms and all(_concept_present(term, source_terms) for term in target_terms):
        named_target = all(term in name_terms for term in target_terms)
        score += -4.0 if named_target else 9.0
    if candidate.kind == "module" and score > 0:
        score += 0.25
    return score


def _concept_match_score(
    term: str,
    *,
    name_terms: set[str],
    qualified_terms: set[str],
    path_terms: set[str],
    signature_terms: set[str],
    source_terms: set[str],
) -> float:
    score = 0.0
    concepts = CONCEPT_TERMS.get(term, {term})
    for concept in concepts:
        factor = 1.0 if concept == term else 0.65
        if concept in name_terms:
            score = max(score, 8.0 * factor)
        if concept in qualified_terms:
            score = max(score, 6.0 * factor)
        if concept in path_terms:
            score = max(score, 4.0 * factor)
        if concept in signature_terms:
            score = max(score, 3.0 * factor)
        if concept in source_terms:
            score = max(score, 1.5 * factor)
    return score


def _concept_present(term: str, haystack: set[str]) -> bool:
    return bool(CONCEPT_TERMS.get(term, {term}) & haystack)


def _query_terms(text: str) -> tuple[str, ...]:
    return tuple(dict.fromkeys(term for term in _tokens(text) if term not in STOP_WORDS))


def _token_set(text: str) -> set[str]:
    return set(_tokens(text))


def _tokens(text: str) -> tuple[str, ...]:
    expanded = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    raw = re.findall(r"[A-Za-z0-9]+", expanded.lower())
    return tuple(_normalize_token(token) for token in raw if token)


def _normalize_token(token: str) -> str:
    if token in ALIASES:
        return ALIASES[token]
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("ing") and len(token) > 5:
        return token[:-3]
    if token.endswith("s") and len(token) > 4:
        return token[:-1]
    return token


def _preview(text: str, limit: int = 420) -> str:
    return " ".join(text.strip().split())[:limit]
