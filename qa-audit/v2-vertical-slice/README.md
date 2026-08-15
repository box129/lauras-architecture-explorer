# V2 vertical-slice Phase 6 acceptance evidence

Real-browser (headless Chromium) acceptance runs for the L1-L4 V2 vertical
slice (structured LLM claim proposer -> deterministic verification ->
explanation composition -> provenance-aware frontend), run against:

- a controlled fixture repository (`qa-audit/phase-2/fixtures/python-nested`)
  -- screenshots/JSON prefixed `controlled5-*`
- a real, unmodified open-source repository (Flask, `flask/app.py`) --
  screenshots/JSON prefixed `flask3-*`

## What these prove, and what they don't

- **Navigation is real.** `scripts/v2_acceptance_flow.cjs` drives the actual
  React Flow canvas (`useArchitectureLens.ts`'s real drilldown branch, not
  the accessible-table's always-select-only row buttons), reaching real
  `symbol:` entity ids returned by the backend.
- **Verification is real.** The `POST /api/entities/{id}/architectural-explanation`
  calls hit the real `verify_target_entity` -> `claim_from_proposition` ->
  `verify_proposition` path against persisted `ObservedProgramRelation`s
  from a real analysis run of each repository. `flask3-explanation-response.json`
  shows two claims independently verified SUPPORTED, with evidence chains
  citing `python_call_extractor@0.3.0` and a real resolved call at
  `flask/app.py:307`.
- **The LLM call is NOT live.** `scripts/fake_llm_server.py` is a local
  stdlib HTTP server standing in for a real LLM provider -- it exercises
  the real `OpenAICompatibleInvestigationModel` HTTP-calling code path
  (`scripts/run_backend_with_fake_claims.py` wires it in via the same
  `request.app.state.claim_proposer` test-injection hook the automated
  test suite uses) but is not a real external LLM and must never be cited
  as live LLM validation. No real external LLM provider was exercised
  during this acceptance run; see the Phase 6 final report for the mocked
  vs. local-server vs. live distinction.
- **Architecture-map generation is deterministic.** `run_backend_with_fake_claims.py`
  also pins `request.app.state.investigation_model = NoConfiguredModel()`,
  so navigation always uses `SystemOverviewGenerator`'s no-LLM
  `build_static_structure` fallback -- independent of whether the claim
  proposer is live.

## Files

- `scripts/v2_acceptance_flow.cjs` -- the Playwright driver script (plain
  Node + `@playwright/test`'s `chromium`, not a `*.spec.cjs` test file).
  Env vars: `FRONTEND_URL`, `TARGET_REPO`, `SHOT_DIR`, `SHOT_PREFIX`,
  optional `PREFERRED_MODULE_LABEL`/`PREFERRED_SYMBOL_LABEL` hints.
- `scripts/fake_llm_server.py` -- local fake OpenAI-compatible server.
  Parses real observed `calls` relations out of the bounded-evidence
  prompt it's shown and proposes one genuinely-observed relation (so the
  deterministic verifier can return SUPPORTED) plus one unconfirmed
  candidate (so it can return INSUFFICIENT_EVIDENCE).
- `scripts/run_backend_with_fake_claims.py` -- bootstraps the real backend
  app in-process with the two `app.state` overrides described above.
- `screenshots/`, `*-explanation-response.json` -- captured evidence from
  the two acceptance runs described above.
