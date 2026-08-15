# Configuring an OpenAI-compatible provider for Architectural Explanations

This document was rewritten by reading Laura's actual implementation in
this checkout (usability dry-run preparation round), not inferred from
prior conversations or an earlier version of this doc. Source references:

- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/investigation/llm_model.py`
  (`OpenAICompatibleInvestigationModel`, the class that makes the real
  network call)
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/investigation/providers.py`
  (provider identity and Chat Completions capability rules)
- `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/app/architectural_explanation/connection_test.py`
  (what "Test connection" actually does)
- `syntax-tree-ui/src/features/settings/types.ts` (`PROVIDER_OPTIONS`,
  the exact dropdown values the UI sends)
- `syntax-tree-ui/src/features/settings/SettingsPanel.tsx` (Save/Enabled/
  Test connection UI behavior)

**No API key is included anywhere in this document, and none is
required to read or use it.**

## What Laura's actually calls

Laura's makes exactly one kind of request for both live claim proposals
and "Test connection":

```
POST {API Base URL}/chat/completions
Authorization: Bearer <your key>
Content-Type: application/json

{
  "model": "<your model>",
  "messages": [...],
  "temperature": 0,
  "max_completion_tokens": <n>   // OpenAI (see below)
  "max_tokens": <n>              // OpenRouter / Blackbox / other proxies
}
```

This is the OpenAI **Chat Completions** wire format.

- It does **not** call `/v1/responses`.
- It does **not** call `/v1/models` (list models) anywhere in the
  codebase.
- **Test connection performs a real, tiny inference call** to
  `/chat/completions` (asking the model to reply with a short JSON
  object) — it does not just list or validate model names.
- OpenAI's current model families (the `gpt-5.x`/`o1`/`o3`/`o4`
  reasoning families) reject the legacy `max_tokens` field with an HTTP
  400. When Provider is `OpenAI` (or the Base URL host is
  `api.openai.com`), Laura's automatically sends `max_completion_tokens`
  instead, and additionally sends `"reasoning_effort": "none"` for
  reasoning-capable models (lowest effort, since this is a single-shot
  structured claim-proposal call with no benefit from deeper reasoning).
  OpenRouter, Blackbox, and other OpenAI-compatible proxies still
  receive the legacy `max_tokens` field, unchanged. You do not configure
  this — it is automatic based on the selected provider/base URL.

## The "Provider" field

The Settings dropdown has exactly four values
(`syntax-tree-ui/src/features/settings/types.ts`):

| Dropdown label | Value sent to backend |
|---|---|
| Disabled (no provider) | `off` |
| OpenAI | `openai` |
| OpenRouter | `openrouter` |
| Blackbox | `blackbox` |

**`OpenAI` is a first-class, explicit option** — select it directly to
point Laura's at OpenAI's real API; you do not need to select
`OpenRouter` and override the Base URL as a workaround. Selecting
`OpenAI` also determines the `max_completion_tokens`/`reasoning_effort`
request-shape behavior described above.

## Values to enter

| Field | Value | Verified against |
|---|---|---|
| Enabled | checked | — |
| Provider | `OpenAI` | `PROVIDER_OPTIONS` |
| API Base URL | `https://api.openai.com/v1` (this is also the built-in default for the `OpenAI` provider if left blank) | matches the `{base}/chat/completions` call shape above |
| Model | `gpt-5.4-mini` | used as the live model throughout this program's real-OpenAI validation runs (`qa-audit/live-openai-*-validation/`); confirmed working against a real OpenAI account. Laura's code does not validate or allow-list model names — whatever you type is sent verbatim as the `"model"` field. |
| API Key | *(your own restricted key — never entered by Laura's documentation or automation)* | — |

## Minimum restricted-key permissions

Since Laura's only ever calls `/chat/completions` (never `/v1/models`,
`/v1/assistants`, `/v1/threads`, or `/v1/evals`), the least-privilege
starting point is:

```
Restricted

Model capabilities: Write
Assistants:         None
Threads:             None
Evals:                None
```

**"List models" (Models: Read) is NOT required** — Laura's never calls
that endpoint. If your OpenAI key-creation UI groups "list models" under
a different capability than "Model capabilities: Write", leave it at
`None`; Laura's will still work because it never calls that endpoint.

## Exact Settings navigation path

Where the "Settings" entry point is depends on which screen you're on
(verified live, both paths lead to the identical Settings dialog):

- **Before analyzing anything** (first launch): a **Settings** button/
  link is directly visible in the top-right of the page.
- **After an analysis is running or complete**: click the menu icon
  (☰) in the top-left, then choose **Settings** from that menu.

```
Settings
  → Architectural Explanations
      → Enabled (checkbox)
      → Provider (dropdown: Disabled / OpenAI / OpenRouter / Blackbox)
      → API Base URL (text field)
      → Model (text field)
      → API Key (password field)
      → [Test connection] button
      → [Save] button
```

## Save vs. Test connection — these are two different actions

- **Test connection** makes a real, tiny inference call using whatever
  is currently typed in the form. It tells you whether the provider,
  base URL, model, and key work — **it does not save or enable
  anything**. If you close Settings after only testing, nothing has
  changed.
- **Save** is what actually persists the configuration to the running
  backend process and makes it take effect. The **Enabled** checkbox
  must also be checked and saved for architectural explanations to
  actually turn on — a successful "Test connection" with Enabled
  unchecked (or with unsaved edits) does not activate the feature.
- The Settings screen now shows this explicitly: after a successful
  test while the form has unsaved changes, it adds *"This only checked
  the connection — it did not save or enable anything. Click Save to
  apply these settings."* Any unsaved edit also shows a persistent
  *"Configuration has unsaved changes"* hint until you click Save.

## Credential handling (verified from the running backend)

- **GET/PUT `/api/settings/architectural-explanation`** never returns
  the key — only `credentials_present: true/false`.
- **`/api/health`** never includes the key.
- The key is held **only in the backend process's memory** for as long
  as it keeps running (`ArchExplanationRuntimeConfig`, in-memory only —
  never written to disk, never logged).
- **Restarting the backend clears any key entered through Settings** —
  you will need to re-enter it after `.\stop-lauras.ps1` / restart, or
  set the `SYNTAX_TREE_ARCH_EXPLANATION_LLM_API_KEY` environment
  variable before starting if you want it to persist across restarts
  (still never committed to the repository — `.env` is git-ignored).

## TLS verification

Laura's verifies TLS certificates by default on every real model
request (both the "Test connection" call and live generation use the
identical SSL context — `app.investigation.llm_model._ssl_context`).
Controlled by the `SYNTAX_TREE_LLM_SSL_VERIFY` environment variable
(default `1`/enabled). There is no separate, second TLS mechanism to
reconcile. Do not disable this unless you have a specific, understood
reason to (e.g. a corporate TLS-inspecting proxy) — leaving it enabled
is the safe default and is what every real-OpenAI validation in this
program has run under.

## Port selection

`start-lauras.ps1` picks the backend/frontend ports automatically,
starting from its defaults (backend `8000`, frontend `5173`) and moving
to the next free port if something else is already using the default —
see `docs/START_HERE.md` for the exact behavior. Always use the URL the
script prints for that run, not a remembered one.

**Do not paste a real API key into any file in this repository, any
chat transcript, any screenshot, or any test.** Enter it only directly
into the Settings screen's API Key field in your browser.
