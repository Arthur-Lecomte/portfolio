/**
 * Runs `npm audit --audit-level=high` in every demo that has its own
 * package.json (demos keep their dependencies local). Used by CI; the
 * root project is audited separately in the workflow.
 */

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const demosDir = fileURLToPath(new URL('../demos', import.meta.url));
let failed = false;
let audited = 0;

if (existsSync(demosDir)) {
  for (const slug of readdirSync(demosDir)) {
    const dir = join(demosDir, slug);
    if (!statSync(dir).isDirectory() || !existsSync(join(dir, 'package.json'))) continue;
    audited += 1;
    try {
      execSync('npm audit --audit-level=high', { cwd: dir, stdio: 'inherit' });
    } catch {
      console.error(`✗ demo "${slug}": high-severity audit findings`);
      failed = true;
    }
  }
}

console.log(`Audited ${audited} demo(s) with their own dependencies.`);
process.exit(failed ? 1 : 0);
