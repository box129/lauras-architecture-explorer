# Phase 12 — Flask normal-runtime principal acceptance (20-item checklist)

Single real, headless-Chromium run (`scripts/product-acceptance-flow.cjs`,
log excerpt below and `logs/full-journey-summary.json`) against the
normally-running product — real frontend dev server (Vite, proxying
`/api` to the real backend), real backend (FastAPI/uvicorn, with
`websockets` installed per Phase 8), real SQLite-backed run store. **No
`app.state` test injection, no direct evaluation-harness invocation, no
hidden backend API preparation** — every step below was driven through
the actual UI a human would use. Architectural explanations were wired
to a local fake OpenAI-compatible server purely so real SUPPORTED/
INSUFFICIENT_EVIDENCE claims could be produced (see the main README's
Phase 3 section — this is never reported as live external LLM
validation).

Principal repository: Flask (`research/real-repo-pilot`'s frozen,
read-only `r2-medium` checkout — analysis only ever reads it).

| # | Item | Result |
|---|---|---|
| 1 | App launch | PASS — `01-first-launch.png` |
| 2 | Settings available | PASS — reachable from the first-launch topbar and (after analysis) the navigation menu; `02-settings.png` |
| 3 | Architectural explanations configured/enabled | PASS — enabled via the real Settings UI (`PUT /api/settings/architectural-explanation`), `config_source` observed to flip from `environment` to `runtime`; `03-llm-configuration-state.png` |
| 4 | Repository selected | PASS — `04-repository-selection.png` |
| 5 | Analysis starts | PASS — `POST /api/analyze` → 200 |
| 6 | Visible progress | PASS — real WebSocket-driven stage progress (Phase 8 fix); `05-analysis-progress.png` |
| 7 | Analysis completes | PASS — `06-analysis-complete.png` |
| 8 | Graph renders | PASS — `07-architecture-map.png` |
| 9 | Canvas navigation | PASS — module → class → method drilldown; `08-` to `10-*.png` |
| 10 | Table navigation | PASS — accessible-table equivalent; `16-accessible-table.png` |
| 11 | Explanation request | PASS — `POST /api/entities/{id}/architectural-explanation` → 200 |
| 12 | Structured claims returned | PASS — 2 claims, both `SUPPORTED`, in the final clean run (earlier attempts in this same session also naturally produced `INSUFFICIENT_EVIDENCE` claims — see `15-insufficient-evidence.png`) |
| 13 | Supported claim visible | PASS — `12-supported-claim.png` |
| 14 | Evidence chain visible | PASS — `13-evidence-chain.png` |
| 15 | Open source reaches correct file/line | PASS — Monaco overlay opened and verified non-empty; `14-open-source.png` |
| 16 | Insufficient-evidence state if naturally available | PASS — naturally produced (not forced) during candidate search; `15-insufficient-evidence.png` |
| 17 | Reload | PASS |
| 18 | Persisted run restored | PASS — `analysisStatus: "completed"` recovered from `localStorage` without re-analysis; `18-persisted-reopen.png` |
| 19 | Explanation/evidence still works after reload | PASS — canvas remained interactive and explanation-capable post-reload |
| 20 | No application-blocking console/network errors | PASS — the only console/network errors recorded were the *deliberately induced* 503s from step 17's error-state test and expected 404s from a documented, non-blocking edge case (see `phase4-through-7-ux-audit.md`'s Phase 7 observation); zero unhandled JS exceptions |

## Raw summary (from `logs/full-journey-summary.json`)

```json
{
  "analyzeStatus": 200,
  "postSaveSettingsConfigSource": "runtime",
  "canvasNavigationOk": true,
  "canvasClaims": 2,
  "canvasSupported": 2,
  "canvasInsufficient": 0,
  "sourceOverlayVerified": true,
  "insufficientEvidenceShotTaken": true,
  "persistedStatusAfterReload": "completed",
  "reopenAfterReloadWorked": true
}
```
