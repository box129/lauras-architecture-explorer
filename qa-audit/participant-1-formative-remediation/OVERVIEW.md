# Participant 1 Formative Remediation — Overview

**Scope**: bounded product remediation driven by a real, non-scored formative usability dry run (Participant 1). This overview is de-identified and paraphrased — it contains no verbatim participant quotes. The verbatim session record is stored outside this git repository per `docs/usability-dry-run/SESSION_CHECKLIST.md` / `FACILITATOR_GUIDE.md` ("never commit participant recordings or notes into `qa-audit/` or any git-tracked path"); its location is known to the session operator.

Ten observations from the session were classified as **3 BLOCKER** and **6 MAJOR** findings (one "play guide" observation required identifying the exact UI element before any severity could be assigned). Full detail, evidence, and verdicts: `REPORT.md`, `result.json`.

## Findings addressed

| # | Area | Severity | Root cause (paraphrased) |
|---|---|---|---|
| B1 | Architecture map interaction discoverability | BLOCKER | Nodes were real, focusable buttons with hover/cursor affordance, but that affordance was never discovered by a user who only scrolled — nothing signaled interactivity at rest. |
| B2/B3 | SUPPORTED / INSUFFICIENT EVIDENCE mental model | BLOCKER | The shared legend (added in the prior remediation round) was not sufficient on its own; meaning needs to travel with every individual badge occurrence. |
| M1 | Repository folder selection | MAJOR | Manual path copy/paste was the only way to select a repository; no folder browser existed. |
| M2 | Map node-kind indistinguishability + visual overlap | MAJOR | A name-substring icon heuristic (tuned for a different class of repository) silently overrode the real, correct node-kind icon for common method names; two floating map overlays had no background and visually blended with node cards beneath them. |
| M3 | "Claim" terminology | MAJOR | The word "claim" appeared in the always-visible legend added in the prior remediation round, inviting an adversarial/voting interpretation. |
| M4 | Navigation consistency | MAJOR | The source-code viewer's exit control was a top-right "Close" button, a different position/style/wording from the top-left "Back" pattern used throughout the rest of the map/entity flow; a latent bug also pointed it at the wrong internal surface value. |
| M5 | Doc Studio comprehensibility | MAJOR | The screen opened directly into a technical component tree with no framing sentence, and its full raw source code rendered open by default. |
| M6 | "Take the Tour" ("play guide") | MAJOR | Traced to a real, reproducible bug: the tour silently rendered nothing whenever its (separate, legacy) data dependency came back empty, which it reliably does for any analysis produced by the current pipeline. |

## Deliberately not auto-implemented

Per instruction, the task-instrument wording (`docs/usability-dry-run/PARTICIPANT_TASKS.md` Task B) was **assessed, not rewritten** — see `REPORT.md` §14 for the reasoning. No unrelated MINOR/POLISH findings from prior AI-only audits were reopened.

## Cross-reference

Verbatim session observations and their raw classification: external, non-repository location (see session operator). This file and `REPORT.md` are the complete, git-tracked, de-identified account of what was found and changed.
