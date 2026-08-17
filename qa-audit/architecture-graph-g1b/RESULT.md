# Architecture Graph G1 Acceptance

## Accepted baseline

HEAD: 421ee94
Commit: Fix graph scope Back and accessible relations

## Automated validation

- Focused architecture-graph frontend tests: 6 passed
- Full frontend suite: 112 passed
- Frontend lint: passed
- Frontend production build: passed
- Backend architecture/grouping/relation regressions: 114 passed
- One existing FastAPI/Starlette deprecation warning was observed.

## Live validation

Validated with:
qa-audit/phase-2/fixtures/mixed-moderate

Confirmed:

- root Architecture Overview remained architecture-first;
- initial viewport behavior was acceptable at 1366x768 and 1280x720;
- Enter retained the architecture graph renderer in scoped structural views;
- Back returned directly to root;
- accessible tables exposed deterministic structural regions and aggregate relations independently of canvas collapse state.

## Small / flat validation

Fixture selected:
qa-audit/phase-2/fixtures/typescript-small

The live browser workflow failed before the analysis input became available.

No G1 product defect was identified.

Therefore small/flat live visual evidence was not captured. Existing deterministic transformation/layout tests remain the available evidence for this repository shape.

## Core E2E

Command:
npm run test:e2e:core-contract

Classification:
PRE_EXISTING_FAILURE

Two unrelated legacy/documentation-navigation failures remained:

- expected "Child component" documentation heading missing;
- expected "Open navigation" button missing.

These failures were not introduced by the architecture-graph G1 work.

## Final decision

G1 ACCEPTED.

The architecture-graph implementation is considered complete for this phase.

The missing small/flat screenshot is recorded as a validation limitation, not a successful live validation.

Deterministic relation clustering and AI semantic interpretation remain outside G1.
