# Syntax Tree QA Kit

This folder contains planning artifacts for testing Syntax Tree against the shallow-cloned Documenso repository.

Target repository:

```text
C:\Users\LENOVO T14\Development\lauras\qa-repos\documenso
```

This is not the QA run itself. It is the QA preparation layer: expected architecture, drilldown expectations, question prompts, answer keys, and a place to collect testing TODOs and system problems.

## Guardrails

- Do not add generated documentation to the Syntax Tree backend or frontend repositories.
- Do not add QA artifacts inside the Documenso clone unless explicitly approved.
- Do not treat Documenso README or architecture notes as runtime proof. They can guide investigation, but code-backed answers must cite implementation files, routes, schemas, providers, jobs, or source spans.
- Do not create product fixes or redesign solutions in this kit unless explicitly asked.
- Record problems and test concerns clearly, even when no solution is proposed.
- Keep this folder as a plain artifact folder, not a nested Git repository.

## What This Kit Is For

Syntax Tree should be tested on whether it can:

- Build a useful source-backed architecture map from a medium-depth monorepo.
- Drill from high-level system concepts into actual implementation files without becoming only a folder tree.
- Explain UI, API, jobs, storage, database, email, signing, and provider relationships.
- Answer "what does", "how does", "what if", and source-proof questions with grounded citations.
- Admit uncertainty where source evidence is weak or missing.
- Separate orientation-only material from verified source behavior.

## Current Artifacts

- `documenso-expected-architecture.md`: expected architecture and drilldown model.
- `documenso-question-bank.md`: questions to ask Syntax Tree and expected answer keys.
- `todos-and-problems.md`: QA TODOs and known problems, including Syntax Tree system issues.
