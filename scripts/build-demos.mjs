/**
 * Demo pipeline — runs before every build (prebuild) and before the dev
 * server (predev). Demos live in demos/<slug>/ in two forms:
 *
 *   static    — an index.html at the root, served as-is
 *   buildable — a package.json with a "build" script producing dist/
 *
 * The script copies each demo's servable files into public/demos/<slug>/
 * (generated, gitignored), which Astro then ships verbatim. Guarantees:
 *
 *   - a demo whose own build crashes is EXCLUDED with a loud warning —
 *     it can never break the portfolio build;
 *   - a demo that VIOLATES the security rules (request to another
 *     domain, document.cookie, service worker, API-key-like string)
 *     fails the whole build: shipping it would be worse than failing;
 *   - demos belonging to draft projects are excluded from production
 *     and preview builds (included in dev, --dev).
 *
 * See docs/demos.md for the full rules.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, extname, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const demosDir = join(root, 'demos');
const outRoot = join(root, 'public', 'demos');
const isDev = process.argv.includes('--dev');

/** Slugs of projects whose fr.md declares demo: internal, with draft state. */
function demoProjects() {
  const projectsDir = join(root, 'src', 'content', 'projects');
  const map = new Map();
  if (!existsSync(projectsDir)) return map;
  for (const slug of readdirSync(projectsDir)) {
    const frPath = join(projectsDir, slug, 'fr.md');
    if (!existsSync(frPath)) continue;
    const fr = readFileSync(frPath, 'utf8');
    if (/^demo\s*:\s*['"]?internal/m.test(fr)) {
      map.set(slug, { draft: !/^draft\s*:\s*false\b/m.test(fr) });
    }
  }
  return map;
}

/** Recursively list files, skipping folders that are never servable. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Line comments: a "//" NOT preceded by ":" (otherwise https:// URLs
// inside strings would be eaten and escape the scan).
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Absolute URL that is neither same-origin-relative nor a W3C namespace. */
const EXTERNAL_URL = /https?:\/\/(?!www\.w3\.org\/)[^\s"'()<>]+/i;

const KEY_PATTERNS = [
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  /AKIA[0-9A-Z]{16}/,
  /sk-[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{36}/,
  /AIza[0-9A-Za-z_\-]{35}/,
];

/**
 * Scan one servable file for rule violations. Returns error strings.
 * Heuristic and fail-closed: a legitimate external URL has no business
 * in a demo anyway (rule: no request to any other domain).
 */
function scanFile(path, slug) {
  const errors = [];
  const warnings = [];
  const ext = extname(path).toLowerCase();
  if (!['.html', '.htm', '.js', '.mjs', '.css', '.svg', '.json', '.webmanifest'].includes(ext)) {
    return { errors, warnings };
  }
  const raw = readFileSync(path, 'utf8');
  const rel = relative(root, path);

  let text = raw;
  if (ext === '.js' || ext === '.mjs') text = stripJsComments(raw);
  if (ext === '.css') text = stripCssComments(raw);
  if (ext === '.html' || ext === '.htm' || ext === '.svg') {
    // Drop HTML comments and xmlns declarations (namespaces, not requests).
    text = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/xmlns(?::[a-z]+)?="[^"]*"/g, '');
  }

  const urlMatch = text.match(EXTERNAL_URL);
  if (urlMatch) {
    errors.push(
      `${rel}: URL toward another domain ("${urlMatch[0].slice(0, 60)}") — demos must embed everything`,
    );
  }
  if (/document\.cookie/.test(text)) {
    errors.push(`${rel}: document.cookie is forbidden in demos`);
  }
  if (/serviceWorker/.test(text)) {
    errors.push(`${rel}: service workers are forbidden in demos`);
  }
  for (const re of KEY_PATTERNS) {
    if (re.test(text)) {
      errors.push(`${rel}: string that looks like an API key or token`);
      break;
    }
  }
  if (/localStorage/.test(text) && !text.includes(`${slug}:`)) {
    warnings.push(`${rel}: localStorage used without an obvious "${slug}:" key prefix — check it`);
  }
  return { errors, warnings };
}

rmSync(outRoot, { recursive: true, force: true });

if (!existsSync(demosDir)) {
  console.log('No demos/ directory — nothing to do.');
  process.exit(0);
}

const projects = demoProjects();
const allErrors = [];
let included = 0;

for (const slug of readdirSync(demosDir)) {
  const dir = join(demosDir, slug);
  if (!statSync(dir).isDirectory()) continue;

  const info = projects.get(slug);
  if (!isDev && (!info || info.draft)) {
    console.log(`demo "${slug}": skipped (draft or unreferenced project — dev only)`);
    continue;
  }

  let srcDir = dir;
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.scripts?.build) {
      try {
        const installCmd = existsSync(join(dir, 'package-lock.json')) ? 'npm ci' : 'npm install';
        execSync(`${installCmd} --no-audit --no-fund`, { cwd: dir, stdio: 'pipe' });
        execSync('npm run build', { cwd: dir, stdio: 'pipe' });
        srcDir = join(dir, 'dist');
      } catch (e) {
        console.warn('');
        console.warn(`⚠⚠⚠ demo "${slug}": ITS OWN BUILD FAILED — excluded from this deploy. ⚠⚠⚠`);
        console.warn(String(e.stdout || e.message).slice(0, 2000));
        console.warn('');
        continue;
      }
    }
  }

  if (!existsSync(join(srcDir, 'index.html'))) {
    console.warn(`⚠ demo "${slug}": no index.html in ${relative(root, srcDir)} — excluded.`);
    continue;
  }

  // Security scan BEFORE copying, on the exact files that would ship.
  const errors = [];
  const warnings = [];
  for (const file of walk(srcDir)) {
    const r = scanFile(file, slug);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  const indexHtml = readFileSync(join(srcDir, 'index.html'), 'utf8');
  if (!indexHtml.includes(`projets/${slug}/`)) {
    warnings.push(`${slug}/index.html: no back link to the project page (projets/${slug}/)`);
  }
  for (const w of warnings) console.warn(`⚠ ${w}`);

  if (errors.length > 0) {
    allErrors.push(...errors);
    continue;
  }

  const dest = join(outRoot, slug);
  mkdirSync(dest, { recursive: true });
  cpSync(srcDir, dest, {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !src.endsWith('package-lock.json'),
  });
  included += 1;
  console.log(`demo "${slug}": included${info?.draft ? ' (draft, dev only)' : ''}`);
}

if (allErrors.length > 0) {
  console.error('\nDemo security rules violated:\n');
  for (const e of allErrors) console.error(`  ✗ ${e}`);
  if (isDev) {
    console.error('\n(dev mode: the offending demos were excluded, fix them before building)');
  } else {
    console.error(
      `\n${allErrors.length} problem(s). Build aborted: these rules protect the whole domain.`,
    );
    process.exit(1);
  }
}

console.log(`Demo pipeline done — ${included} demo(s) in public/demos/.`);
