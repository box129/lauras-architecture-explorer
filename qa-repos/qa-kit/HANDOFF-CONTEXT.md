# Syntax Tree QA Handoff Context

This folder carries the planning and first-run context for testing Syntax Tree against Documenso after the workspace is moved.

## Repos And Paths

- Syntax Tree refurbished backend: `syntax-tree-refurbished-backend`
- Syntax Tree frontend: `syntax-tree-ui`
- QA artifacts: `qa-repos/qa-kit`
- Target repo to recreate later: `qa-repos/documenso`

Documenso should be recloned in the destination environment. Do not vendor the Documenso clone into this repo unless explicitly deciding to freeze a local fixture.

Recommended target recreation:

```powershell
New-Item -ItemType Directory -Force qa-repos | Out-Null
git clone --depth 1 https://github.com/documenso/documenso.git qa-repos/documenso
```

Previous shallow clone reference from the original workspace:

- Commit: `4ee789e`
- Commit subject: `fix: add multi email transport system (#2942)`
- Observed local size: about 141 MB

## Test Intent

Run a full manual QA and UI/UX test of Syntax Tree against Documenso using the refurbished backend only.

The test should check whether Syntax Tree can:

- Build a useful architecture map from a medium-depth monorepo.
- Drill from high-level components to implementation files without collapsing into a folder tree.
- Explain how UI, API, business logic, jobs, database, email, storage, auth, and signing connect.
- Distinguish docs/README orientation from source-backed proof.
- Answer "what does", "how does", "what if", and source-proof questions with citations.
- Admit uncertainty when evidence is missing.
- Avoid pretending fixture/docs-only information is runtime proof.

This is intended to be a manual, gritty run, not a hardcoded deterministic benchmark. Use LLM-backed behavior where available and record observations as the run proceeds.

## Guardrails

- Do not add generated QA documentation inside `syntax-tree-refurbished-backend`.
- Do not add generated QA documentation inside `syntax-tree-ui`.
- Do not mutate Documenso unless explicitly approved.
- Keep QA artifacts under `qa-repos/qa-kit`.
- Do not create product fixes or redesign solutions during the QA run unless explicitly asked.
- If the LLM path fails, do not quietly downgrade to deterministic results and call the test successful.
- Stop and report major problems such as runaway API usage, legacy backend dependency, or high-confidence false architecture.

## Existing QA Kit Files

- `README.md`: purpose, target repo, and guardrails.
- `documenso-expected-architecture.md`: the expected architecture Syntax Tree should discover.
- `documenso-question-bank.md`: question bank and expected answer keys.
- `todos-and-problems.md`: QA tasks and known problems to track without solving.
- `run-20260606-130425/`: first attempted run and stop report.

## First Attempt Result

The first integrated run stopped before substantive QA.

What worked:

- The refurbished backend started.
- `GET /api/health` returned OK.
- No Documenso files were changed.
- No Syntax Tree backend/frontend source files were changed.

What stopped the run:

- The backend process reported `llm.configured: false` because `.env` was not loaded into that process.
- Starting the stack with live external LLM credentials was blocked by the execution environment because the reviewer could not verify that only Documenso source snippets would be sent out.
- The frontend dev server also hit a Vite `spawn EPERM` startup issue under the managed shell.

This was treated as a stop-level blocker, not a failed product verdict.

## What Needs Fixing Before A Serious Retry

The useful product work is:

- Load development `.env` explicitly or document the required run command.
- Enforce a hard target repo boundary for every source read/search/citation tool.
- Add outbound LLM payload audit metadata: target root, referenced paths, token estimates, and escape detection, without logging secrets or full prompts by default.
- Add explicit external-LLM consent scoped to the target repo root.
- Make the UI show the active analyzed repo root clearly.
- Recheck the frontend `spawn EPERM` issue in the destination environment.

Do not treat these as automatically approved fixes. They are handoff context and should become implementation work only when requested.

## Secrets And Env

Live secret values are intentionally not committed here. Recreate them in the destination environment through `.env` or the host secret manager.

Important variable names observed in the workspace:

- `OPENROUTER_API_KEY`
- `OPENROUTER_API_KEY_2`
- `OPENROUTER_MODEL`
- `BLACKBOX_API_KEY`
- `BLACKBOX_MODEL`
- `SYNTAX_TREE_LLM_PROVIDER`
- `SYNTAX_TREE_LLM_SSL_VERIFY`
- `SYNTAX_TREE_LLM_TIMEOUT_SECONDS`

The destination run should confirm `/api/health` reports `llm.configured: true` before starting the real QA.

## Preferred Run Shape

Create a new dated run folder under `qa-repos/qa-kit`, for example:

```text
qa-repos/qa-kit/run-YYYYMMDD-HHMMSS/
  observation-log.md
  backend-comprehension.md
  frontend-hci-ux.md
  latency-and-backend-activity.md
  major-problems.md
  final-report.md
  media/
```

Record every observation as the run progresses. The goal is to reduce cognitive load and avoid reconstructing the test from memory.

