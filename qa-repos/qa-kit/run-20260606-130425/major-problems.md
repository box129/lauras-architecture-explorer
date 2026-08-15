# Major Problems

This file records major blockers, expensive failures, misleading behavior, or risks that should stop or constrain the run.

## Stop Conditions Watched

- Runaway LLM/API usage or obvious budget drain.
- Silent fallback to deterministic behavior after LLM failure.
- Dependency on the legacy Syntax Tree backend.
- High-confidence false architecture claims.
- Unusable frontend core workflow.
- Security/destructive action requirement.
- Repeated low-value failures.

## Problems

### P0: LLM-backed QA Cannot Run Under Current Approval Boundary

The intended QA run requires the refurbished backend to make live LLM calls while analyzing the Documenso repository. The backend health endpoint reported no live LLM configured in the running process.

The `.env` files contain LLM variable names, but starting the stack with those credentials injected outside the sandbox was rejected because it would allow private repo/code context to be sent to third-party LLM services.

Impact:
- Architecture map quality cannot be judged in the intended mode.
- Drilldown quality cannot be judged in the intended mode.
- Question-bank answers cannot be judged in the intended mode.
- Documentation generation cannot be judged in the intended mode.
- Running fallback-only behavior would violate this run's premise and could produce misleading confidence.

Status: stop-level blocker. Do not solve yet.

### Environment: Frontend Dev Server Hit `spawn EPERM`

The first frontend startup attempt failed during Vite startup with `spawn EPERM`.

Impact:
- No browser/HCI/video checks were performed before the stop.

Status: environment issue, not currently classified as a product defect.
