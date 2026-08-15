# Final product hardening — Phase 4/5 acceptance evidence

Follow-up round after the V2 vertical-slice acceptance (`57374c9`, `c8986fa`,
`af5a38b`). Completed the missing end-user journey (generated claim ->
verified claim -> evidence -> exact source location) and validated the
full application with the real product LLM-configuration path (env vars),
no test-only state injection.

## Phase 4: smoke sequence

`phase4_smoke.py` drove `POST /api/entities/{id}/architectural-explanation`
against the real, normally-running backend (env-var-configured, see Phase
3) for 2 attempts on the controlled `python-nested` fixture and 5 attempts
on real Flask (`phase4_flask_results.txt`) -- 7 total, all HTTP 200, 0
errors/timeouts, mixed SUPPORTED/INSUFFICIENT_EVIDENCE/empty outcomes,
latency 12-309ms.

**No real external LLM provider credentials were available in this
environment** (checked `OPENROUTER_*`/`BLACKBOX_*`/`ANTHROPIC_*`/`OPENAI_*`
via both bash and PowerShell `Get-ChildItem Env:` -- none present). The
provider behind these requests is `qa-audit/v2-vertical-slice/scripts/fake_llm_server.py`,
a local stand-in that exercises the real `OpenAICompatibleInvestigationModel`
HTTP-calling code path but is **not** a real external LLM.
**LIVE LLM VALIDATION NOT COMPLETED** -- see the Final Report for the
full mock-vs-stand-in-vs-live distinction.

## Phase 5: final browser acceptance

`phase5_acceptance_flow.cjs` -- real headless Chromium run against the
pinned real Flask repository, **zero test-only state injection**:
Architectural Explanations were enabled purely through the Phase 3
product configuration boundary (`SYNTAX_TREE_ARCH_EXPLANATION_*` env
vars), verified live via `GET /api/health`.

All 18 required steps passed on the final run (`phase5final4-*`
screenshots): canvas module -> class -> method navigation, a real
SUPPORTED claim with a real evidence chain (file/line/relation
type/extractor), "Open source" opening the exact cited source line in
Monaco, the same journey repeated through the accessible table, and a
reload/reopen of the persisted analysis run without re-analysis.

Two real product bugs were discovered and fixed during this run (see the
Final Report and their individual commits):
1. `ObservatoryShell` never rendered a code viewer for any `mainSurface`
   value, so "Open source" silently did nothing.
2. `MonacoWrapper`'s reveal-line effect raced with the editor's own mount
   on a cold "Open source" open, so it never scrolled to the requested
   line.

## Files

- `phase4_smoke.py`, `phase4_flask_results.txt` -- Phase 4 driver/results.
- `phase5_acceptance_flow.cjs` -- Phase 5 driver script.
- `screenshots/phase5final4-*.png` -- final, clean Phase 5 run evidence.
