# 7. Statement, evidence and source

The product's differentiator, on one screen instead of three.

## Layout

```
┌ statement card, full verdict ─────────────────────────────┐
├──────────────┬────────────────────────────────────────────┤
│ evidence     │  source, exact highlight                   │
│ chain 1..n   │  path · lines 118–126 · legend             │
│ (kind, path, │  ─────────────────────────────────────     │
│  line range, │  117  const token = …                      │
│  reason)     │ ▌118  await notification.send({            │
│              │ ▌119    to: user.email,                    │
└──────────────┴────────────────────────────────────────────┘
```

## Rules

- The evidence chain is **ordered and numbered** — it is a chain, not a list.
- Each item states its kind (call site, definition, import) and why it counts,
  including the extractor when known.
- The highlight is a tinted band **plus** a 3px left edge, so it survives dark
  mode, colour-blindness and print.
- An `INSUFFICIENT EVIDENCE` statement opens to an empty chain and an explicit
  note: nothing supports or contradicts it, and it stays listed rather than
  being dropped.
- Evidence with no navigable source region shows the reason instead of a dead
  button.
- Back returns to the same entity with the same statement still selected.

---

## Invariant V-1 — statement / evidence / source alignment (non-negotiable)

    displayed statement
        === selected evidence item
        === highlighted source lines

**Implementation rules.**

1. The evidence chain is looked up **by statement id**. There is no global
   evidence list.
2. Each evidence item carries its own source window and its own highlight
   range. The source pane renders the **active** item — never a fixed excerpt.
3. On opening a statement, the first item in its chain is selected, and the
   source pane opens on that item's highlight.
4. The kind of evidence must match the kind of claim. For an **import**
   statement the first evidence item is the import site itself.

**Corrected example.** *"auth.service.js imports token verification from
auth.config.js"* → evidence 1 = IMPORT, `auth.service.js:112`, highlight line
112, `const { verifyToken } = require("../config/auth.config");` → evidence 2 =
DEFINITION, `auth.config.js:31–36`. The previous mockup selected a call-site
block at 118–126; that is evidence for a different statement and has been
removed.

A statement with no evidence (INSUFFICIENT EVIDENCE) shows an empty chain and
an explicit no-source message. It never borrows another statement's source.
