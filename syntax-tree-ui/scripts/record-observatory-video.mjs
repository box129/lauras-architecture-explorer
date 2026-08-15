import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 6500 + Math.floor(Math.random() * 700);
const baseUrl = `http://127.0.0.1:${port}`;
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE;
const videoDir = path.join(root, 'artifacts', 'observatory', 'phase-7', 'video');
const finalVideo = path.join(videoDir, 'observatory-docs-studio.webm');

function startServer() {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(command, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/__observatory-preview`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(`Vite server did not become ready on ${baseUrl}`);
}

function stopServer(server) {
  if (process.platform === 'win32' && server.pid) {
    spawnSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    spawnSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$owners = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($owner in $owners) { Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue }`,
    ], { stdio: 'ignore', windowsHide: true });
  } else {
    server.kill('SIGTERM');
  }
  server.stdout?.destroy();
  server.stderr?.destroy();
  server.unref();
}

async function run() {
  await rm(videoDir, { recursive: true, force: true });
  await mkdir(videoDir, { recursive: true });
  const server = startServer();
  const logs = [];
  server.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  server.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({
      executablePath: browserExecutable && existsSync(browserExecutable) ? browserExecutable : undefined,
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);

    await page.goto(`${baseUrl}/__observatory-preview`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await page.getByText('RAG Pipeline', { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Save Lens/i }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.obs-lens-drawer .obs-icon-button').click();

    await page.locator('.obs-question-dock__input').fill('How does an uploaded document affect the answer?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: /View answer proof/i }).first().click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Save proof lens/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Docs Studio/i }).click();
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: /Generate Outline/i }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /Generate Markdown/i }).click();
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: /Open in Observatory/i }).first().click();
    await page.waitForTimeout(900);

    const video = page.video();
    await context.close();
    if (video) await copyFile(await video.path(), finalVideo);
    console.log(`Observatory video written to ${finalVideo}`);
  } finally {
    if (browser) await browser.close();
    stopServer(server);
    await writeFile(path.join(videoDir, `vite-record-server-${Date.now()}.log`), logs.join(''));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
