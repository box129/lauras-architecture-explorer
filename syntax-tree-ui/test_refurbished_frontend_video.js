import { chromium } from '@playwright/test';
import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(uiRoot, '..');
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE;
const frontendUrl = process.env.SYNTAX_TREE_FRONTEND_URL || 'http://127.0.0.1:5173';
const screenshotDir = process.env.SYNTAX_TREE_SCREENSHOT_DIR || path.join(workspaceRoot, 'syntax-tree-test-artifacts', 'refurbished-frontend-video');
const repoPath = process.env.SYNTAX_TREE_E2E_REPOSITORY || path.join(workspaceRoot, 'syntax-tree-refurbished-backend');

async function run() {
    console.log("1. Launching browser...");
    const browser = await chromium.launch({
        executablePath: browserExecutable && existsSync(browserExecutable) ? browserExecutable : undefined,
        headless: true
    });
    
    // Set up context with video recording enabled
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        recordVideo: {
            dir: screenshotDir,
            size: { width: 1440, height: 900 }
        }
    });
    
    const page = await context.newPage();
    page.setDefaultTimeout(60000); // 60s timeout for safety
    
    console.log(`2. Navigating to frontend: ${frontendUrl}`);
    try {
        await page.goto(frontendUrl, { waitUntil: 'networkidle' });
    } catch (e) {
        console.error(`FAIL: Could not load frontend at ${frontendUrl}. Error: ${e.message}`);
        await context.close();
        await browser.close();
        process.exit(1);
    }
    
    console.log("3. Page loaded. Waiting and filling repo path...");
    const input = page.locator('#observatory-repo-path');
    await input.waitFor();
    await input.fill(repoPath);
    await page.waitForTimeout(1000); // Wait 1s for visual clarity in video
    
    console.log("4. Clicking 'Build architecture map'...");
    const buildButton = page.getByRole('button', { name: /Build architecture map/i });
    await buildButton.waitFor();
    await buildButton.click();
    
    console.log("5. Waiting for analysis progress/completion...");
    try {
        const orientationReady = page.getByText(/Orientation ready/i)
            .or(page.getByText(/Discovering files/i))
            .or(page.locator('.obs-rf-node'))
            .or(page.locator('.react-flow__node'))
            .first();
        await orientationReady.waitFor({ timeout: 25000 });
        console.log("PASS: Ingestion started.");
        await page.waitForTimeout(2000); // Keep progress screen visible in video
        
        console.log("Waiting for components/nodes to load on the canvas...");
        const firstNode = page.locator('.obs-rf-node, .react-flow__node')
            .or(page.getByRole('button', { name: /Sync/i }))
            .or(page.getByRole('button', { name: /Client/i }))
            .first();
        await firstNode.waitFor({ state: 'visible', timeout: 120000 });
        console.log("PASS: Components loaded in the UI.");
    } catch (e) {
        console.error(`FAIL: Analysis did not complete in time: ${e.message}`);
        await context.close();
        await browser.close();
        process.exit(1);
    }
    
    console.log("6. Waiting for animations to settle...");
    await page.waitForTimeout(6000); // Wait 6s so the map displays fully in the video
    
    console.log("7. Verifying node rendering...");
    const nodes = page.locator('.obs-rf-node, .react-flow__node');
    const nodeCount = await nodes.count();
    console.log(`PASS: Found ${nodeCount} architecture nodes on the canvas.`);
    
    if (nodeCount > 0) {
        console.log("8. Clicking first node to open detail view...");
        await nodes.first().click(); await page.waitForTimeout(1000); await nodes.first().dblclick();
        await page.waitForTimeout(4000); // Keep node details drawer visible in the video
    } else {
        console.warn("WARN: No nodes found on the canvas.");
    }
    
    console.log("9. Finished test. Closing context to finalize video...");
    
    // Get the video object reference before context closes
    const video = page.video();
    await context.close();
    await browser.close();
    
    if (video) {
        const videoPath = await video.path();
        const destPath = path.join(screenshotDir, 'e2e_recording.webm');
        try {
            renameSync(videoPath, destPath);
            console.log(`PASS: Video successfully saved to ${destPath}`);
        } catch (err) {
            console.error(`Error renaming video file: ${err.message}`);
        }
    } else {
        console.error("FAIL: Video object was not created.");
    }
    
    console.log("ALL TESTS COMPLETED SUCCESSFULLY.");
}

run().catch(async (e) => {
    console.error(`Unhandled error during run: ${e.message}`);
    process.exit(1);
});
