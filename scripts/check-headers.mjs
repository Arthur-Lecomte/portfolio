/**
 * Validates public/_headers against Cloudflare's documented semantics
 * (rules apply in file order; a request inherits every matching rule's
 * headers; "! Name" detaches what earlier rules added). Simulates
 * representative URLs and asserts each zone ends up with exactly ONE
 * Content-Security-Policy — the right one — plus the mandatory
 * security headers. Also enforces Cloudflare's hard limits
 * (100 rules, 2000 chars per line). Runs in prebuild and CI.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../public/_headers', import.meta.url));
const lines = readFileSync(file, 'utf8').split(/\r?\n/);
const errors = [];

/** Parse into [{ pattern, ops: [{remove?, name, value?}] }] preserving order. */
const rules = [];
let current = null;
for (const [i, rawLine] of lines.entries()) {
  const line = rawLine.replace(/\s+$/, '');
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (rawLine.length > 2000) {
    errors.push(`line ${i + 1}: exceeds Cloudflare's 2000 character limit (${rawLine.length})`);
  }
  if (!/^\s/.test(line)) {
    current = { pattern: line.trim(), ops: [] };
    rules.push(current);
  } else if (current) {
    const t = line.trim();
    if (t.startsWith('! ')) {
      current.ops.push({ remove: true, name: t.slice(2).trim().toLowerCase() });
    } else {
      const idx = t.indexOf(':');
      current.ops.push({
        name: t.slice(0, idx).trim().toLowerCase(),
        value: t.slice(idx + 1).trim(),
      });
    }
  }
}

if (rules.length > 100) errors.push(`more than 100 header rules (${rules.length})`);

function matches(pattern, path) {
  const re = new RegExp(
    '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
  );
  return re.test(path);
}

/** Cloudflare semantics: apply rules in order, joining duplicates. */
function headersFor(path) {
  const result = new Map();
  for (const rule of rules) {
    if (!matches(rule.pattern, path)) continue;
    for (const op of rule.ops) {
      if (op.remove) result.delete(op.name);
      else if (result.has(op.name)) result.set(op.name, result.get(op.name) + ', ' + op.value);
      else result.set(op.name, op.value);
    }
  }
  return result;
}

const REQUIRED = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'cross-origin-opener-policy',
  'permissions-policy',
];

function assertZone(path, checks) {
  const h = headersFor(path);
  for (const name of REQUIRED) {
    if (!h.has(name)) errors.push(`${path}: missing header "${name}"`);
  }
  const csp = h.get('content-security-policy') ?? '';
  if (csp.includes(',')) {
    errors.push(`${path}: multiple CSP values combined — the detach rule failed: "${csp}"`);
  }
  for (const [label, test] of Object.entries(checks)) {
    if (!test(csp)) errors.push(`${path}: CSP check failed — ${label}`);
  }
  const hsts = h.get('strict-transport-security') ?? '';
  if (!/max-age=63072000/.test(hsts) || /preload/.test(hsts)) {
    errors.push(`${path}: HSTS must be max-age=63072000 without preload`);
  }
}

assertZone('/', {
  "portfolio CSP forbids 'unsafe-inline'": (csp) => !csp.includes('unsafe-inline'),
  "portfolio CSP starts from default-src 'none'": (csp) => csp.includes("default-src 'none'"),
  'portfolio CSP blocks framing': (csp) => csp.includes("frame-ancestors 'none'"),
  'portfolio CSP blocks forms': (csp) => csp.includes("form-action 'none'"),
  'portfolio CSP has no external host': (csp) => !/https?:\/\//.test(csp),
});

assertZone('/demos/projet-exemple/main.js', {
  "demo CSP is the demo one (allows 'unsafe-inline' scripts)": (csp) =>
    csp.includes("script-src 'self' 'unsafe-inline'"),
  "demo CSP keeps connect-src 'self'": (csp) => csp.includes("connect-src 'self'"),
  'demo CSP blocks framing': (csp) => csp.includes("frame-ancestors 'none'"),
  'demo CSP blocks forms': (csp) => csp.includes("form-action 'none'"),
  'demo CSP has no external host': (csp) => !/https?:\/\//.test(csp),
});

const astroAssets = headersFor('/_astro/app.css');
if (!/immutable/.test(astroAssets.get('cache-control') ?? '')) {
  errors.push('/_astro/*: hashed assets must be cached immutable');
}
const htmlCache = headersFor('/').get('cache-control');
if (htmlCache) {
  errors.push(`/: HTML must keep Cloudflare's default Cache-Control, found "${htmlCache}"`);
}

if (errors.length > 0) {
  console.error('Header verification failed:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('Header verification passed (both zones get exactly one correct CSP).');
