# Phase 2 Performance Results

Times are end-user observations from the real Vite frontend and FastAPI backend on localhost. No averages are used to conceal outliers. The specification names NFR-01 and NFR-03 through NFR-12 but omits their actual measurable targets, so target comparison is **NOT TESTABLE**.

## Primary repositories — Chromium 1440 × 900

| Fixture | Initial load | Submission acknowledgement | WebSocket pipeline completion | Graph render | Docs UI open | Docs generation | Search |
|---|---:|---:|---:|---|---:|---|---|
| Python | 1,876 ms | 580 ms | 126 ms reported in captured completion frame | Never rendered within observation window | 1,753 ms | Outline exceeded 20 s; Markdown still loading after another 2.5 s | No response within 30 s in the critical run |
| TypeScript | 2,483 ms | 800 ms | Completion frame received | Never rendered | 1,908 ms | Outline exceeded 20 s; Markdown still loading | No response within 30 s |
| Mixed | 2,547 ms | 784 ms | Completion frame received | Never rendered | 1,825 ms | Outline exceeded 20 s; Markdown still loading | No response within 30 s |

The harness waited seven seconds after acknowledgement before graph inspection. Analysis WebSockets had already emitted `status_update`, completed status, and `pipeline_complete`; graph absence is therefore not attributable to waiting for the analysis job.

## Semantic-search distribution

Twenty visible-UI submissions were measured with a five-second bounded observation per request. All 20 produced no HTTP response in that window and left the submit button disabled.

- Minimum observed timeout: 5,002 ms
- Maximum observed timeout: 5,039 ms
- Separately observed critical-run timeout: over 30,000 ms
- Top-five success: 0/20

The five-second values are censoring bounds, not successful response times. The true latency was longer.

## Browser and viewport observations

| Browser / viewport | Initial load | Submission acknowledgement | Graph at +7 s |
|---|---:|---:|---|
| Chromium 1280 × 720 | 2,079 ms | 789 ms | 0 nodes / 0 edges |
| Chromium 768 × 1024 | 2,246 ms | 730 ms | 0 nodes / 0 edges |
| Chromium 390 × 844 | 2,134 ms | 623 ms | 0 nodes / 0 edges |
| Firefox 1440 × 900 | 3,836 ms | 741 ms | 0 nodes / 0 edges |
| WebKit 1440 × 900 | 2,065 ms | 850 ms | 0 nodes / 0 edges |

## Evidence

- `logs/docs-chromium-1440x900-*.json`
- `logs/semantic-20.json`
- `logs/matrix-*.json`
- `traces/chromium-1440x900-*.zip`
- `traces/semantic-20.zip`
