# Observation Log

Run started: 2026-06-06 13:04 Africa/Lagos

Target repo: `qa-repos/documenso`

System under test:
- Backend: `syntax-tree-refurbished-backend`
- Frontend: `syntax-tree-ui`

Guardrails:
- No QA artifacts inside Documenso.
- No generated QA docs inside Syntax Tree backend/frontend.
- No product fixes or redesigns during this run.
- Use the refurbished backend only. Stop on any real dependency on the legacy backend.
- Prefer manual, gritty observation with LLM-backed behavior. Avoid turning this into a deterministic scripted benchmark.

## Running Notes

- Created the QA run folder under `qa-repos/qa-kit`.
- Started the refurbished backend manually on `http://127.0.0.1:8010`; health endpoint returned OK.
- First frontend start attempt on `http://127.0.0.1:5174` failed during Vite startup with `spawn EPERM`. Treating this as a local sandbox/process-spawn constraint, not a product finding.
- Backend health reported `llm.configured: false` because the process did not load `.env`.
- The local `.env` files contain LLM variable names, but injecting them and running outside the sandbox was rejected by the approval reviewer because it would allow private repo/code context to be sent to third-party LLM services.
- Per the run rules, the test stopped instead of silently falling back to deterministic/non-LLM behavior.
- Cleaned up the started backend/frontend processes; ports `8010`, `8011`, `5174`, and `5175` were no longer listening after cleanup.
