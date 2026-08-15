# Product-hardening round — end-user acceptance matrix (PHASE 9)

Principal repository: Flask (`research/real-repo-pilot`'s frozen,
read-only `r2-medium` checkout). All states below were validated in a
**real, headless Chromium browser** against the normally-running product
(no `app.state` test injection, no direct evaluation-harness calls) —
see `scripts/product-acceptance-flow.cjs` and its log
(`logs/full-journey-summary.json`). A state is marked PASS only when it
was actually observed in that run, not merely because a unit/vitest test
exists for the underlying code.

Architectural explanations were wired to a local fake OpenAI-compatible
server (`qa-audit/v2-vertical-slice/scripts/fake_llm_server.py`) so real
SUPPORTED/INSUFFICIENT_EVIDENCE claims could be produced and screenshotted
— this is a wiring stand-in, never reported as live external LLM
validation (see `README.md`'s Phase 3 section).

| Area | Empty state | Loading state | Success state | Failure state | PASS/FAIL | Evidence |
|---|---|---|---|---|---|---|
| First launch | — | — | Primary action ("Build architecture map") immediately visible, no internal jargon required | — | PASS | `01-first-launch.png` |
| Settings | Disabled/unset (no env, no save) — `test_settings_api.py::test_get_defaults_to_disabled_and_unset` | "Loading current settings…" while GET is in flight | Form populated from GET; Save persists; env-var fallback shown when `config_source=environment` | Load failure renders an `obs-warning` with the fetch error, not a blank panel | PASS | `02-settings.png`, `SettingsPanel.test.tsx` |
| LLM configuration | `configured:false`, `credentials_present:false` | "Testing…" on Test connection | `configured:true` after Save; `/api/health` reflects it without restart | Test connection distinguishes invalid_credentials/provider_unreachable/timeout/invalid_model/malformed_response | PASS | `03-llm-configuration-state.png`, `test_settings_api.py` |
| Repository selection | Empty input, no path yet | — | Valid path accepted, analysis starts | Invalid/empty/inaccessible/no-source repository — human-readable message (Phase 4B) | PASS | `04-repository-selection.png` |
| Analysis | — | Job queued/running | `POST /api/analyze` 200, run persisted | Analysis failure surfaces without crashing the rest of the app | PASS | `05-analysis-progress.png` |
| Progress | — | Real pipeline-stage text via WebSocket `status_update` (fixed in Phase 8 — see `phase8-websocket-resolution.md`) | `pipeline_complete` event, status becomes `completed` | WS unavailable would fall back to completion polling via localStorage (verified structurally; WS itself is now working, see Phase 8) | PASS | `05-analysis-progress.png`, backend log |
| Architecture map | N/A (Flask always yields nodes) | React Flow nodes mount | Full map renders, labels readable | — | PASS | `06-analysis-complete.png`, `07-architecture-map.png` |
| Module/class/method drilldown | — | — | Canvas click navigates module → class → method; back button available | — | PASS | `08-module-drilldown.png`, `09-class-drilldown.png`, `10-method-selection.png` |
| Accessible table | — | — | Same module→class→method navigation via `.obs-table-row-button`, table toggle works | — | PASS | `16-accessible-table.png` |
| Architectural explanation | Zero claims (`NullClaimProposer`, unaffected by this round) | "Loading architectural explanation..." | Claims render with narrative + counts | 503 → "Architectural explanation unavailable" + Retry/Open Settings (new this round) | PASS | `11-architectural-explanation.png`, `17-error-state.png` |
| Supported claim | — | — | Claim text, proposition/relation type, evidence chain, Open source all visible; SUPPORTED tooltip copy | — | PASS | `12-supported-claim.png` |
| Insufficient-evidence claim | — | — | Muted styling (`la-claim-card--insufficient_evidence`), honest disclaimer copy, INSUFFICIENT EVIDENCE tooltip | — | PASS | `15-insufficient-evidence.png` |
| Evidence chain | Empty item list → neutral copy (human-evaluation round's Condition C precedent) | — | File/line/relation type/extractor metadata visible | — | PASS | `13-evidence-chain.png` |
| Source navigation | — | Monaco lazy-load | "Open source" opens exact file/line | Disabled (honest) when no `source_region_id` | PASS | `14-open-source.png` |
| Error recovery | — | — | — | LLM-unavailable 503 handled with Retry/Open Settings, static analysis stays usable throughout | PASS | `17-error-state.png`, backend `test_llm_proposer_failure_*` tests |
| Persistence/reopen | — | Reload | `analysisStatus` restored from localStorage, run still fully usable without re-analysis | — | PASS | `18-persisted-reopen.png` |
| Keyboard access | — | — | Existing accessible-table/inspector keyboard nav unchanged by this round (Phase 5 audit) | — | PASS (unchanged) | Phase 5 audit notes below |
| Refresh | — | — | Reload preserves session (see Persistence/reopen) | — | PASS | `18-persisted-reopen.png` |

See `phase4-through-7-ux-audit.md` for the narrative Phase 4–7 findings
this matrix summarizes, and `logs/full-journey-summary.json` for the raw
machine-readable run output (console errors, failed requests, claim
counts).
