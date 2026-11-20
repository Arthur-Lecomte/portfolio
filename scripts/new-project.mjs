/**
 * Creates a new project entry from the commented template, always as a
 * draft. Usage:
 *
 *   npm run new:project -- <slug> [--demo]
 *
 * <slug> is kebab-case and becomes the folder name, the URL and, with
 * --demo, the demos/<slug>/ folder.
 */

import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== '--');
const withDemo = args.includes('--demo');
const slug = args.find((a) => !a.startsWith('--'));

if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run new:project -- <slug> [--demo]');
  console.error('The slug must be kebab-case: lowercase letters, digits, hyphens.');
  process.exit(1);
}

const dir = join(root, 'src', 'content', 'projects', slug);
if (existsSync(dir)) {
  console.error(`src/content/projects/${slug}/ already exists.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const frTemplate = `---
# Fiche projet « ${slug} » — le français fait foi. Les données partagées
# (date, stack, liens, image) vivent ici ; en.md ne contient que le
# texte anglais. Champs commentés = optionnels.
title: "TODO(arthur): titre, 60 caractères max"
summary: "TODO(arthur): une phrase sans jargon qui dit ce que fait le projet, 160 max"
date: ${today}
status: wip # wip | done | archived
kind: tool # web | game | desktop | mod | tool
stack: # 1 à 8 technos, en texte
  - "TODO(arthur): techno"
${withDemo ? 'demo: internal # la démo vit dans demos/' + slug + '/' : '# demo: internal # ou une URL https:// — décommenter si démo'}
links:
  repo: "https://github.com/Arthur-Lecomte/TODO" # au moins une démo, un repo ou un téléchargement
  # download: "https://..."
cover: ./cover.png # remplacer par une vraie image (le placeholder est gris)
coverAlt: "TODO(arthur): ce que montre l'image, pour qui ne la voit pas"
featured: false
draft: true # SEUL Arthur passe cette ligne à false — publier est sa décision
thirdParty: [] # tout ce qui n'est pas de toi : [{ name, license, url }]
# aiNote: "TODO(arthur): ce que tu as décidé et fait toi-même sur ce projet"
# disclaimer: "Projet non officiel, non affilié à ..."
---

## L'idée

TODO(arthur): pourquoi ce truc existe.

## Ce que ça fait

TODO(arthur): ce que voit l'utilisateur, avec une capture.

## Sous le capot

TODO(arthur): les choix techniques, pour le lecteur développeur.

## Ce que j'ai appris ou décidé

TODO(arthur)

## Limites connues

TODO(arthur)
`;

const enTemplate = `---
# English version of « ${slug} » — text only, shared data lives in fr.md.
# Claude drafts this from Arthur's French, Arthur reviews.
title: "TODO(arthur): English title"
summary: "TODO(arthur): one jargon-free sentence"
coverAlt: "TODO(arthur): what the image shows"
# aiNote: "TODO(arthur)"
# disclaimer: "Unofficial project, not affiliated with ..."
---

TODO(arthur): English text, written by Claude once the French exists.
`;

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'fr.md'), frTemplate);
writeFileSync(join(dir, 'en.md'), enTemplate);
copyFileSync(join(root, 'scripts', 'templates', 'cover-placeholder.png'), join(dir, 'cover.png'));

if (withDemo) {
  const demoDir = join(root, 'demos', slug);
  mkdirSync(demoDir, { recursive: true });
  writeFileSync(
    join(demoDir, 'index.html'),
    `<!doctype html>
<!--
  Demo "${slug}" — rules (docs/demos.md):
  100% static, in-browser only. No request to any other domain (no CDN,
  fonts, API, analytics). No cookies, no service worker. localStorage
  allowed only for saves/preferences, keys prefixed with "${slug}:".
  Must work under /demos/${slug}/ (relative paths only).
-->
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${slug}</title>
  </head>
  <body>
    <main>
      <h1>${slug}</h1>
      <p>Démo en construction.</p>
    </main>
    <footer>
      <a href="../../projets/${slug}/">← Retour à la fiche du projet</a>
    </footer>
  </body>
</html>
`,
  );
}

console.log(
  `Created src/content/projects/${slug}/ (fr.md, en.md, cover.png)${withDemo ? ` and demos/${slug}/` : ''}.`,
);
console.log('');
console.log('À toi : remplis les TODO(arthur) du fr.md, remplace cover.png,');
console.log('puis dis-le à Claude pour la version anglaise.');
console.log('');
console.log('Rappel : la fiche est en draft — invisible sur le site, mais');
console.log("LISIBLE PAR TOUS sur GitHub dès qu'elle est poussée.");
