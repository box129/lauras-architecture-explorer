# LLM Configuration and Routing — End-to-End Trace

Read-only investigation. No settings were changed. One read-only `GET` was
issued against the already-running local instance to confirm current
configuration state; no state-mutating call, and no new LLM generation, was
made.

## Settings UI — what actually exists

The **only** AI-configuration screen in the product is
`syntax-tree-ui/src/features/settings/SettingsPanel.tsx`, titled
**"Architectural Explanations."** Controls: `Enabled` toggle, `Provider`
select, `API Base URL`, `Model` text field, `API Key` field, `Test
connection`, `Save`. There is **no separate "advanced"/"stronger" tier** —
no reasoning-effort control, no model-quality picker, nothing else. The
panel's own copy states explicitly: *"Configures the language model that
proposes candidate architectural claims... Repository analysis and the
architecture map work fully without this configured."* This is the entire
AI-facing configuration surface reachable from the UI.

## Settings persistence

`PUT /api/settings/architectural-explanation` → `ArchExplanationRuntimeConfig`
(`app/architectural_explanation/runtime_config.py`) — **process-local,
in-memory only**, never written to disk/DB. Falls back to env vars
(`SYNTAX_TREE_ARCH_EXPLANATION_LLM_*`) when nothing has been saved. **Does
not survive a backend restart.**

**Live confirmation (read-only):** `GET /api/settings/architectural-
explanation` on the running instance returned `enabled: true, provider:
"openai", model: "gpt-5.4-mini", configured: true, credentials_present:
true, credential_source: "runtime"` — matching the described participant
configuration exactly, and confirming the configuration **was saved
successfully and is genuinely active**. This rules out a save/credential
failure as the cause of what the participant observed.

## The critical fact: two separate, non-overlapping LLM boundaries

1. **`arch_explanation_llm_*`** (the boundary above) — set only via the
   Settings UI. Read by exactly one place: `api/routes/
   architectural_explanation.py`'s `_model()` (via
   `make_arch_explanation_model(settings)`).
2. **`llm_provider`** (the legacy "investigation model" used by
   `SystemOverviewGenerator`/map routes/Doc Studio) — set **only** via env
   vars (`SYNTAX_TREE_LLM_PROVIDER`/`LLM_PROVIDER`), default `"off"`. **No
   UI control anywhere sets this.** In this deployment's `.env`, it is
   unset/off.

Saving the Settings-UI panel changes boundary #1 only. It has **zero
effect** on boundary #2 — the boundary that gates Overview, group
drill-down, Entity Focus, and (conditionally) Doc Studio.

## Surface-by-surface map

| UI surface | Backend route | Live LLM call possible today? | Exact gate | Where generated content would appear |
|---|---|---|---|---|
| Architecture Overview | `GET /api/architecture-map` | **No — hard-blocked** | `architecture_map.py:_model()` always returns `NoConfiguredModel()` unless a model is injected directly into `app.state.investigation_model`, which no production code path ever does (only tests) | n/a |
| Repository-section (group) drill-down | `GET .../children` | **No** | same `_model()` | n/a |
| Entity Focus / neighborhood | `GET .../neighborhood` | **No** — pure deterministic graph traversal | `projection.py: neighborhood()` | n/a |
| Architectural Explanation panel | `POST /api/entities/{id}/claims`, `POST .../architectural-explanation` | **Yes — only for a `symbol:`-id entity** | uses `make_arch_explanation_model` (boundary #1); client-gated by `VoiceRail.tsx`: `displayNode.id.startsWith('symbol:')` — never offered for a group/module/component container node | Inside the Architectural Explanation panel only, after the user drills to a leaf symbol and opens it |
| Doc Studio | `docs.py` routes | **Conditionally** — falls back to `make_live_model(settings)` (boundary #2) unless `environment=="test"` | `docs.py:_model()` | Only if `SYNTAX_TREE_LLM_PROVIDER` env var is set — it is not, in this deployment, so Doc Studio is deterministic/source-backed in practice today |
| Narrator / Play Guide | — | **No** | lives entirely outside the Observatory/architecture-map data model (confirmed absent from any investigation-model code path), a pre-existing, separately-scoped legacy surface | n/a |
| Orientation / README summary | `GET /runs/{id}/orientation` | **No** | deterministic, source-derived only — the same "guidance-only" cards already shown in the Overview | n/a |
| Legacy "Simple Explanation" | same route as Overview | **No** | same `_model()` gate | n/a |

## What "advanced settings" actually change

Nothing beyond the identity/credentials of the model backing the single
entity-scoped Architectural Explanation panel. There is no control in the
product that "strengthens" AI use more broadly — the mental model
"stronger AI settings → richer architecture documentation across the
product" has **no corresponding backend behavior anywhere**. Saving
`Provider=OpenAI, Model=gpt-5.4-mini` does not retroactively unlock
Overview, group drill-down, Doc Studio, or Narrator — those are gated by a
completely different, UI-invisible, env-var-only switch.

## Root cause of "no visible AI contribution" — confirmed combination

1. **Routing/gating (primary).** Overview, group drill-down, and Entity
   Focus are deliberately hard-wired to `NoConfiguredModel()` regardless of
   any Settings-UI state — a documented, intentional design decision after
   a past incident where ordinary map navigation fired unintended live LLM
   traffic. No Settings change reaches this surface, by design.
2. **Scope mismatch (primary).** The one surface that *does* honor the
   Settings-UI configuration (Architectural Explanation) is entity-only and
   requires drilling to a leaf symbol and explicitly opening its panel —
   the described participant behavior (configure Settings, then look at
   the Overview/groups) never reaches it.
3. **UI-discoverability (contributing).** The Settings panel's own
   disclaimer is present but easy to skim past; nothing in the Overview
   itself states "AI is not used on this screen," so there is no positive
   signal steering the user toward the one place AI-generated content
   actually does appear.
4. **Ruled out, with evidence:** credential/runtime failure (live read
   confirms `configured: true, credentials_present: true` right now), a
   Save/Test ordering problem, a silently-failed model call, and
   generated-but-unlabelled content (backend log shows no
   `POST /entities/{id}/claims` request at all in the current process,
   consistent with the panel never having been opened on an eligible
   entity rather than a call having failed).

**Classification: primarily a routing/gating decision working exactly as
designed, compounded by a product-mental-model/discoverability gap in
Settings and Overview copy — not a bug, not a configuration failure, not a
silent provider error.**
