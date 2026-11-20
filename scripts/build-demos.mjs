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
    // Only look at the frontmatter, so body prose can never be
    // mistaken for a draft/demo declaration.
    const fm = readFileSync(frPath, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    if (/^demo\s*:\s*['"]?internal/m.test(fm)) {
      map.set(slug, { draft: !/^draft\s*:\s*false\b/m.test(fm) });
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

// Line comments: only a "//" at line start or after whitespace/common
// punctuation counts. A "//" glued to other characters (https://, a
// quote, an identifier) is NOT a comment — otherwise `const s = "//";`
// would blind the scan for the rest of the line.
const stripJsComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}(,=&|])\/\/[^\n]*/gm, '$1');
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Absolute URL (http, https, ws, wss) that is not a W3C namespace. */
const EXTERNAL_URL = /(?:https?|wss?):\/\/(?!www\.w3\.org\/)[^\s"'()<>]+/i;

/** Protocol-relative resource reference in HTML attributes. */
const PROTOCOL_RELATIVE_ATTR = /(?:src|href|srcset|action|data)\s*=\s*["']\s*\/\//i;

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

  // URL detection runs on comment-stripped text (embedded libraries cite
  // their homepage in header comments); every other check runs on the
  // RAW text so nothing can hide behind a fake comment.
  let urlText = raw;
  if (ext === '.js' || ext === '.mjs') urlText = stripJsComments(raw);
  if (ext === '.css') urlText = stripCssComments(raw);
  if (ext === '.html' || ext === '.htm' || ext === '.svg') {
    // Drop HTML comments and xmlns declarations (namespaces, not requests).
    urlText = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/xmlns(?::[a-z]+)?="[^"]*"/g, '');
    if (PROTOCOL_RELATIVE_ATTR.test(urlText)) {
      errors.push(`${rel}: protocol-relative URL (//host/...) — demos must embed everything`);
    }
  }

  const urlMatch = urlText.match(EXTERNAL_URL);
  if (urlMatch) {
    errors.push(
      `${rel}: URL toward another domain ("${urlMatch[0].slice(0, 60)}") — demos must embed everything`,
    );
  }
  if (/document\s*\.\s*cookie|document\s*\[\s*["']cookie|cookieStore/.test(raw)) {
    errors.push(`${rel}: cookie access is forbidden in demos`);
  }
  if (/serviceWorker/i.test(raw)) {
    errors.push(`${rel}: service workers are forbidden in demos`);
  }
  for (const re of KEY_PATTERNS) {
    if (re.test(raw)) {
      errors.push(`${rel}: string that looks like an API key or token`);
      break;
    }
  }
  if (/localStorage/.test(raw) && !raw.includes(`${slug}:`)) {
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
      if (!existsSync(join(dir, 'package-lock.json'))) {
        console.error(
          `✗ demo "${slug}": package.json without package-lock.json — lockfiles are mandatory (repo rule). Run npm install in demos/${slug}/ and commit the lockfile.`,
        );
        allErrors.push(`${slug}: missing package-lock.json`);
        continue;
      }
      try {
        execSync('npm ci --no-audit --no-fund', { cwd: dir, stdio: 'pipe' });
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
