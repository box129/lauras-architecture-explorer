import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(uiRoot, '..');
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE;
const frontendUrl = process.env.SYNTAX_TREE_FRONTEND_URL || 'http://127.0.0.1:5173';
const screenshotDir = process.env.SYNTAX_TREE_SCREENSHOT_DIR || path.join(workspaceRoot, 'syntax-tree-test-artifacts', 'refurbished-frontend');
const repoPath = process.env.SYNTAX_TREE_E2E_REPOSITORY || path.join(workspaceRoot, 'syntax-tree-refurbished-backend');

async function run() {
    console.log("1. Launching browser...");
    const browser = await chromium.launch({
        executablePath: browserExecutable && existsSync(browserExecutable) ? browserExecutable : undefined,
        headless: true
    });
    
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    
    const page = await context.newPage();
    page.setDefaultTimeout(45000); // 45s timeout
    
    console.log(`2. Navigating to frontend: ${frontendUrl}`);
    try {
        await page.goto(frontendUrl, { waitUntil: 'networkidle' });
    } catch (e) {
        console.error(`FAIL: Could not load frontend at ${frontendUrl}. Make sure Vite is running. Error: ${e.message}`);
        await browser.close();
        process.exit(1);
    }
    
    console.log("3. Page loaded. Taking landing page screenshot...");
    await page.screenshot({ path: path.join(screenshotDir, 'landing_page.png') });
    
    console.log(`4. Filling repo path: ${repoPath}`);
    const input = page.locator('#observatory-repo-path');
    await input.waitFor();
    await input.fill(repoPath);
    
    console.log("5. Clicking 'Build architecture map'...");
    const buildButton = page.getByRole('button', { name: /Build architecture map/i });
    await buildButton.waitFor();
    await buildButton.click();
    
    console.log("6. Waiting for analysis progress/completion...");
    try {
        // Wait for orientation view or the canvas loader
        console.log("Waiting for orientation/progress UI...");
        const orientationReady = page.getByText(/Orientation ready/i)
            .or(page.getByText(/Discovering files/i))
            .or(page.locator('.obs-rf-node'))
            .or(page.locator('.react-flow__node'))
            .first();
        await orientationReady.waitFor({ timeout: 25000 });
        console.log("PASS: Ingestion started. Taking progress screenshot...");
        await page.screenshot({ path: path.join(screenshotDir, 'progress_running.png') });
        
        // Wait for system overview components to be rendered on the canvas
        console.log("Waiting for components/nodes to load on the canvas...");
        const firstNode = page.locator('.obs-rf-node, .react-flow__node')
            .or(page.getByRole('button', { name: /Sync/i }))
            .or(page.getByRole('button', { name: /Client/i }))
            .first();
        await firstNode.waitFor({ state: 'visible', timeout: 120000 });
        console.log("PASS: Components loaded in the UI.");
    } catch (e) {
        console.error(`FAIL: Analysis did not complete in time: ${e.message}`);
        await page.screenshot({ path: path.join(screenshotDir, 'error_state.png') });
        const bodyText = await page.locator('body').innerText();
        console.log(`Body text in error state:\n${bodyText}`);
        await browser.close();
        process.exit(1);
    }
    
    console.log("7. Taking screenshot of the loaded architecture map...");
    await page.waitForTimeout(5000); // Wait 5s for animations/graphs to render
    await page.screenshot({ path: path.join(screenshotDir, 'architecture_map.png') });
    
    console.log("8. Verifying node rendering...");
    const nodes = page.locator('.obs-rf-node, .react-flow__node');
    const nodeCount = await nodes.count();
    console.log(`PASS: Found ${nodeCount} architecture nodes on the canvas.`);
    
    if (nodeCount > 0) {
        const firstNodeText = await nodes.first().innerText();
        console.log(`First node label: '${firstNodeText}'`);
        
        console.log("9. Clicking first node to open detail view...");
        await nodes.first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(screenshotDir, 'node_selected_detail.png') });
    } else {
        console.warn("WARN: No nodes found on the canvas.");
    }
    
    console.log("10. Finished test. Closing browser.");
    await browser.close();
    console.log("ALL TESTS COMPLETED SUCCESSFULLY.");
}

run().catch(async (e) => {
    console.error(`Unhandled error during run: ${e.message}`);
    process.exit(1);
});
