# Live forensic audit — design-system integration branch

- **Branch:** `feature/design-system-integration`
- **Commit:** `7e9f073` (clean working tree; only untracked `qa-audit/` content)
- **Stack under audit:** refurbished backend (`uvicorn syntax_tree_refurbished.main:app`, port 8000) + `syntax-tree-ui` Vite dev server (port 5173), analyzed repository = pinned Flask (`lauras-d4-comparison/research/real-repo-pilot/repos/r2-medium/source/src/flask`)
- **All screenshots** below are full-window captures of the real running product against real analysis data. No fixture pages, previews, or prototypes were used as visual evidence.
- Capture caveat: the audit machine runs Windows display scaling with Chrome page zoom at 80% (CSS viewport ≈1600×677 in a ≈1366×768-class physical window). Screenshots are unedited.

## 1. Screenshots

`qa-audit/design-system-live-review/screenshots/`

| File | State |
|---|---|
| 01-landing-before-analysis.png | Real `/` before any run |
| 02-analysis-in-progress.png | See note below |
| 03-architecture-overview.png | Overview map after Flask analysis |
| 04-region-or-cluster-selected.png | Structural cluster 1 selected (region expanded behind) |
| 05-entered-scope.png | Entered `sansio` scope (breadcrumb `flask › sansio`) |
| 06-module-or-entity-selected.png | `sansio/app.py` module selected |
| 07-ai-settings.png | Settings dialog (Appearance + AI) |
| 08-ai-generation-before-click.png | Cluster inspector with Generate interpretation |
| 09-ai-generation-result-or-error.png | Result with backend up, no model configured |
| 09b-ai-502-masked-as-no-model.png | Result with backend DOWN (real 502) — same message |
| 10-evidence-source.png | Question-lens evidence chain + source pane |
| 11-doc-studio.png | Doc Studio on this branch |
| 12-1366x768.png | ≈1366×768-class window capture |
| 13-map-plus-outline.png | Map · Outline "Both" view, synchronized selection |

**02 note:** three consecutive real Flask analyses each completed in under ~2 seconds on this machine — faster than a CDP screenshot round-trip — so the in-progress panel could not be photographed. The progress panel (`ObservatoryProgressPanel`) exists on the runtime path and 02 shows the state immediately after (freshly created run id visible in the run chip). This is an honest capture limitation, not a missing feature.

## 2. Live route / component map (traced at runtime)

| Condition | Component rendered |
|---|---|
| `/` with `analysisStatus !== 'completed'` | `ObservatoryEntry` (`src/features/observatory/ObservatoryEntry.tsx`) via `App.tsx` |
| `/` after analysis completes (or `/docs`) | `ObservatoryShell` → `ArchitectureGraphOverview` + `ArchitectureGraphInspector` |
| `/docs` | `ObservatoryShell` → `DocsStudio` |
| `/legacy` | `LegacyWorkspace` (old TopBar/MainArea — deprecated) |
| `/__observatory-preview*`, `/__v2-preview` | fixture/dev surfaces (not audited as evidence) |

DOM proof at runtime (JS evaluated in the live page at `/`): `#root` first child class = `observatory-entry`; `<h1>` text = **"Understand an unfamiliar codebase."**; brand = "Laura's"; CTA = "Browse repository"; cards = Architecture / Explore / Verify; `<html data-theme="dark">`. Screenshot 01 corroborates.

## 3. Landing-page enquiry — root cause

1. **What route renders `/`?** `App.tsx` — no router; `window.location.pathname` switch. `/` with no completed run renders `ObservatoryEntry`.
2. **Component mounted before a run exists:** `ObservatoryEntry` — confirmed in the live DOM.
3. **Is ObservatoryEntry.tsx on the runtime path?** YES.
4. **Proof:** screenshot 01 + DOM dump above (headline, cards, CTA all present).
5/6. **Multiple landing implementations exist:** `ObservatoryEntry` (live), `WelcomeScreen` (legacy `/legacy` only), and — critically — a **second full checkout of the product** at `C:\Users\LENOVO T14\Development\lauras-product-end-user-acceptance` (branch `product/end-user-acceptance`, HEAD `ff0f0be`, 158 commits — predates both this branch's commits). Its `ObservatoryEntry.tsx` still says **"What repo do you want to understand?"** and has no ThemeToggle.
7. **Did previous work modify a non-live component?** NO — the modified component is the live one **in this repository**. The most probable root cause of the owner's report is that they ran (or had open) the *acceptance-workspace checkout*, which contains the pre-redesign landing; their IDE session shows that workspace's docs open (`lauras-product-end-user-acceptance/docs/usability-dry-run/FACILITATOR_GUIDE.md`), and a stale browser tab or the other checkout's dev server/`dist` build would show the old landing verbatim. A hard-refresh caveat (Vite HMR staleness) is a secondary possibility but could not account for a wholly old landing.
8. **Live vs `screenshots/dark/Landing - Dark.png`:**

| Target element | Live | Verdict |
|---|---|---|
| Laura's wordmark (git-branch mark) | present, top-left | PASS |
| Theme controls (sun/moon/system) | present, top-right | PASS |
| Settings | present, top-right | PASS |
| "Understand an unfamiliar codebase." | exact | PASS |
| Browse repository as single primary CTA | present, but a second "Browse…" button sits inside the path row, and the primary CTA is disabled until a path is entered (target shows one always-active CTA) | PARTIAL |
| No-AI explanation beside CTA | present ("Source analysis runs entirely without AI…") but placed above the cards, not beside the CTA | PARTIAL |
| Architecture / Explore / Verify cards | present, exact copy | PASS |
| Recent projects only when history exists | recent chips render only from real localStorage history — but the same repo appears twice (`src/flask` duplicated) because path-string variants are not normalized | PARTIAL |
| Provenance/epistemic strip | not implemented on landing | NOT PRESENT (was never claimed) |
| Analysis replacing lower landing content in place | progress panel renders below the hero on the same screen | PASS (by code path; too fast to photograph) |

## 4. Functional walkthrough (real user, real data)

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | Open app | PASS | Redesigned landing (01) |
| 2 | Choose Flask repository | PASS | Path entry + recents; duplicate `src/flask` recent chips (minor defect) |
| 3 | Run analysis | PASS | run ids `af7282ff…`, `3205f015…`, `7b8840a5…` created live |
| 4 | Wait for completion | PASS | < ~2 s |
| 5 | Inspect architecture overview | PASS | 03: regions with member chips, real counts line, LOD badge, controls |
| 6 | Expand a region | PASS | Literal containment: cluster + Ungrouped inside the region |
| 7 | Enter a region | PASS | 05: breadcrumb `flask › sansio`, scoped canvas, Back pops one level |
| 8 | Select a module/entity | PASS | 06: MODULE panel (name, cluster, origin) |
| 9 | Inspect relationships | PARTIAL | Region/cluster relation kinds + counts shown; but the cluster panel says "No aggregate relation crosses this boundary in this run" directly under "Boundary relations 3" — the boundary relations are real but not materialized as cluster-level aggregate edges, and the copy does not explain that (reads as a contradiction) |
| 10 | Generate architectural explanation with configured AI | NOT PRESENT (on the live graph path) | No AI is configured on this machine (provider off). More fundamentally: from the graph-first surface there is **no route to the Architectural-statements/explanation panel at all** — `VoiceRail` (which hosts it) renders only when `isArchitectureGraph` is false, which never happens during normal graph navigation. Statements are reachable only via question-lens answers, saved lenses, or deep links |
| 11 | Inspect support badges | PARTIAL | "verified · 77% confidence · 1 evidence" chips appear on the real question-lens answer; StatementCard SUPPORTED/INSUFFICIENT EVIDENCE cards unreachable from the live path (see 10) |
| 12 | Expand evidence | PASS | Question lens → numbered EVIDENCE CHAIN (`app.py:562-588 · Primary`) |
| 13 | Open exact source | PARTIAL | Source pane opens on the dark code surface, but shows **lines 1–8, not the 562–588 highlight** — the pane does not scroll to/reveal the active evidence span (violates V-1 "the source pane opens on that item's highlight") |
| 14 | Go to Doc Studio | PASS | 11 — but the "Refresh" button overlaps the description text, and Doc Studio does not carry the redesigned shell (no top bar/wordmark/theme control) |
| 15 | Generate documentation with AI | NOT PRESENT | This branch has **no Doc Studio generation UI** (see §8); backend `/api/docs/generate` exists but degrades to `{"generated": false, "message": "No live LLM configured…"}` |
| 16 | Navigate evidence from generated docs | NOT PRESENT | No generated docs exist |
| 17 | Return to Architecture | PASS | Map restored with run context |
| 18 | Search for cli | PASS | `cli` → `cli.py — module · Repository root files`; selecting expands ancestors, selects it, inspector syncs |
| 19 | Switch theme | PASS | Light ↔ Dark toggles `data-theme` live; whole shell re-themes |
| 20 | Return to landing / choose another repository | PASS | "Analyze another repository" resets to landing; re-analysis works |

## 5–6. The 502: exact reproduction and cause

**No code path in this product emits 502.** `grep -rn "502"` across the backend source, `vite.config.ts` and the API client finds nothing; the backend maps provider failure to **503** (`architectural_explanation.py`), cluster interpretation catches all generation errors and returns **200 `status:"unavailable"`**, and docs generation returns **200 `generated:false`**.

**Reproduction (live):** stop the backend process, then perform any AI action through the frontend origin:

- Frontend action: cluster inspector → *Generate interpretation* (equivalently any `/api/*` request)
- Request: `POST http://127.0.0.1:5173/api/architecture-graph/clusters/architecture-cluster:4d2227df4f3069d16c8e7390/interpretation` (no payload)
- Response: **`502 Bad Gateway`, empty body** — emitted by the **Vite dev-server proxy** (`vite.config.ts` proxies `/api` → `http://localhost:8000`; connection refused → http-proxy 502)
- Backend route (when up): `api/routes/cluster_interpretation.py::post_cluster_interpretation`
- Backend log: no exception, no crash in the entire session — the backend served every request 200 until it was deliberately stopped
- Upstream provider: never contacted (no provider configured); provider = `off`, model empty, base URL empty, credential present: **NO**
- With the backend up, the same click returns 200/"unavailable" and the UI shows "No model configured. Analysis is unaffected." (09)

**Conclusion:** the owner's 502 means **the backend at :8000 was not running (or not reachable) at the moment they clicked the AI action**. Every AI click while the backend is down produces exactly `HTTP 502 Bad Gateway`.

**Aggravating UI defect (09b):** with the backend down, the cluster-interpretation UI swallows the 502 in a catch-all and displays *"No model configured. Analysis is unaffected."* — a false statement while the whole API is unreachable. The failure is indistinguishable from the legitimate no-model state, which is plausibly why the product "did not feel fully functional" without an obvious error.

## 7. AI surface / provider matrix (current runtime)

| Surface | Frontend action | Backend endpoint | Provider-resolution path | Works live? | Actual result |
|---|---|---|---|---|---|
| Cluster AI interpretation | Inspector → Generate interpretation | `POST /api/architecture-graph/clusters/{id}/interpretation` | `arch_explanation_llm_*` (Settings › AI) | YES (degrades) | 200 `status:"unavailable"` → "No model configured. Analysis is unaffected." |
| Architectural explanation | VoiceRail → "Architectural statements" — **unreachable from the live graph surface** | `POST /api/entities/{id}/claims` | `arch_explanation_llm_*` (Settings › AI); provider-unreachable → 503 | UNREACHABLE via UI; endpoint live | Not exercisable by a real user on the graph path |
| Question dock ("Ask about this architecture…") | Submit question | `POST /api/query` | Deterministic (no LLM involved) | YES | Real source-backed citations returned |
| Doc Studio generation | **No UI action on this branch** | `POST /api/docs/plan`, `POST /api/docs/generate` (backend has them) | **`make_live_model` — the LEGACY `llm` config (Blackbox-family), NOT Settings › AI** | Endpoint degrades (200, `generated:false`) | "No live LLM configured. Cannot generate documentation." |

**Provider-contract violations (reviewed contract: None · OpenAI · OpenRouter, one Settings › AI surface governing all AI):**
- The live Settings provider dropdown offers **Disabled / OpenAI / OpenRouter / Blackbox** — the legacy Blackbox option is still exposed (`src/features/settings/types.ts::PROVIDER_OPTIONS`).
- The backend keeps a **second, independent provider system**: `docs.py::_model` resolves via `make_live_model(settings)` (legacy `llm` config; `/api/health` reports its default model as `blackboxai/anthropic/claude-sonnet-4.6`), so Doc Studio generation would NOT be governed by Settings › AI. The one-configuration-surface contract is **not obeyed** by the current runtime.

## 8. Is 21f5718 in this branch?

```
git merge-base --is-ancestor 21f5718 HEAD   →  NOT an ancestor (exit 1)
git branch -a --contains 21f5718            →  feature/llm-documentation only
```

(`git log --oneline --all --contains 21f5718` is not valid git syntax on this machine; `git branch --contains` was used instead.)

**The evidence-grounded Doc Studio generation (21f5718) is NOT present in `feature/design-system-integration`.** It exists only on `feature/llm-documentation` (adds `docs_generation` DTOs/routes, `component_doc_generator`, `GeneratedDocs.tsx`, and DocsStudio wiring). This branch's Doc Studio is read-only: the only frontend calls are `GET /docs/hierarchy` and `GET /docs/components/{id}`; runtime inspection of the Doc Studio DOM found **no Generate action** (the only "generate" strings are Flask's own `generate`/`generator` functions in the component tree).

## 9. Visual comparison against the reviewed design

| Target | Live surface | Assessment |
|---|---|---|
| Landing - Dark | 01 | **Close.** Composition, copy, cards, controls match; differences: CTA disabled-until-path + second Browse… button, note position, duplicate recent chips. |
| 2 - Overview Map - Dark | 03/12 | **Directionally close, much sparser.** Warm-charcoal canvas, region containers with header band + monospace names + member chips, dashed calls edge with count, LOD badge, floating control cluster, real-counts summary all match the language. Differences: Flask's real hierarchy is 3 shallow regions (target shows deep nesting — data-shape difference, honest); collapsed region interiors are still emptier than target; minimap bottom-right vs target bottom-left; no cluster-level cross-edges (backend produced none for Flask). |
| 3 - Region selected | 04 | **Partial.** Selection ring + dimming to ~22% + inspector facts match; the inspector's per-relation rows ("38 imports from controllers"-style) appear only when aggregate edges touch the selection — for the Flask cluster it shows the confusing "no aggregate relation crosses this boundary" line; no "Enter" CTA in the region inspector footer parity. |
| 5 - Cluster with AI interpretation | 04/08/09 | **Close for the empty/unavailable states** (iris card, AI INTERPRETATION label, spec copy). The generated-interpretation state (iris banner on the canvas cluster itself, 19.10) could not be verified — no model configured; the banner-on-cluster treatment is not implemented (interpretation renders only in the inspector). |
| 6 - Group drill-down graph | 05 | **Partial.** Entering shows member modules as chips, but as a sparse vertical scatter with **no internal relation edges drawn between members** (the target's core promise); Flask's `sansio` scope showed "Relations 0" because scoping drops region-internal aggregates. |
| 7 - Entity focus graph | — | **Not reachable in the live product.** The incoming ▸ entity ▸ outgoing surface + statements strip exist in code but only render via `ArchitectureMapCanvas`/`VoiceRail`, which the graph-first shell never routes to during normal navigation. Module selection shows a facts panel instead. Major functional/composition gap vs the target. |
| Evidence - Source - Dark | 10 | **Partial.** Statement header chip (verified), numbered evidence chain, dark code pane match the language; but the source pane does not scroll to the highlighted lines, and the full statement-card header band of the target (verdict + statement + counts) is only approximated by the question-lens header. |
| 9 - 1366x768 | 12 | Map remains dominant with inspector open; controls float. Acceptable. |
| 10 - Map plus Outline | 13 | **Close.** Side-by-side Map + Outline, same scope/selection (SELECTED chip mirrored), aggregate relations listed; outline lacks per-row recursive counts column of the target. |

**Stale/legacy UI still visible:** Doc Studio page (pre-redesign shell, overlapping Refresh button); Blackbox in Settings; `/legacy` route still ships. **Misleading epistemic treatment found:** the 502-masked-as-"No model configured" message (09b) — a system failure presented as a benign configuration state.

## 10. Blockers / major defects (current)

1. **B1 — 502 on AI actions whenever the backend is down**, and the frontend masks it as "No model configured. Analysis is unaffected." (09b). No health/backend-unreachable state exists in the shell.
2. **B2 — Doc Studio generation absent from this branch** (21f5718 unmerged), while the backend's docs generation resolves providers through the **legacy Blackbox-family config**, violating the one-AI-configuration contract.
3. **B3 — Blackbox still exposed** in the live Settings provider dropdown (contract: None · OpenAI · OpenRouter).
4. **B4 — Entity Focus + Architectural statements are unreachable** from the live graph-first navigation; the reviewed Entity Focus target (screenshot 7) is effectively not shipped as a user-reachable surface.
5. **B5 — Evidence source pane does not scroll to the highlighted span** (V-1 violation).
6. **B6 — Entered-scope graphs draw no member-to-member relation edges** (drill-down target's core content), and scoping can show "Relations 0" for a region with real internal relations.
7. **B7 — Doc Studio page not restyled** (old shell, overlapping header controls).
8. Minor: duplicate recent-repo chips; cluster panel's "no aggregate relation crosses this boundary" wording beside a non-zero boundary count; "3 child areas" wording survives in the question dock; landing CTA disabled-until-path vs target.

## 11. Inaccurate claims in the previous READY_FOR_REVIEW report

1. "Entity focus keeps the incoming → entity → outgoing layout … with an Architectural-statements strip beneath the graph" — **overstated**: the code exists, but the surface is unreachable through real product navigation; the demonstrations were fixture-based, contrary to the spirit of a production claim.
2. "Evidence: … numbered evidence chain … and the tinted band + solid 3px edge highlight" — the chain is real, but the claim omitted that **the source pane does not navigate to the highlight**, so the end-to-end "exact source" promise fails.
3. "Group/entity/evidence brought toward the reviewed screenshots" — the group drill-down does **not** draw in-scope member edges, a core element of the reviewed target; that gap was not called out.
4. The walkthrough summary implied all major flows were verified end-to-end in real mode; the evidence surface had been visually verified **in fixture mode**, and the real-mode statement-card path was never exercised (it cannot be).
5. The epistemic-language claim was too strong: a backend outage is presented as a benign AI-availability state (misleading copy discovered only in this audit).
6. The report did not flag the standing provider-contract violations (Blackbox option; docs generation on the legacy provider path) even though the design package explicitly retires them — I treated them as out of scope without saying so.

Accurate prior claims re-confirmed live at 7e9f073: the redesigned landing IS the live `/`; map/Outline/controls/theme/search/one-Back all function against real Flask data; suite/lint/build pass.

## Classification

**PRODUCT_VISUALLY_CLOSE_BUT_FUNCTIONALLY_BROKEN**

Rationale: the shipped surfaces at 7e9f073 genuinely carry the reviewed visual language (landing, overview map, outline, controls, theming, settings) against real data — but the product breaks the moment its seams are exercised: any AI action 502s (masked with false copy) whenever the backend isn't up, the reviewed Entity-Focus/statements surface is unreachable, exact-source navigation doesn't land on the evidence, Doc Studio generation is absent from this branch and wired to a retired provider system on the backend, and the drill-down graph lacks its core relation content. The owner's three observations are all explained: (1) the unchanged landing they saw matches the sibling `lauras-product-end-user-acceptance` checkout (old code) rather than this branch's live route; (2) "not fully functional" matches B1/B4/B5/B6; (3) the HTTP 502 is the Vite proxy reporting a down backend, reproduced exactly.
