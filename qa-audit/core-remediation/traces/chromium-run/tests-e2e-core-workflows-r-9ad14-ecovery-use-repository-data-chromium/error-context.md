# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\core-workflows-real.spec.cjs >> [real backend] analysis, graph, docs, query, switching, and recovery use repository data
- Location: tests\e2e\core-workflows-real.spec.cjs:18:1

# Error details

```
Test timeout of 240000ms exceeded.
```

```
Error: page.waitForResponse: Test timeout of 240000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - button "Back to previous architecture lens" [ref=e7] [cursor=pointer]:
        - img [ref=e8]
      - navigation "Architecture breadcrumb" [ref=e10]:
        - generic [ref=e11]:
          - button "typescript-small" [ref=e12] [cursor=pointer]
          - img [ref=e13]
        - generic [ref=e16]: src/analyzer.ts
    - generic [ref=e17]: typescript-small
    - generic "Current analysis run" [ref=e19]:
      - button "Run Run run:5df6845aeae44df989dd755e640943b3 active run" [ref=e20] [cursor=pointer]:
        - generic [ref=e22]: Run Run run:5df6845aeae44df989dd755e640943b3
        - generic [ref=e23]: active run
        - img [ref=e24]
      - button "system-overview-architecture-map-v1" [ref=e26] [cursor=pointer]:
        - text: system-overview-architecture-map-v1
        - img [ref=e27]
  - generic [ref=e29]:
    - generic [ref=e30]:
      - main "Semantic architecture map" [ref=e31]:
        - generic:
          - generic:
            - generic: component
            - strong: src/analyzer.ts
            - generic: 2 child areas
          - paragraph: src/analyzer.ts defines RepositoryAnalyzer, analyze.
          - text: "0"
        - application [ref=e32]:
          - generic [ref=e34]:
            - generic:
              - generic:
                - group [ref=e35] [cursor=pointer]:
                  - button "RepositoryAnalyzer, verified" [ref=e36]:
                    - img [ref=e39]
                    - generic [ref=e44]:
                      - generic [ref=e46]: RepositoryAnalyzer
                      - generic [ref=e47]: class RepositoryAnalyzer in src/analyzer.ts:4-8.
                      - generic [ref=e48]:
                        - generic "Verified" [ref=e49]:
                          - generic [ref=e51]: Verified
                        - generic [ref=e52]: 1 evidence
                - group [ref=e54] [cursor=pointer]:
                  - button "analyze, verified" [ref=e55]:
                    - img [ref=e58]
                    - generic [ref=e62]:
                      - generic [ref=e64]: analyze
                      - generic [ref=e65]: "analyze(repository: string) in src/analyzer.ts:5-7."
                      - generic [ref=e66]:
                        - generic "Verified" [ref=e67]:
                          - generic [ref=e69]: Verified
                        - generic [ref=e70]: 1 evidence
          - generic "Control Panel" [ref=e72]:
            - button "Zoom In" [ref=e73] [cursor=pointer]:
              - img [ref=e74]
            - button "Zoom Out" [ref=e76] [cursor=pointer]:
              - img [ref=e77]
            - button "Fit View" [ref=e79] [cursor=pointer]:
              - img [ref=e80]
          - img "Mini Map" [ref=e83]
        - group [ref=e85]:
          - generic "View architecture as accessible tables" [ref=e86] [cursor=pointer]
        - generic [ref=e87]:
          - generic [ref=e90]: Verified
          - generic [ref=e93]: Insufficient
          - generic [ref=e96]: Candidate
          - generic [ref=e99]: Unsupported
          - generic [ref=e102]: Stale
          - generic [ref=e105]: Legacy
        - generic: 2 areas · 0 links
      - form "Ask architecture question" [ref=e106]:
        - img [ref=e107]
        - textbox "Architecture question" [ref=e110]:
          - /placeholder: Ask anything about src/analyzer.ts...
        - button "2 child areas" [ref=e112] [cursor=pointer]
        - generic [ref=e113]: Ctrl J
        - button "Submit question" [ref=e114] [cursor=pointer]:
          - img [ref=e115]
    - complementary "src/analyzer.ts explanation" [ref=e118]:
      - generic [ref=e119]:
        - generic [ref=e120]:
          - generic [ref=e121]:
            - heading "src/analyzer.ts" [level=2] [ref=e122]
            - generic [ref=e123]:
              - generic "Verified" [ref=e124]
              - text: Verified
          - paragraph [ref=e126]: src/analyzer.ts defines RepositoryAnalyzer, analyze.
          - generic [ref=e127]:
            - generic [ref=e128]: component
            - generic [ref=e129]: 98% confidence
            - generic [ref=e130]: 1 evidence
            - generic [ref=e131]: 2 child areas
            - generic [ref=e132]: fallback no llm
          - generic [ref=e133]:
            - button "Zoom into this area" [ref=e134] [cursor=pointer]:
              - img [ref=e135]
              - text: Zoom into this area
            - button "Back to parent" [ref=e138] [cursor=pointer]
            - button "Ask about this" [ref=e139] [cursor=pointer]:
              - img [ref=e140]
              - text: Ask about this
            - button "Copy node link" [ref=e142] [cursor=pointer]:
              - img [ref=e143]
              - text: Copy node link
            - button "View source proof" [ref=e146] [cursor=pointer]
            - button "Save Lens" [ref=e147] [cursor=pointer]:
              - img [ref=e148]
              - text: Save Lens
        - button "Close explanation" [ref=e150] [cursor=pointer]:
          - img [ref=e151]
      - tablist "Explanation modes" [ref=e154]:
        - tab "simple" [selected] [ref=e155] [cursor=pointer]
        - tab "technical" [ref=e156] [cursor=pointer]
        - tab "evidence" [ref=e157] [cursor=pointer]
      - generic [ref=e158]:
        - heading "Simple explanation" [level=3] [ref=e159]
        - paragraph [ref=e160]: src/analyzer.ts defines RepositoryAnalyzer, analyze.
      - generic [ref=e161]:
        - heading "Main responsibilities" [level=3] [ref=e162]
        - list [ref=e163]:
          - listitem [ref=e164]:
            - button "Open source proof for claim" [ref=e165] [cursor=pointer]:
              - generic "Verified" [ref=e166]
            - generic [ref=e168]:
              - text: class RepositoryAnalyzer
              - generic [ref=e169]: src/analyzer.ts:1
          - listitem [ref=e170]:
            - button "Open source proof for claim" [ref=e171] [cursor=pointer]:
              - generic "Verified" [ref=e172]
            - generic [ref=e174]:
              - text: "analyze(repository: string)"
              - generic [ref=e175]: src/analyzer.ts:1
      - generic [ref=e176]:
        - heading "Useful questions" [level=3] [ref=e177]
        - generic [ref=e178]:
          - button "What are the main entrypoints in typescript-small?" [ref=e179] [cursor=pointer]
          - button "How does typescript:src/analyzer.ts::RepositoryAnalyzer work?" [ref=e180] [cursor=pointer]
  - button "Lenses" [ref=e181] [cursor=pointer]:
    - img [ref=e182]
    - text: Lenses
```

# Test source

```ts
  9   | const requestedBrowser = process.env.SYNTAX_TREE_E2E_BROWSER || 'chromium';
  10  | const executablePath = installedBrowserExecutable(requestedBrowser);
  11  | 
  12  | test.use({
  13  |   baseURL: process.env.SYNTAX_TREE_FRONTEND_URL || 'http://127.0.0.1:5173',
  14  |   launchOptions: executablePath ? { executablePath } : {},
  15  |   viewport: { width: 1440, height: 900 },
  16  | });
  17  | 
  18  | test('[real backend] analysis, graph, docs, query, switching, and recovery use repository data', async ({ page }) => {
  19  |   test.setTimeout(240_000);
  20  |   expect(fs.existsSync(repositoryPath), `Repository fixture does not exist: ${repositoryPath}`).toBeTruthy();
  21  | 
  22  |   const evidence = { apiResponses: [], consoleErrors: [], consoleMessages: [], failedRequests: [], pageErrors: [], websocketEvents: [] };
  23  |   page.on('console', (message) => {
  24  |     const text = sanitizeText(message.text());
  25  |     evidence.consoleMessages.push({ type: message.type(), text });
  26  |     if (message.type() === 'error') evidence.consoleErrors.push(text);
  27  |   });
  28  |   page.on('pageerror', (error) => evidence.pageErrors.push(sanitizeText(String(error))));
  29  |   page.on('requestfailed', (request) => evidence.failedRequests.push(`${request.method()} ${safeRequestPath(request.url())}`));
  30  |   page.on('response', (response) => {
  31  |     const request = response.request();
  32  |     if (response.url().includes('/api/')) {
  33  |       evidence.apiResponses.push({ method: request.method(), path: safeRequestPath(response.url()), status: response.status() });
  34  |     }
  35  |   });
  36  | 
  37  |   page.on('websocket', (socket) => {
  38  |     if (!socket.url().includes('/api/ws/analyze/')) return;
  39  |     socket.on('framereceived', (frame) => {
  40  |       try {
  41  |         const packet = JSON.parse(frame.payload);
  42  |         if (packet?.event) evidence.websocketEvents.push(packet.event);
  43  |       } catch {
  44  |         evidence.websocketEvents.push('malformed');
  45  |       }
  46  |     });
  47  |   });
  48  | 
  49  |   await page.goto('/');
  50  |   await page.evaluate(() => window.localStorage.removeItem('syntax-tree.analysis-session.v1'));
  51  |   await page.reload();
  52  | 
  53  |   const startResponsePromise = page.waitForResponse(
  54  |     (response) => response.url().endsWith('/api/analyze') && response.request().method() === 'POST',
  55  |   );
  56  |   await page.getByRole('textbox', { name: 'Repository path' }).fill(repositoryPath);
  57  |   await page.getByRole('button', { name: 'Build architecture map' }).click();
  58  |   const startResponse = await startResponsePromise;
  59  |   expect(startResponse.status(), 'POST /api/analyze must accept the repository before WebSocket checks begin.').toBe(200);
  60  |   const startedRun = await startResponse.json();
  61  |   expect(startedRun.job_id).toBeTruthy();
  62  |   expect(startedRun.run_id).toBeTruthy();
  63  | 
  64  |   const architectureResponsePromise = page.waitForResponse(
  65  |     (response) => response.url().includes('/api/architecture-map') && response.request().method() === 'GET',
  66  |     { timeout: 180_000 },
  67  |   );
  68  | 
  69  |   await expect.poll(
  70  |     () => evidence.websocketEvents,
  71  |     { timeout: 180_000, message: 'The real analysis WebSocket should complete the pipeline.' },
  72  |   ).toContain('pipeline_complete');
  73  | 
  74  |   const architectureResponse = await architectureResponsePromise;
  75  |   expect(architectureResponse.status()).toBe(200);
  76  |   const architecture = await architectureResponse.json();
  77  |   expect(architecture.analysis_run_id).toBe(startedRun.run_id);
  78  |   expect(architecture.nodes.length).toBeGreaterThan(1);
  79  |   expect(architecture.edges.length).toBeGreaterThan(0);
  80  |   expect(
  81  |     architecture.nodes.some((node) => (node.primary_files || []).some((file) => /src\//.test(file.replaceAll('\\', '/')))),
  82  |   ).toBeTruthy();
  83  | 
  84  |   await expect(page.locator('.react-flow__node')).not.toHaveCount(0, { timeout: 30_000 });
  85  |   const visibleLabels = architecture.nodes.filter((node) => node.id !== architecture.root.id).map((node) => node.label);
  86  |   await expect(page.getByText(visibleLabels[0], { exact: true }).first()).toBeVisible();
  87  | 
  88  |   const viewportBeforeZoom = await viewportTransform(page);
  89  |   await page.locator('.react-flow__controls-zoomin').click();
  90  |   await expect.poll(() => viewportTransform(page), { timeout: 10_000 }).not.toBe(viewportBeforeZoom);
  91  |   const viewportBeforePan = await viewportTransform(page);
  92  |   const pane = page.locator('.react-flow__pane');
  93  |   const paneBox = await pane.boundingBox();
  94  |   expect(paneBox, 'The rendered graph must expose an interactive canvas pane.').not.toBeNull();
  95  |   await page.mouse.move(paneBox.x + 24, paneBox.y + 24);
  96  |   await page.mouse.down();
  97  |   await page.mouse.move(paneBox.x + 110, paneBox.y + 80, { steps: 6 });
  98  |   await page.mouse.up();
  99  |   await expect.poll(() => viewportTransform(page), { timeout: 10_000 }).not.toBe(viewportBeforePan);
  100 | 
  101 |   const graphNode = architecture.nodes.find((node) => node.id !== architecture.root.id);
  102 |   expect(graphNode, 'The graph must contain a selectable repository component.').toBeTruthy();
  103 |   const graphNodeElement = page.locator('.react-flow__node').filter({ hasText: graphNode.label }).first();
  104 |   await graphNodeElement.click({ modifiers: ['Alt'] });
  105 |   await expect(page.locator('.obs-voice__header h2')).toHaveText(graphNode.label);
  106 | 
  107 |   const drilldownNode = architecture.nodes.find((node) => node.id !== architecture.root.id && node.can_drilldown && node.children_count > 0);
  108 |   expect(drilldownNode, 'The source-derived graph must contain a navigable component.').toBeTruthy();
> 109 |   const childrenResponsePromise = page.waitForResponse(
      |                                        ^ Error: page.waitForResponse: Test timeout of 240000ms exceeded.
  110 |     (response) => response.url().includes('/children') && response.request().method() === 'GET',
  111 |   );
  112 |   await page.locator('.react-flow__node').filter({ hasText: drilldownNode.label }).first().click();
  113 |   const childrenResponse = await childrenResponsePromise;
  114 |   expect(childrenResponse.status()).toBe(200);
  115 |   const children = await childrenResponse.json();
  116 |   expect(children.analysis_run_id).toBe(architecture.analysis_run_id);
  117 |   await expect(page.locator('.obs-focal-header strong')).toHaveText(drilldownNode.label);
  118 |   await page.getByRole('button', { name: 'Back to previous architecture lens' }).click();
  119 |   await expect(page.locator('.obs-focal-header')).toHaveCount(0);
  120 | 
  121 |   const hierarchyResponsePromise = page.waitForResponse(
  122 |     (response) => response.url().includes('/api/docs/hierarchy') && response.request().method() === 'GET',
  123 |   );
  124 |   const detailResponsePromise = page.waitForResponse(
  125 |     (response) => response.url().includes('/api/docs/components/') && response.request().method() === 'GET',
  126 |   );
  127 |   await page.goto('/docs');
  128 |   const hierarchyResponse = await hierarchyResponsePromise;
  129 |   expect(hierarchyResponse.status()).toBe(200);
  130 |   const hierarchy = await hierarchyResponse.json();
  131 |   expect(hierarchy.analysis_run_id).toBe(architecture.analysis_run_id);
  132 |   expect(hierarchy.items.length).toBeGreaterThan(0);
  133 | 
  134 |   const detailResponse = await detailResponsePromise;
  135 |   expect(detailResponse.status()).toBe(200);
  136 |   const detail = await detailResponse.json();
  137 |   expect(detail.analysis_run_id).toBe(architecture.analysis_run_id);
  138 |   expect(detail.source.path).toBeTruthy();
  139 |   await expect(page.locator('.obs-docs-detail__header h2')).toHaveText(detail.name);
  140 |   await expect(page.locator('.obs-docs-source')).toContainText(detail.source.text.slice(0, 20));
  141 |   expect(new URL(page.url()).searchParams.get('component')).toBe(detail.id);
  142 |   await page.reload();
  143 |   await expect(page.locator('.obs-docs-detail__header h2')).toHaveText(detail.name, { timeout: 30_000 });
  144 |   await expect(page.locator('.obs-docs-source')).toContainText(detail.source.text.slice(0, 20));
  145 | 
  146 |   await page.getByRole('button', { name: /Back to Observatory/ }).click();
  147 |   await expect(page.getByRole('textbox', { name: 'Architecture question' })).toBeVisible();
  148 |   const queryResponsePromise = page.waitForResponse(
  149 |     (response) => response.url().includes('/api/query') && response.request().method() === 'POST',
  150 |   );
  151 |   await page.getByRole('textbox', { name: 'Architecture question' }).fill('Where is documentation generated and which source files prove it?');
  152 |   await page.getByRole('button', { name: 'Submit question' }).click();
  153 |   const queryResponse = await queryResponsePromise;
  154 |   expect(queryResponse.status()).toBe(200);
  155 |   const query = await queryResponse.json();
  156 |   expect(query.analysis_run_id).toBe(architecture.analysis_run_id);
  157 |   expect(query.visual_lenses.length).toBeGreaterThan(0);
  158 |   await expect(page.locator('.obs-ranked-lenses__item')).toHaveCount(Math.min(10, query.visual_lenses.length));
  159 | 
  160 |   const documentationLens = query.visual_lenses.find((lens) => /generateDocumentation|src[\\/]docs\.ts/i.test(JSON.stringify(lens)));
  161 |   expect(documentationLens, 'The ranked answer must include the fixture documentation generator or src/docs.ts.').toBeTruthy();
  162 |   const documentationResult = page.locator('.obs-ranked-lenses__item').filter({ hasText: documentationLens.title }).first();
  163 |   await documentationResult.click();
  164 |   await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  165 |   await expect(page.locator('.obs-understanding-section')).toContainText(/generateDocumentation|src[\\/]docs\.ts/i);
  166 |   await page.getByRole('button', { name: /View answer proof/ }).click();
  167 |   await expect(page.locator('[aria-label="Code Companion"]')).toContainText(/generateDocumentation|docs\.ts/i);
  168 | 
  169 |   const activeLensTitle = documentationLens.title;
  170 |   await page.reload();
  171 |   await expect(page.locator('.obs-understanding-pane__header h2')).toHaveText(activeLensTitle, { timeout: 30_000 });
  172 |   const persistedRun = await page.evaluate(() => {
  173 |     const raw = window.localStorage.getItem('syntax-tree.analysis-session.v1');
  174 |     return raw ? JSON.parse(raw).state.analysisRunId : null;
  175 |   });
  176 |   expect(persistedRun).toBe(architecture.analysis_run_id);
  177 | 
  178 |   await page.getByRole('button', { name: 'Close answer' }).click();
  179 |   await page.getByRole('button', { name: 'Open navigation' }).click();
  180 |   await page.getByRole('menuitem', { name: /Analyze another repository/ }).click();
  181 |   await expect(page.getByRole('textbox', { name: 'Repository path' })).toBeVisible();
  182 | 
  183 |   const alternateEventsStart = evidence.websocketEvents.length;
  184 |   const alternateStartPromise = page.waitForResponse(
  185 |     (response) => response.url().endsWith('/api/analyze') && response.request().method() === 'POST',
  186 |   );
  187 |   await page.getByRole('textbox', { name: 'Repository path' }).fill(alternateRepositoryPath);
  188 |   await page.getByRole('button', { name: 'Build architecture map' }).click();
  189 |   const alternateStart = await alternateStartPromise;
  190 |   expect(alternateStart.status()).toBe(200);
  191 |   const alternateRun = await alternateStart.json();
  192 |   expect(alternateRun.run_id).not.toBe(startedRun.run_id);
  193 |   const alternateArchitecturePromise = page.waitForResponse(
  194 |     (response) => response.url().includes('/api/architecture-map') && response.request().method() === 'GET',
  195 |     { timeout: 180_000 },
  196 |   );
  197 |   await expect.poll(
  198 |     () => evidence.websocketEvents.slice(alternateEventsStart),
  199 |     { timeout: 180_000, message: 'The replacement repository should receive its own completed WebSocket pipeline.' },
  200 |   ).toContain('pipeline_complete');
  201 |   const alternateArchitectureResponse = await alternateArchitecturePromise;
  202 |   expect(alternateArchitectureResponse.status()).toBe(200);
  203 |   const alternateArchitecture = await alternateArchitectureResponse.json();
  204 |   expect(alternateArchitecture.analysis_run_id).toBe(alternateRun.run_id);
  205 |   expect(alternateArchitecture.nodes.some((node) => (node.primary_files || []).some((file) => file.endsWith('.py')))).toBeTruthy();
  206 |   await expect(page.locator('.react-flow__node').filter({ hasText: /docs\.ts/ })).toHaveCount(0);
  207 | 
  208 |   writeBrowserEvidence({
  209 |     alternateRunId: alternateRun.run_id,
```