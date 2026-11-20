/**
 * Automated accessibility test (WCAG 2 AA via pa11y-ci) on the main
 * pages of the built site. Serves dist/ with `astro preview`, runs
 * pa11y-ci against the URLs in .pa11yci.json, then shuts the server
 * down. Run after `npm run build`:
 *   node scripts/test-a11y.mjs
 * Chrome resolution: PUPPETEER_EXECUTABLE_PATH if set (CI uses the
 * runner's Chrome), otherwise the usual Windows install, otherwise
 * puppeteer's own download.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

if (!existsSync(`${root}/dist/index.html`)) {
  console.error('dist/ not found — run npm run build first.');
  process.exit(1);
}

if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
  for (const candidate of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ]) {
    if (existsSync(candidate)) {
      process.env.PUPPETEER_EXECUTABLE_PATH = candidate;
      break;
    }
  }
}

const preview = spawn('npm', ['run', 'preview'], { cwd: root, shell: true, stdio: 'pipe' });

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('preview server did not start');
}

let exitCode = 1;
try {
  await waitForServer('http://localhost:4321/');
  exitCode = await new Promise((resolve) => {
    const pa11y = spawn('npx', ['pa11y-ci'], { cwd: root, shell: true, stdio: 'inherit' });
    pa11y.on('close', (code) => resolve(code ?? 1));
  });
} catch (e) {
  console.error(String(e));
} finally {
  // `shell: true` wraps npm: kill the whole tree on Windows.
  spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { shell: true });
}

process.exit(exitCode);
