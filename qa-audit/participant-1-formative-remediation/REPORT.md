# Participant #1 Formative Usability Remediation

**Session classification**: NON-SCORED FORMATIVE USABILITY DRY RUN — PARTICIPANT 1. This human evidence supersedes earlier expert (AI) predictions where they conflict, per instruction. These observations are **not** part of the formal A/B/C experimental outcome dataset. The formal study protocol was not touched by this round.

**Verbatim evidence**: preserved outside this git repository (external, non-tracked location), per this project's own documented privacy convention (`docs/usability-dry-run/SESSION_CHECKLIST.md`, `FACILITATOR_GUIDE.md`: "never commit participant recordings or notes into `qa-audit/` or any git-tracked path"). This report and `OVERVIEW.md` are the complete, de-identified, git-tracked account.

---

## 1. Finding classification

| ID | Area | Severity |
|---|---|---|
| B1 | Architecture-map interaction/discoverability | **BLOCKER** |
| B2/B3 | SUPPORTED / INSUFFICIENT EVIDENCE mental model | **BLOCKER** |
| M1 | Repository folder selection | MAJOR |
| M2 | Map categorization/orientation/overlap | MAJOR |
| M3 | "Claim" terminology | MAJOR |
| M4 | Navigation consistency | MAJOR |
| M5 | Doc Studio comprehensibility | MAJOR |
| M6 | "Play guide" ("Take the Tour") — unclear/broken | MAJOR (pending identification, now identified) |

All eight were addressed. No unrelated MINOR/POLISH findings from prior AI-only audits were reopened.

## 2. Native repository folder picker (M1)

A browser-hosted app cannot use a true OS-native folder dialog and still learn the selected folder's absolute filesystem path — the File System Access API deliberately withholds it. The smallest faithful equivalent: a new read-only backend endpoint, `GET /api/fs/browse-directories` (`syntax-tree-refurbished-backend/.../api/routes/browse.py`), which lists only subdirectory *names* (never files, never file contents) starting from the user's home directory / drive roots, and a new modal, `FolderBrowserDialog.tsx`, that walks it. A **Browse…** button sits next to the existing manual path input, which is unchanged and still fully available. Cancel does nothing; a folder is only handed to the analyze flow on explicit "Use this folder."

## 3. Map interaction affordance (B1)

Every map node was already a real, focusable `<button>` with hover/cursor styling — but that affordance is only discoverable by hovering, and the participant scrolled without ever clicking. Fixes, all always-on (not hover-dependent): a persistent "Select an area to explore it." line above the map; a visible kind label on every card (see §4); a small drill-down chevron on drillable cards; and an improved accessible name (`"<label>, <kind>, <status>, select"` / `"...select to explore"`) so the same information reaches keyboard/screen-reader users.

## 4. Node-category differentiation (M2)

Traced to a real bug, not a design gap: `mapAdapter.ts`'s icon selection checked a name-substring heuristic (`libraryIconByLabel`, tuned for HTTP-client-library repos — matching words like "request"/"response"/"url") **before** the node's real, authoritative `kind`. On Flask, ordinary method names like `full_dispatch_request`, `process_response`, and `url_for` all matched that heuristic and collapsed onto the same generic icon, regardless of their actual kind. Fixed by reversing the priority: real `kind` now wins, the label heuristic is only a fallback for kinds with no dedicated icon. A visible, always-on kind label (`COMPONENT`, `CODE GROUP`, `CROSS CUTTING`, `EXTERNAL BOUNDARY`, etc.) was also added directly to each card — verified live against the real Flask map (screenshot `02-map-kind-labels-and-hint.jpg`).

## 5. Map overlap (M2)

Reproduced: two floating map overlays (`.obs-canvas__summary--floating`, the top-left orientation/summary text, and `.obs-rf-watermark`, the bottom-right "N areas · N links" stat) had no background and visually blended into node cards positioned behind them. Both now render on a solid backdrop chip, so they read as their own layer above the map rather than overlapping node content. No layout-algorithm change was made or needed.

## 6. "Claim" → "Architectural statement" (M3)

Traced to a specific, freshly-introduced source: the always-visible legend added in the prior remediation round read "The model proposes architectural **claims**." User-facing copy in `ArchitecturalExplanationPanel.tsx` now reads "architectural **statements**" throughout (legend intro, empty state). Internal/domain types (`ArchitecturalClaim`, `ClaimProposal`, the `ClaimCard.tsx` component name) were left untouched, per instruction — this was a UI-copy change only, with no semantic change to the underlying research vocabulary.

## 7. SUPPORTED copy (B2)

The shared legend (from the prior round) was not sufficient — meaning has to travel with the badge itself. Every individual `SUPPORTED` badge now carries an always-visible caption directly beneath it: *"Verified from available source evidence."* Not a tooltip, not gated behind hover or expansion (`claimStatus.ts`, `claimBadgeShortCopy`). Verified live on every claim in a real Flask explanation (screenshot `03-status-captions-on-claims.jpg`).

## 8. INSUFFICIENT EVIDENCE copy (B3)

Same mechanism, same file: *"Not verified from the available source evidence — this does not mean the statement is false."* No INSUFFICIENT EVIDENCE claim occurred naturally in this round's live re-analysis (all claims were SUPPORTED, consistent with prior rounds); the copy itself is covered by a passing unit test asserting the exact caption text renders whenever the status occurs.

## 9. Model-vs-verifier communication (F06 follow-up)

The existing always-visible legend ("The model proposes architectural statements. Laura's then independently checks each one against recovered source evidence — the model never decides what is true.") already sits directly above every claim list, unconditionally rendered before data even loads. Combined with the new per-claim captions (§7–8), the epistemic distinction is now reinforced at both the section level and the individual-claim level. No further duplication was added — a third repetition at this density was judged more likely to add clutter than clarity; this is a candidate for real human re-evaluation rather than another blind addition.

## 10. Doc Studio (M5)

Audited `DocsStudio.tsx`'s actual `RepositoryDocsPortal`. Two changes: (1) a plain-language intro sentence now appears at the top — *"Pick a component on the left to read its plain-language documentation and dependencies; its exact source code is available underneath, collapsed by default"* — where previously there was none; (2) the **Source** section (previously an always-open `<pre>` code block) is now a `<details>` disclosure, collapsed by default — Documentation and Dependencies stay open and lead. No source-backed detail was removed, only made progressive. Verified live (screenshot `04-docs-studio-collapsed-source.jpg`).

## 11. "Play guide" — exact identification (M6)

Per instruction, identified before touching anything: the control is **"Take the Tour"** (`Dashboard.tsx`, legacy `/legacy` workspace, `Compass` icon), which triggers `Narrator.tsx`. Root cause, traced in code: `Narrator` depends on `useArchOverview`/`useSubsystems`/`useViolations` — a separate, legacy API surface this tour has always depended on — and previously returned `null` (rendering nothing at all) whenever that data came back empty, which it reliably does for any analysis produced by the current Observatory/architecture-map pipeline. Classification: **(A) actually broken** — a dead click with zero feedback. Fix: an honest, dismissible in-panel message ("The tour needs an older analysis summary that this run doesn't have, so there's nothing to walk through right now.") instead of silence. Rebuilding the tour on the current architecture-map data was judged out of this remediation's bounded scope.

## 12. Consistent Back/breadcrumb navigation (M4)

Audited every place the learned top-left Back pattern could disappear. Found and fixed one clear case: the full-screen source-code viewer's exit control was a top-right **"Close"** button — different position, wording, and style from the top-left arrow used throughout the rest of the map/entity flow. It's now a top-left **"← Back"** button in the same position/style. Fixing it also surfaced a latent, previously-harmless bug: the button set `mainSurface` to `'dashboard'` (a legacy-only surface Observatory never renders) instead of `'architecture'` — now corrected. Verified live: Back returns to the exact prior evidence-chain state, not a blank or unrelated screen. Doc Studio's own "← Back to Observatory" was already consistent and needed no change.

## 13. Tests

| | Frontend before | Frontend after |
|---|---|---|
| Test files | 11 | 14 |
| Tests | 67 | 79 |

4 new frontend test files (`LensNode.test.tsx`, `mapAdapter.test.ts`, `FolderBrowserDialog.test.tsx`, `Narrator.test.tsx`) plus 2 new tests added to `ArchitecturalExplanationPanel.test.tsx`. 6 new backend tests (`test_browse.py`). **All passing.** `tsc --noEmit`, `eslint .`, and `npm run build` all clean. Full backend pytest suite passing with no regressions.

## 14. Task-vs-product alignment assessment

Audited `PARTICIPANT_TASKS.md` Task B ("Somewhere in here, Flask has to handle an incoming web request... see if you can find the part of the code responsible for that") against what happened. The task wording itself is open-ended by design and not ambiguous on its own terms. The observed difficulty traces most directly to **(B) map interaction discoverability**: the session record shows no map click was ever attempted, meaning the participant never got far enough to test whether map semantics (A), layout (C), or the task wording (D) were separately also obstacles — that threshold question wasn't reached. **The task wording was not changed.** Recommendation: re-run this same, unmodified task against the remediated build (B1/M2 fixes) before considering any instrument change — if map interaction is now discoverable and the task still fails, that would be new, separable evidence about (A)/(B)/(D) rather than a re-confirmation of the same root cause.

## 15. Live replay result

Repository: pinned `pallets/flask` (same commit used throughout this program). Full path replayed live through the actual running app: repository selection → map → node interaction/categorization → `Flask` class → `full_dispatch_request` → Architectural Explanation → SUPPORTED statement with its always-visible caption → evidence chain (human-readable, Technical details collapsed) → Open source → persistent highlight → **Back** (not Close) → Doc Studio. All items listed in `result.json`'s `live_replay.verified_live` were confirmed working exactly as designed. One item — the folder browser's live network call — hit an environment-specific backend-restart issue (see §16); the endpoint itself was independently verified against a fresh, isolated instance instead.

## 16. Environment note (folder browser live verification)

The long-running dev backend on port 8000 did not pick up the new `/api/fs/browse-directories` route within this session despite running with `--reload`. Diagnosis attempted: the owning process could be located via `Get-NetTCPConnection` but not consistently confirmed terminated via `Get-Process`/`Stop-Process`/`taskkill` (it appears to be a stale/orphaned process from an earlier session, outside this session's clean control). Rather than continue destructive process manipulation against a process this session couldn't reliably identify, the new endpoint was instead verified end-to-end against a freshly-started, correctly-configured, isolated backend instance (real directory listings returned). The `FolderBrowserDialog` UI itself was exercised live against the actual app and showed an honest "Not Found" error against the stale backend — the intended, designed behavior for a real failure, not a defect. **Recommendation**: run a normal `stop-lauras.ps1` / `start-lauras.ps1` cycle before the next session; this should resolve the stale-process condition trivially in a clean shell.

## 17. Production commits

See the final chat response for the commit hash(es).

## 18. Confirmations

- **No research semantics changed.** SUPPORTED/INSUFFICIENT EVIDENCE/CONTRADICTED definitions, the verifier, and relation semantics are untouched. No backend logic beyond the new, additive, read-only browse endpoint was modified.
- **Formal study untouched.** Nothing under `docs/usability-dry-run/` (the protocol documents themselves) or any A/B/C study material was modified.
- **Internal/domain types unchanged.** `ArchitecturalClaim`, `ClaimProposal`, and `ClaimCard.tsx`'s name were left exactly as they were — only user-facing copy changed.

## 19. Whether Participant #2 should run on this build

Recommend **yes, after review** — all eight findings (2 BLOCKER, 6 MAJOR) from Participant #1 are addressed and live-verified (with the one noted, non-code environment caveat in §16, itself independently verified). This is an expert assessment based on acting through the real UI as Participant #1 would, not a guarantee of Participant #2's actual behavior — real human evidence should continue to drive any further changes.

---

## Artifact paths

- `qa-audit/participant-1-formative-remediation/REPORT.md` (this file)
- `qa-audit/participant-1-formative-remediation/OVERVIEW.md` (de-identified summary)
- `qa-audit/participant-1-formative-remediation/result.json`
- `qa-audit/participant-1-formative-remediation/screenshots/` (4 images)

**STOP FOR REVIEW.** Participant #2 not started. Formal A/B/C protocol not modified.
