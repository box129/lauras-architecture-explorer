# Phase 14 — End-user usability dry run

## END-USER HUMAN USABILITY DRY RUN NOT COMPLETED

No real human participants (colleagues, students, developers, or
otherwise) are available to this session — this round's work was
performed by an autonomous coding agent with no ability to recruit,
schedule, or run a live session with a human dry-run participant. This
is reported honestly rather than fabricated, and the automated Chromium
acceptance runs (`scripts/product-acceptance-flow.cjs`,
`scripts/provenance-flow.cjs`, the repository-input edge-case script) are
**not** substituted for, or described as, a human usability dry run.

This is a separate, distinct gap from the human-evaluation research
protocol's own "human dry run not completed" status
(`research/human-evaluation/15-human-dry-run-status.md`, a different
round on a different branch) — that one covers the A/B/C research
protocol; this one covers ordinary product usability with no research
conditions or scoring involved.

**What automated testing in this round already covers, and does not
cover:**

| | Automated (this round) | Still needs a human |
|---|---|---|
| Every screen renders, no crash, no unhandled exception | Yes | — |
| Every button/link is reachable and does something correct | Yes | — |
| Error messages are grammatically well-formed and technically accurate | Yes | — |
| Error messages are actually understandable to someone who has never used the tool | — | Yes |
| "Analyze a Codebase" reads as the obvious first action | — | Yes (a human's first five seconds cannot be scripted) |
| SUPPORTED / INSUFFICIENT EVIDENCE distinction is intuitive, not just present | — | Yes |
| Terminology confusion, hesitation points, where a user gets stuck | — | Yes |
| Whether the Settings screen's wording ("configured", "credential source") makes sense unprompted | — | Yes |

## Facilitator checklist (to run when a real participant becomes available)

Task for the participant, exactly as specified:

> "Use Laura's to analyze this repository and understand one
> architectural relationship."

Do not coach step-by-step unless they become blocked. Observe and record
(never treat their success/failure as scored research data — this is
usability observation only):

1. Can they find repository analysis without being told where to look?
2. Can they find and use the Settings screen to configure explanations
   (if asked to)?
3. Do they understand what the analysis-progress stage labels mean?
4. Can they navigate the graph (canvas) without guidance?
5. Can they find "Architectural Explanation" for an entity they picked
   themselves?
6. Do they correctly explain what SUPPORTED means, in their own words?
7. Do they correctly explain what INSUFFICIENT EVIDENCE means — in
   particular, do they understand it does NOT mean "false"?
8. Can they inspect an evidence chain without help?
9. Can they reach the exact source location ("Open source")?
10. Where do they hesitate, backtrack, or look confused?
11. What terminology (if any) do they ask you to explain?
12. If they hit the Settings screen: does "configured"/masked-key
    behavior make sense to them without an explanation?

Record only usability/protocol observations (confusing wording, a UI
dead end, unexpected hesitation) — never treat this as scored research
data, and keep any recorded observations separate from
`research/human-evaluation/`'s dataset.

## Status

**Not started.** This document exists so the exact, ready-to-execute
checklist is available the moment a real participant becomes available —
no further preparation is needed to begin Phase 14; it requires only a
person.
