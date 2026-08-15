import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(root, 'artifacts', 'observatory', 'legacy-cutover');
const port = 5400 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const browserExecutable = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE;

const shots = [
  ['observatory-entry-1536x960.png', 1536, 960, '/'],
  ['legacy-workspace-1536x960.png', 1536, 960, '/legacy'],
  ['saved-lens-drawer-empty-1536x960.png', 1536, 960, '/__observatory-preview?state=drawer-empty&drawer=lenses'],
  ['saved-lens-drawer-filled-1536x960.png', 1536, 960, '/__observatory-preview?state=saved-lenses&drawer=lenses'],
  ['tour-builder-1536x960.png', 1536, 960, '/__observatory-preview?state=tour-builder&drawer=lenses'],
  ['tour-playback-1536x960.png', 1536, 960, '/__observatory-preview?node=rag-pipeline&tour=fixture-tour-onboarding&tourStep=0'],
  ['docs-studio-empty-1536x960.png', 1536, 960, '/__observatory-preview/docs?state=docs-empty'],
  ['docs-studio-outline-1536x960.png', 1536, 960, '/__observatory-preview/docs'],
  ['docs-markdown-preview-1536x960.png', 1536, 960, '/__observatory-preview/docs'],
  ['citation-restored-lens-1536x960.png', 1536, 960, '/__observatory-preview?question=rag-upload&proof=1'],
  ['docs-loading-1536x960.png', 1536, 960, '/__observatory-preview/docs?state=docs-loading'],
  ['docs-error-1536x960.png', 1536, 960, '/__observatory-preview/docs?state=docs-error'],
  ['narrow-laptop-1366x768.png', 1366, 768, '/__observatory-preview/docs'],
];

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

function startServer() {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(command, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

async function stopServer(server) {
  if (process.platform === 'win32' && server.pid) {
    spawnSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    spawnSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$owners = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($owner in $owners) { Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue }`,
    ], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    server.kill('SIGTERM');
  }
  server.stdout?.destroy();
  server.stderr?.destroy();
  server.unref();
}

async function capture() {
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
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
    const context = await browser.newContext();
    for (const [name, width, height, url] of shots) {
      const page = await context.newPage({ viewport: { width, height } });
      page.setDefaultTimeout(15_000);
      await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForTimeout(url.includes('proof=1') ? 1500 : 650);
      if (url.includes('proof=1')) {
        await page.waitForFunction(
          () => !document.body.innerText.includes('Reading source file'),
          undefined,
          { timeout: 6_000 },
        ).catch(() => {});
      }
      await page.screenshot({ path: path.join(artifactDir, name), fullPage: false });
      await page.close();
      console.log(`${name}`);
    }
    console.log(`Observatory screenshots written to ${artifactDir}`);
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
    await writeFile(path.join(artifactDir, `vite-screenshot-server-${Date.now()}.log`), logs.join(''));
  }
}

capture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
