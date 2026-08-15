# QA TODOs And Problems

This file tracks QA preparation tasks and known concerns. Do not turn these into solutions unless explicitly asked.

## QA TODOs

- Run Syntax Tree analysis against `C:\Users\LENOVO T14\Development\lauras\qa-repos\documenso`.
- Capture the initial architecture map and compare it against `documenso-expected-architecture.md`.
- Verify that Documenso README and `ARCHITECTURE.md` are treated as orientation, not runtime proof.
- Ask the questions in `documenso-question-bank.md` and record answer quality, missing citations, wrong claims, and uncertainty handling.
- Check whether architecture drilldown reaches source files for Hono route mounts, document flows, jobs, providers, UI routes, and shared UI components.
- Check whether source proof opens exact files and line ranges in the Code Companion.
- Test whether question answers cite source regions instead of only giving prose.
- Test whether Syntax Tree admits unsupported or insufficient evidence instead of inventing missing behavior.
- Review whether docs generation is easy to test after source-grounded architecture and question lenses are stable.

## Syntax Tree Problems To Track

- Context memory redesign is inefficient and should be treated as a problem area for later design work.
- The current context strategy may spend too much budget on broad repo material instead of focused source regions.
- Architecture maps may collapse into folder structure instead of meaningful product concepts.
- Question answers may become too confident when starting from README or architecture notes.
- Drilldown may produce file groups instead of behavior-level subcomponents.
- Flow tracing may not be mature enough to connect frontend UI actions to backend jobs and provider effects.
- Documentation generation may pass too easily if judged only on fluent prose rather than source-backed claims.
- Large assets, translations, screenshots, and generated/static material may distort repo understanding unless filtered or de-prioritized.

## Documenso-Specific QA Risks

- Documenso contains a lot of translations and assets, which may distract from core architecture.
- The docs app and Openpage API are supporting apps, not the main signing product.
- The architecture notes are helpful but can bias the model toward claims that still need source proof.
- Provider behavior depends on environment variables, so only provider selection can be proven without runtime configuration.
- Enterprise package behavior should not be generalized unless inspected.
- UI behavior may require browser testing; static code inspection alone cannot prove all UX states.

## Do Not Solve Yet

- Do not redesign Syntax Tree context handling in this QA kit.
- Do not change Syntax Tree backend/frontend code as part of this preparation.
- Do not edit Documenso.
- Do not add automated tests yet.
- Do not create fixes for Documenso.
- Do not mark every problem with a solution.

## Problems Needing Investigation

- How should Syntax Tree rank source evidence when a repo includes huge translation files and binary/static assets?
- How should the architecture map represent multiple API styles without overwhelming the first view?
- How should question lenses show "orientation-only" material so users understand its lower proof value?
- How should Syntax Tree handle provider-dependent behavior when environment variables decide active implementations?
- How should the QA run measure whether a drilldown is semantically useful rather than merely deep?
