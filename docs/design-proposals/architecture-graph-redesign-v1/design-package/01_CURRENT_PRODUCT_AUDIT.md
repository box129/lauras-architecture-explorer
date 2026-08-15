# 1. Current product audit

## What the product is

A local, source-first architecture explorer. It parses a repository, recovers
real relations, groups them structurally, proposes architectural statements,
and verifies each one against evidence. Its differentiator is not the graph —
it is that **every statement can be walked down to a file and a line range**.

## What the implementation gets right

- The four-state journey (Overview → Group → Entity → Evidence) is real and
  wired, with breadcrumb, URL state and an accessible table mirror.
- C1 nested deterministic containment ships, proving compound nodes are
  feasible in the installed ReactFlow.
- The verifier vocabulary is honest and three-valued, with an
  "insufficient" state that is displayed rather than hidden.
- Analysis works with no model configured, and the map routes are hard-gated
  against accidental LLM traffic.

## What is failing users

| Finding | Evidence | Diagnosis |
|---|---|---|
| "Many boxes" | Participant #1 | The Overview shows *inventory*, not *architecture*. Peer cards at one level carry no containment signal, so the eye has nothing to group. |
| Categorisation not obvious | P#1, P#2 | Directory names are the only grouping, and they are rendered like labels rather than like enclosures. |
| Didn't know how to use the map | P#1 | Affordances were hover-gated; the first screen never states what a click does. |
| Back unpredictable | P#1 | Four competing Back-like affordances with three different meanings. |
| Status terminology misread | P#1 | Node-level "map confidence" and claim-level verification share visual space and both read as trust scores. |
| "Claim" confusing | P#1 | Research vocabulary leaked into the product surface. |
| AI contribution invisible | P#2 | AI touches exactly one panel; Settings implies it touches the product. |
| Right panel unrelated | P#2 | Default panel is repo-wide README orientation while the user is looking at a group. |
| Canvas starved | screenshots | A tall bottom bar plus a fixed rail leaves little map at 1366×768. |
| Accessible table heavy | screenshots | Correct, but presented as a debug overlay, not a peer view. |

## Root cause

Two problems, not ten.

1. **The Overview answers "what files exist" when the user asked "how is this
   built".** Everything downstream inherits that.
2. **Four kinds of fact — structure, derived cluster, AI interpretation,
   verified statement — are rendered in one visual register.** Users then
   either over-trust everything or trust nothing.

The redesign attacks exactly those two, and treats the rest as consequences.
