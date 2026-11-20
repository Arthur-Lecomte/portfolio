/**
 * Internal link check on the built site (run after `npm run build`).
 * Every root-relative href/src in dist/ must resolve to a built file.
 * External links are listed for information but never block (network
 * flakiness must not gate deploys); internal breakage fails.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const errors = [];
const external = new Set();

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (!existsSync(dist)) {
  console.error('dist/ not found — run npm run build first.');
  process.exit(1);
}

for (const file of walk(dist)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (url.startsWith('https://')) {
      external.add(url);
    } else if (url.startsWith('http://')) {
      errors.push(`${file.replace(dist, '')}: insecure link ${url}`);
    } else if (url.startsWith('mailto:') || url.startsWith('#') || url.startsWith('data:')) {
      continue;
    } else {
      // Root-relative (portfolio pages) or relative (demo files): both
      // must resolve to a built file.
      const clean = url.split('#')[0].split('?')[0];
      if (!clean || clean === '/') continue;
      const target = clean.startsWith('/')
        ? join(dist, ...clean.split('/').filter(Boolean))
        : resolve(dirname(file), ...clean.split('/'));
      if (!existsSync(target) && !existsSync(join(target, 'index.html'))) {
        errors.push(`${file.replace(dist, '')}: dead link ${url}`);
      }
    }
  }
}

if (external.size > 0) {
  console.log('External links (checked manually, non-blocking):');
  for (const u of [...external].sort()) console.log(`  - ${u}`);
}

if (errors.length > 0) {
  console.error('\nLink check failed:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`\nLink check passed (${walk(dist).length} pages).`);
