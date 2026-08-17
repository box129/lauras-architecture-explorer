# 10. Verified statement visual language

## The component

`StatementCard` — square 8px corners, a **3px left status bar**, the uppercase
verdict, and the shape-coded status dot. Unsupported verdicts get a **dashed**
outline in addition to their colour.

```
● SUPPORTED
auth.service.js calls notification.service.js when a session is created
calls · direct_relation      3 evidence items          View evidence →

◐ INSUFFICIENT EVIDENCE                              (dashed border)
auth.service.js is reachable from the public HTTP surface
reachability                 no evidence found
```

## Rules

- The three words are reserved for verifier output. Nothing else may render them.
- The dot's *shape* carries the verdict — filled, half, slashed — so colour is
  never load-bearing.
- Evidence count is always stated, including zero, worded as "no evidence found".
- "View evidence" appears only when there is evidence to view.
- Unproven statements are never hidden, collapsed or sorted to the bottom.
- The word "claim" does not appear in the UI. It is a *statement*.
