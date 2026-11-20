/**
 * Builds the site in every availability state (open / closed / hidden)
 * and in the zero-published-projects launch state, and asserts the
 * generated home pages are coherent: availability wording present only
 * when open, no empty section, no "undefined" leaking into HTML.
 * Slow (one full build per state) — run in CI and before releases:
 *   node scripts/test-states.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const AVAIL_FR = 'Disponible immédiatement';
const AVAIL_EN = 'Available now';
const errors = [];

const cases = [
  { availability: 'open', noProjects: false },
  { availability: 'closed', noProjects: false },
  { availability: 'hidden', noProjects: false },
  { availability: 'open', noProjects: true },
];

for (const c of cases) {
  const label = `availability=${c.availability}${c.noProjects ? ' + zero projects' : ''}`;
  console.log(`\n=== build: ${label} ===`);
  try {
    execSync('npm run build', {
      cwd: root,
      stdio: 'pipe',
      env: {
        ...process.env,
        SITE_AVAILABILITY: c.availability,
        ...(c.noProjects ? { TEST_NO_PROJECTS: '1' } : {}),
      },
    });
  } catch (e) {
    errors.push(`${label}: build FAILED\n${String(e.stdout).slice(-1500)}`);
    continue;
  }

  for (const [page, needle] of [
    ['dist/index.html', AVAIL_FR],
    ['dist/en/index.html', AVAIL_EN],
  ]) {
    const html = readFileSync(`${root}/${page}`, 'utf8');
    const hasAvail = html.includes(needle);
    if (c.availability === 'open' && !hasAvail) {
      errors.push(`${label}: ${page} should show the availability line`);
    }
    if (c.availability !== 'open' && hasAvail) {
      errors.push(`${label}: ${page} must NOT show the availability line`);
    }
    if (html.includes('undefined')) {
      errors.push(`${label}: ${page} contains the string "undefined"`);
    }
    if (c.noProjects && /projects-title/.test(html)) {
      errors.push(`${label}: ${page} renders a projects section with zero projects`);
    }
  }
  console.log(`ok: ${label}`);
}

// Leave the workspace in the default state for whoever runs next.
execSync('npm run build', { cwd: root, stdio: 'pipe' });

if (errors.length > 0) {
  console.error('\nState-matrix test failed:\n');
  for (const e of errors) console.error(`  ✗ ${e}\n`);
  process.exit(1);
}
console.log('\nState-matrix test passed (3 availability states + empty launch state).');
