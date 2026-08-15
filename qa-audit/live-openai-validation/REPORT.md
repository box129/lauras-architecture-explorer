# Real OpenAI Vertical-Slice Validation — Phase 3 Resume

**Date:** 2026-08-13
**Product commits in scope:** `d4ab177` (small-repository navigation / graceful legacy handling), `788c234` (cache generation-mode isolation / legacy-request isolation)
**Scope:** Validation only. No production code changed. Backend was not restarted; API key was never read, printed, or persisted.

## 1. Live runtime configuration confirmation

Read-only, immediately before Phase 3 resumed:

| Field | GET /api/settings/architectural-explanation | GET /api/health |
|---|---|---|
| enabled | `true` | `true` |
| configured | `true` | `true` |
| provider | `openai` | `openai` |
| model | `gpt-5.4-mini` | `gpt-5.4-mini` |
| credentials_present | `true` | `true` |

Notably, the **legacy** investigation provider was *also* genuinely configured with real credentials on this backend (`GET /api/health`: `llm.configured=true`, blackbox/openrouter keys present) — making this a meaningful live re-test of the legacy-traffic-isolation fix (§10), not a vacuous one.

## 2. Exact fixture and target

- Fixture: `research/provenance-evaluation/fixtures/python_app/`
- Target: `OrderService.create_order` (resolved real symbol id `symbol:5cc0ef1c4a8197ba85c52bb4`)
- Run: `run:f5276e1b50254d589490242d1ee7ec68`
- Navigation: entirely through the real browser UI — repository path entry → Build architecture map → map: `services` → `order_service.py` → `OrderService` → `create_order` → **Architectural Explanation**. No raw internal entity id was ever hand-typed.

## 3. Proof the real OpenAI proposer was invoked

- `POST /api/entities/{id}/architectural-explanation` → **HTTP 200**, wall-clock latency **4,788 ms** — consistent with a genuine external HTTPS round trip, not a local/fake/legacy stub (`NullClaimProposer`/provider-off returns near-instantly with zero claims, per the prior remediation's own regression tests).
- **Code-path proof:** `api/routes/architectural_explanation.py::_proposer()` returns `LLMClaimProposer(make_arch_explanation_model(...))` if and only if `settings.environment != "test"` **and** `settings.arch_explanation_llm_configured` is `True` — both independently confirmed true immediately beforehand (§1), and this session never injected a test/fake model. Given that runtime state, the responding proposer could not have been `NullClaimProposer`.
- All 4 returned claims are non-empty, reference real resolved relations, and their evidence lines match the ground-truth fixture exactly (§7) — content inconsistent with a static/template fallback.
- **Non-blocking product observation:** the development runtime caused duplicate architectural-explanation requests for one UI action. The validation uses the first response only. This does not affect deterministic verification or the PASS, but can duplicate external-provider usage/cost during development. (Detail: the backend access log shows the POST fired twice for this one click, from React `StrictMode` (`src/main.tsx`) double-invoking effects in the Vite dev server — absent in a production build. The second response is not counted as another validation sample; evidence below is from the first completed response only.)

## 4. Exact real ClaimProposal(s)

| Claim | Proposition | Verifier result |
|---|---|---|
| "create_order calls charge." | `direct_relation`: OrderService.create_order —calls→ PaymentService.charge | **supported** |
| "create_order calls save." | `direct_relation`: OrderService.create_order —calls→ OrderRepository.save | **supported** |
| "place_order reaches charge through a call path." | `reachability`: OrderController.place_order → OrderService.create_order → PaymentService.charge | **supported** |
| "place_order reaches save through a call path." | `reachability`: OrderController.place_order → OrderService.create_order → OrderRepository.save | **supported** |

Full structured payload: `raw-capture.json` → `explanationBody`; also mirrored in `result.json`.

## 5. Bounded-evidence compliance

- **Schema valid** — every proposal parsed into a well-formed `ClaimProposition`/`ArchitecturalClaim`.
- **Vocabulary** — only `direct_relation/calls` and `reachability/calls` were used, both within `ALLOWED_PROPOSITION_SHAPES`.
- **Entity membership** — every subject/object/path id independently resolved via `GET /api/runs/{run_id}/symbols` to exactly `OrderService.create_order`, `PaymentService.charge`, `OrderRepository.save`, `OrderController.place_order` — all within the 2-hop bounded neighborhood the proposer was shown. Zero out-of-scope ids.
- **No fabrication** — every cited relation is a real, `resolved` `ObservedProgramRelation`; every evidence source region, independently re-fetched via `GET /api/source-regions/{id}` (read-only, no new LLM call), resolves to real file/line/text.
- **Wording faithful** — all four statements were produced by the deterministic `render_proposition_statement()` function directly from the proposition's own fields, never raw LLM prose.

Zero bounded-evidence violations.

## 6. Deterministic verifier result per proposal

All four `support_status` values were computed by `core.models.provenance.verify_proposition` (via `claim_from_proposition`), which checks structured propositions against real, `resolution_status == "resolved"` relations only. `LLMClaimProposer`/`ClaimProposal` structurally cannot carry a support status — the LLM never determines SUPPORTED/INSUFFICIENT_EVIDENCE/CONTRADICTED. All 4: **supported**.

## 7. Controlled-ground-truth comparison

Against `research/provenance-evaluation/fixtures/ground_truth/claims.json`:

| Real claim | Matches ground truth | Evidence line match |
|---|---|---|
| create_order calls charge | **C2** (expected: supported) | `services/order_service.py:34` — exact match to C2-E1 |
| create_order calls save | **C3** (expected: supported) | `services/order_service.py:36` — exact match to C3-E1 |
| place_order reaches charge via create_order | **C5** (expected: supported) | Both hops (`order_controller.py:22`, `order_service.py:34`) — exact match to C5-E1/C5-E2 |
| place_order reaches save via create_order | **Not a partial match of C4.** C4's full claim requires a third, `operates_on` hop (OrderRepository.save operates_on Order), which is outside Laura's currently supported proposition vocabulary (`direct_relation/calls`, `direct_relation/inherits`, `reachability/calls` only) — C4 as stated could never be represented as a `ClaimProposal` at all. This is instead **one additional, independently source-verified, in-scope `calls`-reachability proposition** (OrderController.place_order → OrderService.create_order → OrderRepository.save) not represented among the 10 frozen ground-truth claims. | Both hops match real evidence lines also cited by C4 (C4-E1/C4-E2), but the proposition itself is a new, distinct, in-scope fact, not a subset of C4 |

No false controlled proposition (e.g. C10's contradicted inheritance claim, or any of C6–C9's insufficient-evidence claims) was proposed or mismarked — the proposer's bounded neighborhood for `create_order` never touched those entities/relations in the first place, so there was nothing spurious to reject. At least two expected controlled true claims (C2, C3) reached **supported**, plus one multi-hop match (C5) and one additional in-scope, independently source-verified true proposition outside the frozen claim set.

## 8. Supported / insufficient / contradicted counts

**Supported: 4 · Insufficient evidence: 0 · Contradicted: 0**

## 9. Source-navigation result

Claim card → evidence chain → **Open source** was exercised for the "create_order calls charge" claim. The screenshot (`06-source-navigation.png`) was captured while the Monaco pane was still mounting (tab header already shows the correct file, `order_service.py`). Independently, `GET /api/source-regions/region:9a7eb6822c877c903de9f0b2` (read-only, resolves data already produced by this run — no new LLM call) confirms exact line-level precision: `path=services/order_service.py, start_line=34, end_line=34, text="self.payment_service.charge(customer_id, amount)"` — the specific supporting statement, not just the file or a same-named symbol elsewhere. **Result: correct.**

## 10. Legacy-provider traffic result

**None observed**, despite the legacy provider being genuinely configured with real credentials (§1) — a live confirmation that commit `788c234`'s isolation fix holds under real conditions, not just in tests. `GET /api/architecture-map`'s own `metadata.llm_used` stayed `false` throughout; the backend access log for this session's full window contains zero ERROR/WARN/Exception lines and zero openrouter/blackbox references. The only external traffic observed was the OpenAI architectural-explanation call (fired twice — see §3's non-blocking product observation).

## 11. Generation latency

**4,788 ms** (first completed call).

## 12. Actual token usage

**Not exposed.** `LLMClaimProposer.propose_claims` discards `ModelReply.tokens_in`/`tokens_out` entirely — no token count reaches the API response or any log. Not estimated, per instructions.

## 13–16. Evidence artifacts

- Screenshots: `screenshots/01-openai-runtime-config.png` … `06-source-navigation.png` (no `07-insufficient-evidence.png` — none occurred naturally, per §14 below)
- Recording: `recording-real-openai-provenance-flow.webm`
- `result.json`, `REPORT.md` (this file), plus raw capture at `raw-capture.json`

## 14. Insufficient-evidence path

Live insufficient-evidence path not naturally exercised in this run. All 4 proposed claims were directly or transitively supported by real observed relations around `OrderService.create_order`. The model was not manipulated to force one.

## 17. Production code changed?

**No.**

## 18. Verdict

**PASS**

- Real OpenAI invoked (§3) ✓
- Real structured `ClaimProposal`s produced (§4) ✓
- Schema valid (§5) ✓
- Zero bounded-evidence violations (§5) ✓
- Deterministic verifier applied, LLM never determines support (§6) ✓
- At least one expected controlled true claim reached SUPPORTED — in fact two direct (C2, C3) plus one multi-hop (C5) (§7) ✓
- Evidence chain correct (§4, §7) ✓
- Source navigation correct (§9) ✓
- No credential leakage (key never read/printed/persisted) ✓
- No fake/mock/legacy provider involvement (§3, §10) ✓

## 19. New blocker discovered

**None.** One non-blocking product observation recorded (§3): the development runtime caused duplicate architectural-explanation requests for one UI action. This does not affect deterministic verification or the PASS, but can duplicate external-provider usage/cost during development.

---
STOP FOR REVIEW.
