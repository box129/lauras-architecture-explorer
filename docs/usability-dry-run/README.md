# Non-scored usability dry-run

This directory is the facilitator's kit for running 1-2 **non-scored**
usability dry runs of Laura's with a person who did not build the
system.

**This is product/usability preparation, not research outcome
collection.** Dry-run participants are not scored research participants.
Their observations must never be mixed into the formal A/B/C
human-evaluation dataset — that protocol (Condition B source-context/
citation-length normalization, ethics requirements, etc.) is separate
and remains frozen; this kit does not touch it.

## What a dry run is for

To expose, before any formal study, whatever a real first-time user
finds confusing:

- confusing startup/setup;
- unclear repository-selection flow;
- map/navigation problems;
- confusing labels;
- misunderstanding of SUPPORTED vs INSUFFICIENT EVIDENCE;
- inability to follow claim → evidence → source;
- confusion about what the LLM proposed versus what Laura's verified;
- poor recovery from errors;
- accessibility/navigation issues;
- any workflow that still requires developer knowledge.

## Files in this kit

| File | Use it for |
|---|---|
| `SESSION_CHECKLIST.md` | Step-by-step, in order — start here on the day of the session |
| `FACILITATOR_GUIDE.md` | Full protocol: think-aloud framing, intervention levels, recording/privacy |
| `PARTICIPANT_TASKS.md` | The goal-oriented tasks to hand the participant (never click-by-click instructions) |
| `OBSERVATION_SHEET.md` | What to write down during the session |
| `DEBRIEF_QUESTIONS.md` | Questions to ask after the tasks are done |

## Product readiness

The product-readiness side of this preparation (is Laura's actually
ready for a participant to sit down at) is documented separately at
`qa-audit/usability-dry-run-readiness/REPORT.md` — read that before your
first session. It records what was fixed, what was verified through the
real browser UI, and the current PASS/blocker status.

## Repository used for the dry run

`pallets/flask`, pinned at commit `6a2f545bfd8ed31e19066a299296917e034aca58`
(the same revision already used and validated in this program's Flask
research rounds — see `qa-audit/live-openai-flask-confirmatory/`).
Chosen over the controlled `python_app` fixture because it's public,
already validated, has relatively strong deterministic coverage, and
gives the participant multiple real navigable entities and supported
claims to work with — reducing the risk that the session becomes
primarily a static-analysis-limitation exercise rather than a usability
one. The participant is never shown the frozen ground-truth claims file
— they are testing usability, not reproducing the research pilot.

Checkout path (already prepared, do not modify):
```
C:\Users\LENOVO T14\Development\lauras-gt-r2-flask\research\real-repo-pilot\repos\r2-medium\source\src\flask
```
