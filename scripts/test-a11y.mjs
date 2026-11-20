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
import { existsSync, readFileSync } from 'node:fs';
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

// On POSIX, detached + negative-PID kill reliably stops the whole
// process group. On Windows, taskkill /T can miss the node child behind
// the cmd/npm wrappers, so cleanup also kills whatever still listens on
// the port (that exact leak served a stale production build on :4321).
const preview = spawn('npm', ['run', 'preview'], {
  cwd: root,
  shell: true,
  stdio: 'pipe',
  detached: process.platform !== 'win32',
});

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

  // Guard against a vacuous pass: pa11y-ci happily audits the 404 page
  // of a mistyped or missing URL. Every tested URL must answer 200.
  const { urls } = JSON.parse(readFileSync(`${root}/.pa11yci.json`, 'utf8'));
  const missing = [];
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) missing.push(`${url} -> HTTP ${res.status}`);
  }
  if (missing.length > 0) {
    throw new Error(`URLs in .pa11yci.json do not resolve:\n  ${missing.join('\n  ')}`);
  }

  exitCode = await new Promise((resolve) => {
    const pa11y = spawn('npx', ['pa11y-ci'], { cwd: root, shell: true, stdio: 'inherit' });
    pa11y.on('close', (code) => resolve(code ?? 1));
  });
} catch (e) {
  console.error(String(e));
} finally {
  if (process.platform === 'win32') {
    const { execSync } = await import('node:child_process');
    try {
      execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
    // Belt and braces: kill whatever still holds the preview port.
    try {
      execSync(
        'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"',
        { stdio: 'ignore' },
      );
    } catch {
      /* nothing was listening */
    }
  } else {
    try {
      process.kill(-preview.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

process.exit(exitCode);
