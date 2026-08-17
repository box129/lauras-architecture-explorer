# 14. Settings

Three sections: **Appearance**, **AI**, **Technical details**.

## Appearance

System / Light / Dark, labelled. One sentence on what "System" means.

## AI — the mental-model fix

Two explicit columns, side by side:

```
✦ AI is used for                        ⛨ Always deterministic
  Architectural explanation               Source analysis and symbol extraction
  Architecture group interpretation       Relation extraction
    [not implemented yet]                 Structural grouping and clustering
                                          Evidence verification
```

Each row says exactly what changes. Provider selection sits above the columns,
so the consequence is visible at the moment of choosing.

Plus a standing note: **Doc Studio uses a separate, deployment-level model
configuration not exposed here.** The silence that let Participant #2 infer
"more AI = more architecture" is what created the problem; stating the boundary
is the fix.

No "Maximum AI" wording. No reasoning-effort dial — the gap was scope
communication, not a missing control.

## Technical details

Collapsed. Run id, projection version, input hash, effective model. This is
where every string in the vocabulary cleanup table goes to live.

---

## Final revision — provider contract and one AI mental model

### Providers

The provider control offers exactly:

    None · OpenAI · OpenRouter

OpenAI is the explicit provider in active product development and is the
default selection. **Blackbox has been removed** — it was carried over from
older UI code and is not part of the target contract. Do not reintroduce a
provider because legacy code or older design material mentions it.

### One configuration surface

There is one AI configuration surface, and it governs every AI feature:

    AI provider
      ├── Architectural explanation
      ├── Architecture-group interpretation
      └── Doc Studio AI content

The surface map lists all three. Doc Studio is listed here as a first-class
consumer of this setting; the screen states plainly: *"One provider, one key,
one place. Every AI surface in Laura's — including Doc Studio — uses what is
set here."*

With **None** selected, analysis, clustering and verification are unaffected;
only the three interpretive surfaces are unavailable.
