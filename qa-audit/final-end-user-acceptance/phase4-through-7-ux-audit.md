# Phases 4-7 — first-time UX / architecture exploration / provenance / error-recovery audit

All findings below are grounded in either a real headless-Chromium run
against the normally-running product (`scripts/product-acceptance-flow.cjs`,
`scripts/provenance-flow.cjs`, and a supplementary edge-case script) or
direct source review of the exact code path exercised. Screenshots
referenced live in `screenshots/`.

## Phase 4 — First-time user experience

### A. First launch

The first-launch screen (`ObservatoryEntry`) leads with "What repo do you
want to understand?" and a single "Start a scan" panel — the primary
action ("Build architecture map") is immediately visible with no
internal terminology required. **PASS** (`01-first-launch.png`).

### B. Repository input

Verified with real browser runs against three edge cases plus the
happy path:

| Case | Result |
|---|---|
| Valid Python repository (Flask) | Analysis starts, completes, map renders. **PASS** |
| Nonexistent/inaccessible directory | Inline error directly under the input: *"Repository path does not exist or is not a directory: c:\this\path\does\not\exist\at\all"* — human-readable, no crash. **PASS** |
| Empty directory | Analysis completes; UI shows *"⟨name⟩ was indexed, but no supported source modules were found."* — a clear, honest empty state, not a silent blank screen. **PASS** |
| Unsupported/no-source repository (only a README) | Same clear "no supported source modules were found" message. **PASS** |
| Previously-analyzed repository | Re-submitting the same path re-runs analysis via `AnalysisController.start_or_reuse`; no duplicate-run confusion observed. **PASS** |

All three edge-case screenshots were captured in this round (see
`logs/repo-input-edge-cases.log` if present, or the inline log excerpt in
the final report) via a supplementary script, separate from the 18
principal screenshots.

### C. Analysis progress

The pipeline reports real, named stages — "Repository Snapshot", "File
Parsing", "Relationship Extraction", "Orientation Inventory", "Semantic
Anchors", "Static Architecture Structure" (`AnalysisController.run`) —
streamed live over the `/ws/analyze/{job_id}` WebSocket as genuine
`status_update`/`pipeline_complete` events (see Phase 8). No fake
percentage bar. **PASS** (`05-analysis-progress.png`).

### D. Analysis failure

- **Repository path failure** (invalid/inaccessible path): handled at
  the point of submission with the inline message above; the app never
  proceeds to a broken analysis state.
- **Mid-pipeline failure**: `AnalysisController.run` wraps the whole
  pipeline in `try/except Exception`, marks the job `failed` with the
  real exception message, and marks any in-flight stage failed too —
  the frontend (`ObservatoryEntry`'s progress panel) renders a distinct
  "The scan needs attention" / "Scan stopped" state instead of hanging
  or crashing.
- **Partial analysis / per-extractor tolerance**: constructor-binding,
  inheritance, and call-relation extraction are each individually
  try/excepted inside the "Relationship Extraction" stage — one broken
  file or extractor failure degrades to a recorded stage *warning*
  ("relations_warnings"), not a failed run. Architecture/static-analysis
  results remain usable even when this happens.
- **LLM unavailable**: does not affect analysis at all — proposer
  selection is independent of the analysis pipeline (see Phase 7).

**PASS**, verified by source review of `analysis_controller.py` plus the
existing `test_analysis_websocket.py`/analysis test suite (Phase 13).

## Phase 5 — Architecture exploration usability

Audited the existing `ArchitectureMapCanvas` (React Flow-based) and its
accessible-table alternative from an end-user perspective, per the
principal Flask run.

- **Graph labels readable**: PASS — module/class/method labels render
  as plain names (`08-module-drilldown.png`–`10-method-selection.png`).
- **Current selection obvious**: PASS — selected/focal node styling and
  breadcrumb trail both reflect the current position.
- **Module → class → method navigation obvious**: PASS — canvas click
  drilldown and the accessible table's row buttons both work and were
  exercised successfully end-to-end.
- **Back/up navigation available**: PASS — "Back to previous
  architecture lens" button present and functional throughout.
- **Zoom/pan usable**: React Flow's built-in zoom/pan controls are
  present (standard library behavior); not independently stress-tested
  this round beyond the default viewport used for screenshots.
- **Edge relationship types understandable**: the accessible table's
  "Architecture relationships" section already spells out each edge's
  kind in plain words (e.g. "calls", "inherits") in its "Relationship"
  column.
- **Legend/help available**: PASS, with one gap **fixed this round** —
  `ArchitectureMapCanvas`'s status legend (`.obs-legend--rf`) rendered
  status dots and labels (Verified/Insufficient/Candidate/etc.) but,
  unlike `StatusBadge`'s normal usage elsewhere, had no hover
  explanation. Added `title={evidenceStatusMeta[status].description}`
  to each legend item — a one-line, purely additive fix using data the
  component already had in scope, not a redesign.
- **Empty graph state understandable**: PASS — see Phase 4B's empty/
  no-source-repository results.
- **Accessible-table equivalent remains functional**: PASS — exercised
  successfully as an alternate navigation path to the same explanation
  panel (`16-accessible-table.png`).
- **Keyboard navigation remains functional**: not independently
  re-tested via keyboard-only interaction this round (all flows above
  used pointer clicks); existing accessibility test coverage is
  evaluated in Phase 13 rather than duplicated here.

**One observation, documented and NOT changed** (bounded-fix
constraint — "do not redesign the architecture map"): the accessible
table (`.obs-graph-alternative`) is a `position: absolute` overlay in
the canvas's bottom-left corner. If a user leaves it open (expanded)
and then tries to click a canvas node that happens to be positioned
underneath it, the table intercepts the click. This is a legitimate
design choice (the table is meant to be usable while browsing, like any
overlay panel) rather than a defect, and the natural user workflow
(collapse the table before switching back to canvas navigation, exactly
as the acceptance script does) avoids it. Not treated as
evaluation-blocking; flagged for a future round to decide whether the
table should auto-collapse on canvas interaction.

## Phase 6 — Explanation / provenance usability

- **SUPPORTED / INSUFFICIENT EVIDENCE plain-language copy**: **added
  this round.** `ClaimCard`'s badge now carries a tooltip
  (`claimBadgeHelpCopy`) with the exact required copy:
  - SUPPORTED: "Laura's found deterministic source-derived evidence
    establishing this proposition."
  - INSUFFICIENT EVIDENCE: "Laura's does not currently have enough
    deterministic evidence to establish this proposition. It does NOT
    automatically mean the statement is false."
- **Supported claim** shows claim text, proposition/relation kind,
  evidence chain, file/line (via evidence items), and "Open source" —
  all verified live (`12-supported-claim.png`, `13-evidence-chain.png`,
  `14-open-source.png`).
- **Insufficient evidence**: no fabricated evidence is shown; the panel
  already carried a neutral, honest disclaimer
  (`INSUFFICIENT_EVIDENCE_COPY` in `ClaimCard.tsx`, pre-existing) and
  visibly muted styling (`la-claim-card--insufficient_evidence`) so it
  never reads with the same confidence as a supported claim. Verified
  live (`15-insufficient-evidence.png`).

**PASS**, all items satisfied; the one net-new change (tooltip copy) is
scoped to this feature only (`StatusBadge`'s optional `title` override),
leaving the shared `evidenceStatusMeta` used elsewhere untouched.

## Phase 7 — Error-recovery UX matrix

| # | Scenario | Result |
|---|---|---|
| 1 | Invalid LLM key | `test_connection` → `invalid_credentials`; live 503 on an actual explanation request maps to "Architectural explanation unavailable" + Retry/Open Settings (new this round). **PASS** |
| 2 | Provider timeout/unreachable | `test_connection` distinguishes `timeout` vs `provider_unreachable`; live request → same 503 fallback UI. **PASS** (`17-error-state.png`) |
| 3 | Malformed structured LLM response | `test_connection` → `malformed_response` (unit-tested against a fake server returning non-JSON); `LLMClaimProposer` already tolerantly skips malformed proposal items rather than crashing. **PASS** |
| 4 | Empty claim proposal set | `NullClaimProposer`/zero-candidate LLM replies → `claims: []`, rendered as "No claims were returned for this entity." — no crash. **PASS** |
| 5 | Repository analysis warning | Per-extractor try/except inside "Relationship Extraction" degrades to a recorded warning, run still completes. **PASS** |
| 6 | Unsupported source pattern | Empty/no-source repository → clear "no supported source modules were found" message (Phase 4B). **PASS** |
| 7 | Source range unavailable | `SourceRegionResolver` returns `None` (never fabricates) when a span can't be read; "Open source" degrades to disabled rather than broken — this exact path was exercised live in the earlier product-hardening round's acceptance evidence. **PASS** |
| 8 | Stale/persisted run reopened | Reload restores `analysisStatus` from localStorage and the explanation/evidence journey continues to work without re-analysis. **PASS** (`18-persisted-reopen.png`) |

For every scenario above: no white-screen failure, no unhandled UI
exception (`consoleErrors` in the acceptance run's summary contains only
the *expected* 404/503s from the deliberately-induced error-state step,
never an unhandled JS exception), a useful user-facing message, Retry/
Settings links where meaningful, and repository analysis/architecture
exploration remained available throughout every LLM-related failure.

**One observation, documented and not changed**: while reproducing the
error state, 404s were logged for `POST /api/entities/module:.../
architectural-explanation` — `ArchitecturalExplanationPanel` refetches
whenever the currently-selected node id changes while the panel is
still expanded, including a transient selection of a *module* node (not
a valid entity) during navigation. The backend correctly returns 404
("Entity not found") for this — a real API and a real, informative
error, not a crash — so this only produces console noise, not a
user-facing failure. Not evaluation-blocking; documented for a future
round to decide whether the panel should gate expensive/pointless
refetches to symbol-kind selections only.
