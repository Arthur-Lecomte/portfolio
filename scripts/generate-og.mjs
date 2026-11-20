/**
 * Generates public/og.png (1200x630) from the site settings — run
 * `node scripts/generate-og.mjs` after changing the name, title or
 * availability wording in src/data/site.ts, then commit the PNG.
 * Direction B palette; system fonts (the OG image is rendered once at
 * generation time, not in visitors' browsers).
 */

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

// Node 24 strips types natively, so the settings module imports as-is.
const { site } = await import('../src/data/site.ts');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const avail = site.availability === 'open' ? esc(site.availabilityText.fr) : '';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="12" fill="#1f4fd8"/>
  <text x="96" y="280" font-family="Arial, sans-serif" font-size="76" font-weight="bold" fill="#16181d">${esc(site.name)}</text>
  <text x="96" y="350" font-family="Arial, sans-serif" font-size="38" fill="#565b64">${esc(site.role.fr)} — ${esc(site.location.fr)}</text>
  ${avail ? `<text x="96" y="420" font-family="Arial, sans-serif" font-size="30" fill="#1f4fd8">${avail}</text>` : ''}
  <text x="96" y="560" font-family="Arial, sans-serif" font-size="28" fill="#9aa0ab">${esc(site.domain)}</text>
</svg>`;

const out = fileURLToPath(new URL('../public/og.png', import.meta.url));
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`Generated ${out}`);
