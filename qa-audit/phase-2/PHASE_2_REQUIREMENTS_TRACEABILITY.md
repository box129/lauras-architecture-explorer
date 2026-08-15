# Phase 2 Requirements Traceability

## Numbered requirements

The supplied specification lists identifiers but still does not contain the original requirement text or acceptance criteria from Tables 3.3–3.6. Each numbered entry therefore receives exactly one status, **NOT TESTABLE**; assigning another status would invent the missing criteria.

| Requirement | Status | Reason |
|---|---|---|
| FR-01 | NOT TESTABLE | Acceptance criterion absent. |
| FR-02 | NOT TESTABLE | Acceptance criterion absent. |
| FR-03 | NOT TESTABLE | Acceptance criterion absent. |
| FR-04 | NOT TESTABLE | Acceptance criterion absent. |
| FR-05 | NOT TESTABLE | Acceptance criterion absent. |
| FR-06 | NOT TESTABLE | Acceptance criterion absent. |
| FR-07 | NOT TESTABLE | Acceptance criterion absent. |
| FR-08 | NOT TESTABLE | Acceptance criterion absent. |
| FR-09 | NOT TESTABLE | Acceptance criterion absent. |
| FR-10 | NOT TESTABLE | Acceptance criterion absent. |
| FR-11 | NOT TESTABLE | Acceptance criterion absent. |
| FR-13 | NOT TESTABLE | Acceptance criterion absent. |
| FR-14 | NOT TESTABLE | Acceptance criterion absent. |
| FR-15 | NOT TESTABLE | Acceptance criterion absent. |
| FR-16 | NOT TESTABLE | Acceptance criterion absent. |
| FR-17 | NOT TESTABLE | Acceptance criterion absent. |
| NFR-01 | NOT TESTABLE | Requirement and target absent. |
| NFR-03 | NOT TESTABLE | Requirement and target absent. |
| NFR-04 | NOT TESTABLE | Requirement and target absent. |
| NFR-05 | NOT TESTABLE | Requirement and target absent. |
| NFR-06 | NOT TESTABLE | Requirement and target absent. |
| NFR-07 | NOT TESTABLE | Requirement and target absent. |
| NFR-08 | NOT TESTABLE | Requirement and target absent. |
| NFR-09 | NOT TESTABLE | Requirement and target absent. |
| NFR-10 | NOT TESTABLE | Requirement and target absent. |
| NFR-11 | NOT TESTABLE | Requirement and target absent. |
| NFR-12 | NOT TESTABLE | Requirement and target absent. |

FR-12 and NFR-02 are explicitly undefined by the source report and are not requirements.

## Explicit required user journeys

These are independently testable statements in Section 6 of the supplied specification. Each receives exactly one status.

| Section | Requirement | Status | End-to-end evidence |
|---|---|---|---|
| 6.1 | Discover prerequisites | PASS | Root `README.md` contains runtimes and commands; inspected as a new user. |
| 6.1 | Create valid configuration without exposed credentials | PASS | Sanitized examples and missing-variable behavior were validated in Phase 1; Phase 2 loaded no provider credentials. |
| 6.1 | Install backend and frontend dependencies from a clean copy | BLOCKED | First clean attempt failed on external package resolution; retry exceeded 120 s during backend install. `logs/clean-setup-retry.log`. |
| 6.1 | Start required services | BLOCKED | Could not reach this step in the isolated clean copy; prepared workspace launched by the documented combined launcher. |
| 6.1 | Reach documented frontend URL | BLOCKED | Dependent on blocked isolated setup; prepared-workspace URL was reachable. |
| 6.1 | Confirm backend health | BLOCKED | Dependent on blocked isolated setup; prepared workspace returned HTTP 200 health. |
| 6.2 | Submit a valid local repository | PASS | All three fresh repositories received HTTP 200 analysis acknowledgement through the UI. |
| 6.2 | Receive visible analysis progress | PASS | Captured WebSocket status frames and visible orientation progress. |
| 6.2 | Receive a clear completion state | PARTIAL | WebSocket emits completion, but the UI does not proceed to a graph or explicit completed result. |
| 6.2 | Recover from invalid/missing path | PARTIAL | Clear live-region error and Reset appear, but two orientation requests return 409. |
| 6.2 | Avoid indefinite loading | FAIL | Query and documentation generation remain loading without a bounded user-facing failure. |
| 6.2 | Resubmit/reset without app restart | PARTIAL | Reset exists for invalid input; simultaneous duplicate valid submissions create distinct runs. |
| 6.3 | View non-empty repository graph | FAIL | 0 nodes and 0 edges across all fixtures/browsers. |
| 6.3 | Distinguish dependency relationships | BLOCKED | No edges rendered. |
| 6.3 | Zoom and pan | BLOCKED | No graph canvas content rendered. |
| 6.3 | Select a component | BLOCKED | No selectable nodes rendered. |
| 6.3 | Navigate from node to component information | BLOCKED | No node exists to start the journey. |
| 6.4 | Browse repository hierarchy | FAIL | Docs Studio exposes saved lenses and a generic outline, not repository hierarchy. |
| 6.4 | Open modules/classes/functions/methods | FAIL | Zero component hierarchy items exposed. |
| 6.4 | View generated documentation | FAIL | Generic onboarding placeholders are shown; backend Markdown generation remains loading. |
| 6.4 | View corresponding syntax-highlighted source | FAIL | No component source view is exposed in Docs Studio. |
| 6.4 | Refresh without stale/incorrect component info | BLOCKED | No component view exists; refresh loses active analysis and stays on `/docs` with generic content. |
| 6.5 | Submit natural-language query | PASS | Twenty non-empty queries were submitted through visible controls. |
| 6.5 | Receive ranked repository-specific results | FAIL | 0/20 responses within the bounded window; a separate request exceeded 30 s. |
| 6.5 | View relevance information | BLOCKED | No results returned. |
| 6.5 | Open corresponding component | BLOCKED | No result returned. |
| 6.5 | Meaningful empty and failure states | PARTIAL | Empty/whitespace causes no request, but stalled non-empty requests have no recoverable failure state. |
| 6.6 | Persist analyzed data through intended restarts | FAIL | Refresh/reopen lose active state; configured SQLite store is absent. Backend/service restart could not be fully isolated because of an orphaned listener. |
| 6.6 | Never show one repository's data as another | PASS | Switching to mixed after Python/TypeScript showed `mixed-moderate` and neither previous repository name. `logs/recovery-qa006.json`. |
