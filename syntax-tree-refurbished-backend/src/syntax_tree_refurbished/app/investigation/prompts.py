"""Prompts for the self-directing investigation model."""

from __future__ import annotations


SYSTEM_PROMPT = """You are investigating an unfamiliar codebase through backend tools.

You are not filling a template. Think like a careful software engineer.

Rules:
- Use docs, README, manifests, and orientation only as guidance for where to look.
- Do not claim code behavior unless source evidence was returned by a tool.
- Actively look for evidence that could disprove your current theory.
- If two theories are plausible, keep both until evidence resolves them.
- Prefer semantic anchors and public surfaces as starting points.
- Prefer exact source regions over broad guesses.
- If a search returns nothing, rethink instead of forcing the theory.
- Do not invent paths, line numbers, functions, components, or architecture areas.
- Do not force frontend/backend/RAG/chat/app layers onto library repos.
- Return structured JSON only.

You must choose exactly one of:
1. a next tool call;
2. a final synthesis.

Do not reveal private chain-of-thought. Report only structured hypotheses, doubts,
mismatches, decisions, and evidence status."""


def initial_user_prompt(brief: dict) -> str:
    overview_guidance = ""
    if brief.get("mode") == "architecture_discovery":
        overview_guidance = """
Architecture discovery mode:
- Your final output will become the reusable System Overview / Architecture Brief.
- Identify architecture components as human concepts, not file paths.
- Good component labels: "Public Request API", "Client Lifecycle", "Transport Layer", "Auth And Cookies".
- Bad component labels: "src/foo.py", "httpx/_client.py", "backend/routes.py".
- Keep files in important_regions, claims, or related_file_paths, not as component names.
- Include repo_identity and repo_shape in the final JSON when evidence supports them.
- Do not finish after inspecting only one narrow subsystem unless the repo itself is tiny.
- Before final synthesis, try to establish the package/public surface plus several main areas
  such as API surface, clients/services, boundaries/transports, models/data, auth/config,
  workers/CLI/deployment where evidence exists.
"""
    elif brief.get("mode") == "component_drilldown":
        overview_guidance = """
Component drilldown mode:
- You are zooming into one architecture component, not rediscovering the whole repo.
- Break the parent component into the most useful subareas for code comprehension.
- Prefer behavioral and responsibility-based children over file names.
- Good child labels: "Sync Client", "Async Client", "Request Sending", "Redirect Handling", "Streaming Response Handling", "Client Configuration".
- Bad child labels: "_client.py", "_auth.py", "src/foo.ts" unless evidence only supports a file-level code group.
- If only file-level grouping is justified, set kind to "code_group" and support_status to "uncertain" or "inferred".
- Verified child components must cite returned source_region_id values.
- Do not invent common frontend/backend/RAG/app layers unless the inspected source supports them.
- If a child component could be further subdivided, include a "children_hint" array with suggested sub-area labels (max 5). Leave empty if the child is a leaf.
"""
    return f"""Start an investigation from this brief.

Create or revise hypotheses, competing theories, and uncertainty points.
Choose the single next backend tool call that best reduces uncertainty.

{overview_guidance}

Available tools:
search_code, search_files, read_range, read_whole_file, expand_region,
get_file_outline, find_definition, find_references, list_anchors,
list_orientation, list_symbols.

Use these exact tool names when possible. If you need source proof, cite returned
source_region_id values in the final claims. Do not cite line numbers in prose
without a citation object.

Return JSON:
{{
  "hypotheses": [],
  "competing_theories": [],
  "mismatches": [],
  "next_action": {{
    "tool": "...",
    "args": {{}},
    "reason": "..."
  }}
}}

Brief:
{brief}
"""


def observation_prompt(
    *,
    state: dict,
    tool_observation: dict,
    remaining_budget: dict,
    rethinking_required: bool,
) -> str:
    rethink = ""
    if rethinking_required:
        rethink = """
Before continuing, reassess:
- Which hypotheses are supported?
- Which are contradicted?
- Which are only orientation-guided?
- What single tool call best reduces uncertainty?
"""
    return f"""Continue the investigation.

{rethink}

If this is architecture discovery mode, final component_hypotheses must be
architecture concepts with human labels, not source file paths.

If this is component drilldown mode, final component_hypotheses must be useful
subareas of the selected parent component. Prefer behavior/responsibility labels.
Only use file labels when the evidence supports no better semantic grouping, and
mark those children as code_group/uncertain. Include "children_hint" on children
that could be further subdivided (max 5 labels).

Return either next_action or final.

If continuing:
{{
  "hypotheses": [],
  "competing_theories": [],
  "mismatches": [],
  "next_action": {{
    "tool": "...",
    "args": {{}},
    "reason": "..."
  }}
}}

If final:
{{
  "final": {{
    "summary": "...",
    "simple_explanation": "...",
    "technical_explanation": "...",
    "resolved_hypotheses": [],
    "rejected_hypotheses": [],
    "remaining_uncertainties": [],
    "component_hypotheses": [],
    "relationships": [],
    "claims": [
      {{
        "id": "claim-1",
        "text": "Concrete source-backed claim.",
        "requested_status": "verified",
        "citations": [
          {{"kind": "source_region", "ref_id": "region:..."}}
        ]
      }}
    ],
    "important_regions": [
      {{"source_region_id": "region:...", "reason": "Why this region matters"}}
    ],
    "suggested_next_questions": [],
    "gaps": []
  }}
}}

Previous structured state:
{state}

Latest backend tool observation:
{tool_observation}

Remaining budget:
{remaining_budget}
"""


def final_synthesis_prompt(
    *,
    mode: str,
    question: str,
    state: dict,
    tool_trace: list[dict],
    returned_region_ids: list[str],
) -> str:
    mode_guidance = ""
    if mode == "architecture_discovery":
        mode_guidance = """
Architecture discovery final requirements:
- component_hypotheses must be top-level architecture concepts with human labels.
- Do not use source file paths as component labels.
- Put files in important_regions, claims, or related_file_paths.
"""
    elif mode == "component_drilldown":
        mode_guidance = """
Component drilldown final requirements:
- component_hypotheses must be useful child subareas of the selected parent component.
- Prefer behavior/responsibility labels, for example "Sync Client", "Async Client",
  "Request Sending", "Redirect Handling", "Streaming Response Handling", or
  "Client Configuration" when the inspected source supports them.
- Do not return generic labels like "Child Area 1".
- Do not return file paths as children unless semantic subdivision is weak; in that
  case set kind="code_group" and support_status="uncertain".
- Any verified child must include source_region_ids from the allowed list.
- Include "children_hint" on children that could be further subdivided (max 5 labels).
"""
    return f"""Tool budget is exhausted. Do not request another tool.

Return the best partial final synthesis from the evidence already inspected.
Use gaps for anything not proven.
Verified claims must cite source_region IDs from this list:
{returned_region_ids}

Mode: {mode}
Original question/context:
{question}

{mode_guidance}

Return JSON:
{{
  "final": {{
    "summary": "...",
    "simple_explanation": "...",
    "technical_explanation": "...",
    "resolved_hypotheses": [],
    "rejected_hypotheses": [],
    "remaining_uncertainties": [],
    "component_hypotheses": [],
    "relationships": [],
    "claims": [
      {{
        "id": "claim-1",
        "text": "Concrete source-backed claim.",
        "requested_status": "verified",
        "citations": [
          {{"kind": "source_region", "ref_id": "region:..."}}
        ]
      }}
    ],
    "important_regions": [],
    "suggested_next_questions": [],
    "gaps": []
  }}
}}

Current structured state:
{state}

Tool trace:
{tool_trace}
"""
