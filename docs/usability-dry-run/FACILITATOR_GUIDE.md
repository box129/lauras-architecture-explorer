# Facilitator guide

## Framing for the participant

Read (or paraphrase closely) before starting:

> "I'm going to give you a few things to try to do with this tool. I
> didn't build it, but I want to see how it works for someone seeing it
> for the first time. There are no wrong answers and you're not being
> tested — I'm testing the software, not you. Please say out loud what
> you're looking for, what you think each part of the interface means,
> and anything that's confusing, even if you figure it out. If you get
> stuck, tell me, and I'll help — but try for a bit on your own first so
> I can see where things break down."

## Think-aloud reminder

If the participant goes quiet for more than ~15 seconds while clearly
still working, a gentle nudge is fine and is **not** an intervention:

> "What are you looking for right now?"

## Facilitator intervention levels

Define these before the session and record every Level 2 or Level 3 on
the observation sheet.

| Level | Description | Example |
|---|---|---|
| **0** | No help | (participant proceeds unaided) |
| **1** | Generic prompt | "What would you try next?" |
| **2** | Directional help | "There's another navigation option in the left panel." |
| **3** | Explicit instruction | "Click the 'Architectural Explanation' button." |

A **Level 3 intervention on a core workflow** (analyze, navigate,
request an explanation, read a claim, open source) should be treated as
a usability problem requiring review before the formal study — write it
up prominently, don't bury it in the notes.

## What to do, and not do

- Only give goal-oriented instructions from `PARTICIPANT_TASKS.md` —
  never "click X", "select Y", or "open this exact claim", unless the
  participant is genuinely stuck and you are deliberately recording a
  Level 3 intervention.
- Do not correct a participant's misunderstanding mid-task unless they
  ask directly — let them work with a wrong mental model for a bit and
  note it; correcting it live destroys the signal.
- Do not deliberately cause a provider/network failure to "test" error
  recovery in front of a real participant. If one happens naturally
  (it has, once, during product readiness testing — see
  `qa-audit/usability-dry-run-readiness/REPORT.md`), let them react and
  note what they do.
- Do not let the participant type or see the API key. It's already
  configured before they sit down (see `SESSION_CHECKLIST.md`).
- Do not ask them to use developer tools, inspect network requests, or
  read logs. If they discover DevTools on their own, that itself is a
  data point (why did they feel they needed to?), not something to
  encourage.

## Recording / privacy

- Capture screen, and participant audio only if they've consented and
  it's appropriate for your context.
- Record your own facilitator intervention notes as you go (level +
  one-line description), not just after the fact — memory of exact
  wording fades fast.
- **Never record or reveal the OpenAI API key.** Configure it before
  recording begins (`SESSION_CHECKLIST.md` step 4/7). If Settings ever
  needs to be reopened mid-session (e.g. to re-enter a cleared key after
  an unrelated backend restart), pause recording first.
- Do not collect unnecessary personal information. A first name or
  pseudonym is enough for your own notes; you don't need more.
- This kit is not a substitute for your institution's ethics/consent
  requirements if any apply to your context — check separately.

## After the session

Debrief using `DEBRIEF_QUESTIONS.md`, then fold your findings into a
short internal summary (see `SESSION_CHECKLIST.md` step 18). Keep this
kit's protocol documents (in `docs/usability-dry-run/`) separate from
any actual participant data, recordings, or notes — those don't belong
in this repository.
