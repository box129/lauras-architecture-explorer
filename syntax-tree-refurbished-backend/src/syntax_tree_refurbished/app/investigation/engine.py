"""Self-directing LLM investigation loop."""

from __future__ import annotations

from typing import Any
import time

from syntax_tree_refurbished.app.analysis.analysis_job import AnalysisJob
from syntax_tree_refurbished.app.analysis.run_store import InMemoryRunStore
from syntax_tree_refurbished.app.grounding.citation_validator import CitationValidator
from syntax_tree_refurbished.app.investigation.llm_model import InvestigationModel, NoConfiguredModel
from syntax_tree_refurbished.app.investigation.prompts import (
    SYSTEM_PROMPT,
    final_synthesis_prompt,
    initial_user_prompt,
    observation_prompt,
)
from syntax_tree_refurbished.app.investigation.tool_executor import InvestigationToolExecutor
from syntax_tree_refurbished.core.models.grounding import Claim
from syntax_tree_refurbished.core.models.investigation import (
    InvestigationAnswer,
    InvestigationMetrics,
    InvestigationRequest,
    InvestigationResult,
    ToolTraceEntry,
)


class InvestigationEngine:
    def __init__(self, *, job: AnalysisJob, store: InMemoryRunStore, model: InvestigationModel):
        self._job = job
        self._store = store
        self._model = model
        self._tools = InvestigationToolExecutor(job=job, store=store)

    def investigate(self, request: InvestigationRequest) -> InvestigationResult:
        started = time.monotonic()
        if isinstance(self._model, NoConfiguredModel):
            if request.validation_mode:
                return self._failed_result(request, "No live LLM configured in validation mode.", started)
            return self._degraded_result(request, "No live LLM configured.", started)

        brief = self._brief(request)
        state: dict[str, Any] = {}
        trace: list[ToolTraceEntry] = []
        all_region_ids: list[str] = []
        tokens_in = 0
        tokens_out = 0
        model_name = self._model.model_name
        llm_success = False
        messages = [{"role": "user", "content": initial_user_prompt(brief)}]
        final: dict[str, Any] | None = None
        last_empty_or_error = False

        while len(trace) < request.budget.max_tool_calls:
            elapsed = time.monotonic() - started
            if elapsed > request.budget.timeout_seconds:
                final, tokens_in, tokens_out, llm_success, model_name = self._try_final_synthesis(
                    request=request,
                    final=final,
                    state=state,
                    trace=tuple(trace),
                    region_ids=tuple(all_region_ids),
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    model_name=model_name,
                    llm_success=llm_success,
                    gap="Investigation stopped because timeout budget was reached.",
                )
                return self._partial_result(
                    request=request,
                    final=final,
                    state=state,
                    trace=trace,
                    region_ids=tuple(all_region_ids),
                    started=started,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    model_name=model_name,
                    llm_success=llm_success,
                    gap="Investigation stopped because timeout budget was reached.",
                )
            if trace and elapsed > request.budget.timeout_seconds * 0.85:
                break
            try:
                reply = self._model.complete_json(
                    system=SYSTEM_PROMPT,
                    messages=messages,
                    max_tokens=min(4096, max(1000, request.budget.max_tokens // 4)),
                )
            except Exception as first_exc:
                try:
                    retry_messages = messages + [
                        {
                            "role": "user",
                            "content": "Your previous response was invalid or failed. Return only valid JSON matching the requested schema.",
                        }
                    ]
                    reply = self._model.complete_json(
                        system=SYSTEM_PROMPT,
                        messages=retry_messages,
                        max_tokens=min(4096, max(1000, request.budget.max_tokens // 4)),
                    )
                except Exception as second_exc:
                    if request.validation_mode:
                        return self._failed_result(request, f"LLM failed: {second_exc}", started)
                    return self._partial_result(
                        request=request,
                        final=final,
                        state=state,
                        trace=trace,
                        region_ids=tuple(all_region_ids),
                        started=started,
                        tokens_in=tokens_in,
                        tokens_out=tokens_out,
                        model_name=model_name,
                        llm_success=llm_success,
                        gap=f"LLM response failed after retry: {first_exc}",
                        fallback_reason=f"LLM response failed after retry: {first_exc}",
                    )
            tokens_in += reply.tokens_in
            tokens_out += reply.tokens_out
            llm_success = True
            model_name = reply.model or model_name
            data = reply.data
            if isinstance(data.get("final"), dict):
                final = data["final"]
                break
            state = _state_from_step(data)
            action = data.get("next_action")
            if not isinstance(action, dict):
                return self._partial_result(
                    request=request,
                    final=final,
                    state=state,
                    trace=trace,
                    region_ids=tuple(all_region_ids),
                    started=started,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    model_name=model_name,
                    llm_success=llm_success,
                    gap="Model did not provide a next_action or final result.",
                )
            tool = str(action.get("tool") or "")
            args = action.get("args") if isinstance(action.get("args"), dict) else {}
            reason = str(action.get("reason") or "")
            tool_result = self._tools.execute(tool, args)
            all_region_ids.extend(
                region_id
                for region_id in tool_result.returned_region_ids
                if region_id not in all_region_ids
            )
            trace.append(
                ToolTraceEntry(
                    index=len(trace) + 1,
                    tool=tool,
                    args=dict(args),
                    reason=reason,
                    status=tool_result.status,
                    result_count=tool_result.result_count,
                    returned_region_ids=tool_result.returned_region_ids,
                    observation=tool_result.observation,
                )
            )
            if len(all_region_ids) >= request.budget.max_source_regions:
                final, tokens_in, tokens_out, llm_success, model_name = self._try_final_synthesis(
                    request=request,
                    final=final,
                    state=state,
                    trace=tuple(trace),
                    region_ids=tuple(all_region_ids),
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    model_name=model_name,
                    llm_success=llm_success,
                    gap="Investigation stopped because source-region budget was reached.",
                )
                return self._partial_result(
                    request=request,
                    final=final,
                    state=state,
                    trace=trace,
                    region_ids=tuple(all_region_ids),
                    started=started,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    model_name=model_name,
                    llm_success=llm_success,
                    gap="Investigation stopped because source-region budget was reached.",
                )
            last_empty_or_error = tool_result.status != "ok" or tool_result.result_count == 0
            messages = [
                {
                    "role": "user",
                    "content": observation_prompt(
                        state=state,
                        tool_observation={
                            "tool": tool,
                            "args": args,
                            "status": tool_result.status,
                            "observation": tool_result.observation,
                            "payload": _compact_payload(tool_result.payload),
                        },
                        remaining_budget={
                            "tool_calls": request.budget.max_tool_calls - len(trace),
                            "source_regions": request.budget.max_source_regions - len(all_region_ids),
                            "timeout_seconds": max(0, request.budget.timeout_seconds - int(time.monotonic() - started)),
                        },
                        rethinking_required=_rethinking_required(
                            state=state,
                            trace=trace,
                            last_empty_or_error=last_empty_or_error,
                            budget_used=len(trace) / max(1, request.budget.max_tool_calls),
                        ),
                    ),
                }
            ]

        status = "completed" if final else "partial"
        if not final:
            final, tokens_in, tokens_out, llm_success, model_name = self._try_final_synthesis(
                request=request,
                final=final,
                state=state,
                trace=tuple(trace),
                region_ids=tuple(all_region_ids),
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                model_name=model_name,
                llm_success=llm_success,
                gap="Investigation reached the tool-call budget before final synthesis.",
            )
        if not final:
            final = {
                "summary": "Investigation reached the tool-call budget before final synthesis.",
                "simple_explanation": "The system inspected source but did not finish a full answer within the budget.",
                "technical_explanation": "Increase max_tool_calls or narrow the question to continue.",
                "gaps": ["Investigation reached the tool-call budget before final synthesis."],
            }
        return self._result_from_final(
            request=request,
            final=final,
            status=status,
            trace=tuple(trace),
            region_ids=tuple(all_region_ids),
            started=started,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            model_name=model_name,
            llm_success=llm_success,
            fallback_reason=None,
        )

    def _try_final_synthesis(
        self,
        *,
        request: InvestigationRequest,
        final: dict[str, Any] | None,
        state: dict[str, Any],
        trace: tuple[ToolTraceEntry, ...],
        region_ids: tuple[str, ...],
        tokens_in: int,
        tokens_out: int,
        model_name: str,
        llm_success: bool,
        gap: str,
    ) -> tuple[dict[str, Any] | None, int, int, bool, str]:
        if final:
            return final, tokens_in, tokens_out, llm_success, model_name
        try:
            reply = self._model.complete_json(
                system=SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": final_synthesis_prompt(
                            mode=request.mode,
                            question=request.question,
                            state=state,
                            tool_trace=[
                                {
                                    "tool": entry.tool,
                                    "args": entry.args,
                                    "status": entry.status,
                                    "observation": entry.observation,
                                    "returned_region_ids": entry.returned_region_ids,
                                }
                                for entry in trace
                            ],
                            returned_region_ids=list(region_ids),
                        ),
                    }
                ],
                max_tokens=4096,
            )
            tokens_in += reply.tokens_in
            tokens_out += reply.tokens_out
            llm_success = True
            model_name = reply.model or model_name
            if isinstance(reply.data.get("final"), dict):
                final = reply.data["final"]
                final.setdefault("gaps", []).append(gap)
        except Exception:
            final = None
        return final, tokens_in, tokens_out, llm_success, model_name

    def _brief(self, request: InvestigationRequest) -> dict[str, Any]:
        snapshot = self._job.snapshot
        assert snapshot is not None
        anchors = self._store.get_anchors(self._job.run_id)
        orientation = self._store.get_orientation_items(self._job.run_id)
        symbols = self._store.get_symbols(self._job.run_id)
        return {
            "question": request.question,
            "mode": request.mode,
            "repo": {
                "name": snapshot.repo_name,
                "path": snapshot.repo_path,
                "file_count": snapshot.file_count,
                "languages": [item.__dict__ for item in snapshot.languages[:12]],
                "package_boundaries": [item.__dict__ for item in snapshot.package_boundaries[:20]],
                "parser_coverage": snapshot.parser_coverage.__dict__,
            },
            "orientation_guidance_only": [
                {
                    "id": item.id,
                    "path": item.path,
                    "kind": item.kind,
                    "title": item.title,
                    "signals": item.signals,
                    "summary": item.summary,
                    "proof_allowed": item.proof_allowed,
                }
                for item in orientation[:20]
            ],
            "semantic_anchors": [
                {
                    "id": anchor.id,
                    "kind": anchor.kind,
                    "label": anchor.label,
                    "path": anchor.path,
                    "line_range": [anchor.start_line, anchor.end_line],
                    "confidence": anchor.confidence,
                    "signals": anchor.signals,
                }
                for anchor in anchors[:80]
            ],
            "focus": {
                "anchor_ids": request.focus.anchor_ids,
                "file_paths": request.focus.file_paths,
                "symbol_ids": request.focus.symbol_ids,
            },
            "symbol_sample": [
                {
                    "id": symbol.id,
                    "name": symbol.name,
                    "kind": symbol.kind,
                    "path": symbol.path,
                    "line_range": [symbol.start_line, symbol.end_line],
                }
                for symbol in symbols[:80]
            ],
        }

    def _result_from_final(
        self,
        *,
        request: InvestigationRequest,
        final: dict[str, Any],
        status: str,
        trace: tuple[ToolTraceEntry, ...],
        region_ids: tuple[str, ...],
        started: float,
        tokens_in: int,
        tokens_out: int,
        model_name: str,
        llm_success: bool,
        fallback_reason: str | None,
    ) -> InvestigationResult:
        raw_claims = [
            raw
            for raw in _dicts(final.get("claims"))
            if str(
                raw.get("text")
                or raw.get("claim")
                or raw.get("statement")
                or raw.get("claim_text")
                or raw.get("summary")
                or raw.get("description")
                or ""
            ).strip()
        ]
        claims = tuple(_claim_from_dict(raw, index) for index, raw in enumerate(raw_claims))
        grounded = CitationValidator(job=self._job, store=self._store).validate_claims(claims).claims
        important_regions = _important_regions(final, region_ids)
        gaps = tuple(str(item) for item in _list(final.get("gaps")))
        return InvestigationResult(
            run_id=self._job.run_id,
            status=status,  # type: ignore[arg-type]
            question=request.question,
            mode=request.mode,
            answer=InvestigationAnswer(
                summary=str(final.get("summary") or ""),
                simple_explanation=str(final.get("simple_explanation") or ""),
                technical_explanation=str(final.get("technical_explanation") or ""),
            ),
            resolved_hypotheses=tuple(_dicts(final.get("resolved_hypotheses"))),
            rejected_hypotheses=tuple(_dicts(final.get("rejected_hypotheses"))),
            remaining_uncertainties=tuple(_dicts(final.get("remaining_uncertainties"))),
            component_hypotheses=tuple(_component_hypotheses(final.get("component_hypotheses"))),
            relationships=tuple(_dicts(final.get("relationships"))),
            claims=grounded,
            important_regions=tuple(important_regions),
            suggested_next_questions=tuple(str(item) for item in _list(final.get("suggested_next_questions"))),
            tool_trace=trace,
            gaps=gaps,
            metrics=InvestigationMetrics(
                llm_used=llm_success and fallback_reason is None,
                model=model_name,
                tool_calls=len(trace),
                regions_returned=len(region_ids),
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                latency_ms=int((time.monotonic() - started) * 1000),
                fallback_reason=fallback_reason,
            ),
            metadata={
                "repo_identity": final.get("repo_identity") if isinstance(final.get("repo_identity"), dict) else {},
                "repo_shape": final.get("repo_shape") if isinstance(final.get("repo_shape"), dict) else {},
                "orientation_notes": _dicts(final.get("orientation_notes")),
            },
        )

    def _partial_result(
        self,
        *,
        request: InvestigationRequest,
        final: dict[str, Any] | None,
        state: dict[str, Any],
        trace: list[ToolTraceEntry],
        region_ids: tuple[str, ...],
        started: float,
        tokens_in: int,
        tokens_out: int,
        model_name: str,
        llm_success: bool,
        gap: str,
        fallback_reason: str | None = None,
    ) -> InvestigationResult:
        fallback_final = final or {
            "summary": "Investigation is partial.",
            "simple_explanation": "The agent gathered some evidence but did not finish a complete answer.",
            "technical_explanation": "Partial structured state is returned with inspected regions and gaps.",
            "resolved_hypotheses": state.get("hypotheses", []),
            "remaining_uncertainties": state.get("competing_theories", []) + state.get("mismatches", []),
            "gaps": [gap],
            "important_regions": [{"source_region_id": region_id} for region_id in region_ids],
        }
        return self._result_from_final(
            request=request,
            final=fallback_final,
            status="partial",
            trace=tuple(trace),
            region_ids=region_ids,
            started=started,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            model_name=model_name,
            llm_success=llm_success,
            fallback_reason=fallback_reason,
        )

    def _degraded_result(self, request: InvestigationRequest, reason: str, started: float) -> InvestigationResult:
        return self._minimal_result(request, "degraded_no_llm", reason, started, reason)

    def _failed_result(self, request: InvestigationRequest, reason: str, started: float) -> InvestigationResult:
        return self._minimal_result(request, "failed", reason, started, reason)

    def _minimal_result(
        self,
        request: InvestigationRequest,
        status: str,
        summary: str,
        started: float,
        fallback_reason: str | None,
    ) -> InvestigationResult:
        return InvestigationResult(
            run_id=self._job.run_id,
            status=status,  # type: ignore[arg-type]
            question=request.question,
            mode=request.mode,
            answer=InvestigationAnswer(summary=summary, simple_explanation=summary, technical_explanation=summary),
            resolved_hypotheses=(),
            rejected_hypotheses=(),
            remaining_uncertainties=(),
            component_hypotheses=(),
            relationships=(),
            claims=(),
            important_regions=(),
            suggested_next_questions=(),
            tool_trace=(),
            gaps=(summary,),
            metrics=InvestigationMetrics(
                llm_used=False,
                model=self._model.model_name,
                tool_calls=0,
                regions_returned=0,
                tokens_in=0,
                tokens_out=0,
                latency_ms=int((time.monotonic() - started) * 1000),
                fallback_reason=fallback_reason,
            ),
            metadata={},
        )


def _state_from_step(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "hypotheses": _list(data.get("hypotheses")),
        "competing_theories": _list(data.get("competing_theories")),
        "mismatches": _list(data.get("mismatches")),
    }


def _rethinking_required(
    *,
    state: dict[str, Any],
    trace: list[ToolTraceEntry],
    last_empty_or_error: bool,
    budget_used: float,
) -> bool:
    if last_empty_or_error or budget_used >= 0.7:
        return True
    if state.get("mismatches"):
        return True
    if len(trace) >= 2 and trace[-1].returned_region_ids and trace[-2].returned_region_ids:
        return True
    return False


def _claim_from_dict(raw: dict[str, Any], index: int) -> Claim:
    from syntax_tree_refurbished.core.models.grounding import Citation

    citations = []
    for item in _dicts(raw.get("citations")):
        citations.append(
            Citation(
                kind=str(item.get("kind") or "source_region"),  # type: ignore[arg-type]
                ref_id=item.get("ref_id"),
                path=item.get("path"),
                start_line=_optional_int(item.get("start_line")),
                end_line=_optional_int(item.get("end_line")),
                content_hash=item.get("content_hash"),
            )
        )
    for region_id in _region_ids_from(raw):
        citations.append(Citation(kind="source_region", ref_id=region_id))
    if not citations and raw.get("path") and raw.get("start_line") and raw.get("end_line"):
        citations.append(
            Citation(
                kind="file_range",
                path=str(raw.get("path")),
                start_line=_optional_int(raw.get("start_line")),
                end_line=_optional_int(raw.get("end_line")),
                content_hash=raw.get("content_hash"),
            )
        )
    return Claim(
        id=str(raw.get("id") or f"claim-{index + 1}"),
        text=str(
            raw.get("text")
            or raw.get("claim")
            or raw.get("statement")
            or raw.get("claim_text")
            or raw.get("summary")
            or raw.get("description")
            or ""
        ),
        requested_status=str(raw.get("requested_status") or "verified"),  # type: ignore[arg-type]
        citations=tuple(citations),
    )


def _important_regions(final: dict[str, Any], fallback_ids: tuple[str, ...]) -> list[dict[str, Any]]:
    explicit = _dicts(final.get("important_regions"))
    seen: set[str] = set()
    regions: list[dict[str, Any]] = []
    for item in explicit:
        region_id = item.get("source_region_id") or item.get("id")
        if region_id and region_id not in seen:
            seen.add(str(region_id))
            regions.append(item)
    for region_id in fallback_ids:
        if region_id not in seen:
            regions.append({"source_region_id": region_id})
    return regions


def _compact_payload(payload: dict[str, Any]) -> dict[str, Any]:
    rows = payload.get("results")
    if isinstance(rows, list):
        return {"results": rows[:12], "truncated": len(rows) > 12}
    return payload


def _dicts(value: Any) -> list[dict[str, Any]]:
    return [item for item in _list(value) if isinstance(item, dict)]


def _component_hypotheses(value: Any) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for item in _list(value):
        if isinstance(item, str):
            items.append({"label": item})
            continue
        if not isinstance(item, dict):
            continue
        normalized = dict(item)
        label = (
            normalized.get("label")
            or normalized.get("name")
            or normalized.get("component")
            or normalized.get("title")
            or normalized.get("area")
        )
        if label:
            normalized["label"] = str(label)
        items.append(normalized)
    return items


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _region_ids_from(raw: dict[str, Any]) -> list[str]:
    candidates: list[Any] = []
    for key in ("source_region_ids", "source_regions", "region_ids", "evidence_region_ids"):
        value = raw.get(key)
        if isinstance(value, list):
            candidates.extend(value)
    evidence = raw.get("evidence")
    if isinstance(evidence, list):
        for item in evidence:
            if isinstance(item, str):
                candidates.append(item)
            elif isinstance(item, dict):
                candidates.append(item.get("source_region_id") or item.get("region_id") or item.get("ref_id"))
    ids: list[str] = []
    for value in candidates:
        text = str(value or "")
        if text.startswith("region:") and text not in ids:
            ids.append(text)
    return ids
