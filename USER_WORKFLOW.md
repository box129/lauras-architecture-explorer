# Laura's — validated user workflow (v2-provenance-explanation-usable)

This document describes exactly what an evaluator can do in the
application today, as directly validated by a real, headless-Chromium
browser run against an unmodified real-world repository (Flask), with
zero test-only state injection — see `qa-audit/v2-final-hardening/` for
the full screenshot record and driver script.

It intentionally does not describe anything that was not run and
observed working.

## Repository → Architecture → Entity → Architectural Explanation → Claim status → Evidence chain → Exact source

1. **Configure Architectural Explanations** (once, via backend environment
   variables — a real product configuration boundary, not a hidden test
   hook):
   - `SYNTAX_TREE_ARCH_EXPLANATION_ENABLED=1`
   - `SYNTAX_TREE_ARCH_EXPLANATION_LLM_PROVIDER=openrouter` (or `blackbox`)
   - `SYNTAX_TREE_ARCH_EXPLANATION_LLM_MODEL=<model id>`
   - `SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY=<key>`
   - optionally `SYNTAX_TREE_ARCH_EXPLANATION_LLM_BASE_URL` /
     `SYNTAX_TREE_ARCH_EXPLANATION_LLM_TIMEOUT_SECONDS`

   This is independent of the legacy `SYNTAX_TREE_LLM_PROVIDER` /
   `OPENROUTER_*` / `BLACKBOX_*` variables that control the architecture
   map's own overview generation — enabling one does not enable the other.
   `GET /api/health` reports the live status of both (never the credential
   value) under `llm` and `architectural_explanation_llm`.

2. **Launch the application** and enter a repository path in "Repository
   path", then click "Build architecture map". The app analyzes the
   repository and renders the architecture map once complete.

3. **Navigate the architecture map** from the repository root down to a
   specific method, either way:
   - **Canvas**: click a module card (drills in), then a class card
     (drills in), then a method card (selects it — the leaf).
   - **Accessible table**: open "View architecture as accessible tables"
     and click the same sequence of row buttons. Both surfaces call the
     identical navigation logic and produce identical results.

4. **Open "Architectural Explanation"** for the selected entity. The panel
   requests `POST /api/entities/{id}/architectural-explanation` and
   renders a narrative distinguishing what could and could not be
   established, plus a list of individual claims.

5. **Inspect claim status.** Each claim shows a badge —
   **SUPPORTED** or **INSUFFICIENT EVIDENCE** — with visibly distinct
   styling (muted/dashed for insufficient) and, for insufficient claims,
   an explicit disclaimer. Insufficient claims are never presented with
   the same visual certainty as supported ones.

6. **Expand a claim's evidence chain.** Clicking a claim shows its
   evidence: the relation type (e.g. "DIRECT RELATION: CALLS"), the exact
   symbol ids involved, and — when the underlying relation has a real
   source span — a description citing the extractor and version that
   observed it (e.g. `python_call_extractor@0.3.0`) and the exact
   `file:start_line-end_line`.

7. **Open the exact source.** Click "Open source" on an evidence item.
   If the item has no navigable source region, the button is disabled
   with explicit copy explaining why — never a silent no-op. Otherwise it
   opens a source overlay showing the real file content in the existing
   Monaco-based code viewer, scrolled to and highlighting the exact cited
   line. Click "Close" to return to the architecture view.

8. **Reload and resume.** Refreshing the page preserves the completed
   analysis (persisted server-side in SQLite, referenced client-side via
   localStorage); the same navigation → explanation → evidence → source
   journey works again immediately, without re-analyzing the repository.

## What this does NOT (yet) claim

- No real external LLM provider was exercised during this validation
  round (no credentials were available in this environment) — claim
  *generation* wiring was proven with mocked/local-stand-in providers
  only. Claim *verification* (SUPPORTED / INSUFFICIENT_EVIDENCE) is
  always deterministic and never LLM-decided, regardless of provider.
- "Open source" only works for evidence whose underlying relation had a
  real, extractor-observed source span; relations without one honestly
  report no navigable source rather than fabricating a location.
- Only Firefox/WebKit were out of scope for this round; validation was
  Chromium-only.
