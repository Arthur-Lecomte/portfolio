/**
 * Content checks that Zod cannot express (cross-file rules), run before
 * every build via the npm "prebuild" hook. Any failure aborts the build
 * with an explicit message — nothing invalid can reach production.
 *
 * Checks:
 *  1. every project folder has BOTH fr.md and en.md
 *  2. published projects (draft: false) contain no TODO(arthur)
 *  3. no raw <script>/<iframe>/<object>/<embed> or on*= in any markdown
 *  4. no plain http:// URL anywhere (https only)
 *  5. demo: internal requires a matching demos/<slug>/ folder
 *  6. aiNote and disclaimer are present in both languages, or neither
 *  7. no TODO(arthur) in always-published sources (pages, site settings)
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const projectsDir = join(root, 'src', 'content', 'projects');
const errors = [];

const FORBIDDEN_HTML = /<script|<iframe|<object|<embed|\son[a-z]+\s*=/i;

/** Plain http:// (not https://) — tolerate nothing, the whole site is https. */
function findInsecureUrl(text) {
  const re = /http:\/\//g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (text[m.index - 1] !== 's' && text[m.index - 1] !== 'S') return true;
  }
  return false;
}

const hasKey = (text, key) => new RegExp(`^${key}\\s*:`, 'm').test(text);

if (existsSync(projectsDir)) {
  for (const slug of readdirSync(projectsDir)) {
    const dir = join(projectsDir, slug);
    if (!statSync(dir).isDirectory()) continue;

    const frPath = join(dir, 'fr.md');
    const enPath = join(dir, 'en.md');
    if (!existsSync(frPath)) {
      errors.push(`${slug}: fr.md is missing`);
      continue;
    }
    if (!existsSync(enPath)) {
      errors.push(`${slug}: en.md is missing (every text needs its English version)`);
      continue;
    }

    const fr = readFileSync(frPath, 'utf8');
    const en = readFileSync(enPath, 'utf8');
    const published = /^draft\s*:\s*false\b/m.test(fr);

    if (published) {
      for (const [lang, text] of [
        ['fr.md', fr],
        ['en.md', en],
      ]) {
        if (text.includes('TODO(arthur')) {
          errors.push(`${slug}/${lang}: TODO(arthur) left in a published project`);
        }
      }
    }

    for (const [lang, text] of [
      ['fr.md', fr],
      ['en.md', en],
    ]) {
      if (FORBIDDEN_HTML.test(text)) {
        errors.push(
          `${slug}/${lang}: raw HTML (<script>/<iframe>/<object>/<embed>/on*=) is forbidden in markdown`,
        );
      }
      if (findInsecureUrl(text)) {
        errors.push(`${slug}/${lang}: plain http:// URL found — use https://`);
      }
    }

    if (/^demo\s*:\s*['"]?internal/m.test(fr)) {
      const demoDir = join(root, 'demos', slug);
      if (!existsSync(demoDir)) {
        errors.push(`${slug}: demo is "internal" but demos/${slug}/ does not exist`);
      }
    }

    for (const key of ['aiNote', 'disclaimer']) {
      if (hasKey(fr, key) !== hasKey(en, key)) {
        errors.push(`${slug}: "${key}" must be present in both fr.md and en.md, or in neither`);
      }
    }
  }
}

/** Always-published sources must never carry a TODO(arthur). */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

for (const base of [join(root, 'src', 'pages'), join(root, 'src', 'data')]) {
  if (!existsSync(base)) continue;
  for (const file of walk(base)) {
    if (readFileSync(file, 'utf8').includes('TODO(arthur')) {
      errors.push(`${file.replace(root, '')}: TODO(arthur) left in an always-published source`);
    }
  }
}

if (errors.length > 0) {
  console.error('Content verification failed:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`\n${errors.length} problem(s). Build aborted.`);
  process.exit(1);
}

console.log('Content verification passed.');
