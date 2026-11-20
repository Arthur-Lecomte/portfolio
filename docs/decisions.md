# Journal des décisions

Trois lignes par décision : le problème, l'option retenue, pourquoi.
Les plus récentes en haut.

## 2026-11-20 — Direction visuelle B « Moderne neutre » (ARRÊT 2)

Trois directions étaient proposées sur /styleguide ; Arthur a choisi la B.
Retenu : Inter seule (400/600/700), palette neutre, accent bleu encre #1f4fd8
(clair) / #8ab0ff (sombre), tokens figés dans `src/styles/tokens.css`.
Les polices candidates non retenues ont été supprimées du dépôt.

## 2026-11-20 — Polices auto-hébergées via l'API Fonts d'Astro

Il fallait servir Inter sans CDN (règle « aucun contenu tiers »).
Retenu : woff2 Fontsource committés avec leur licence OFL, déclarés via
`fonts` + `fontProviders.local()` dans astro.config.ts.
L'API gère hachage, cache immuable, préchargement et polices de repli ajustées.

## 2026-11-20 — Pas de statistiques au lancement

Fallait-il installer Plausible (~9 $/mois) dès le départ ?
Arthur a choisi de démarrer sans aucune statistique ; le champ `plausibleDomain`
de `src/data/site.ts` reste à `null`. Avant toute activation future : refaire
l'évaluation CNIL (critères de la délibération n° 2020-091, outil
d'auto-évaluation sur cnil.fr) et la consigner ici.

## 2026-11-20 — Intitulé du site

Le brief disait « Développeur logiciel », le CV dit « Développeur logiciel junior ».
Retenu : « Développeur logiciel junior » / « Junior software developer ».
Le CV est la source de vérité et un intitulé plus élevé que le CV est interdit.

## 2026-11-20 — Hébergement : Cloudflare Workers (static assets)

Cloudflare propose Pages et Workers pour les sites statiques.
Retenu : Workers avec static assets, déployé par Workers Builds depuis GitHub.
La doc Cloudflare dit explicitement « Start new projects with Workers » ;
`_headers`/`_redirects` y sont supportés nativement, previews de PR incluses.

## 2026-11-20 — Réglages dans `src/data/site.ts` plutôt que `site.yaml`

Le brief suggérait un YAML, qui aurait exigé un plugin Vite (dépendance en plus).
Retenu : un module TypeScript unique `src/data/site.ts`, typé strict.
Zéro dépendance, erreurs à la compilation, aussi simple à éditer qu'un YAML.

## 2026-11-20 — Socle écrit à la main plutôt que template `create-astro`

Le template minimal ajoute des fichiers d'exemple à nettoyer.
Retenu : `package.json`, config et pages écrits à la main, dépendances au compte-gouttes.
Chaque fichier du dépôt a une raison d'être ; le dépôt est une vitrine.

## 2026-11-20 — CSP sans inline préparée dès le socle

La CSP stricte de la phase 7 n'aura pas `'unsafe-inline'`.
Retenu : `build.inlineStylesheets: 'never'` et `assetsInlineLimit: 0` dès maintenant.
Astro n'inline alors plus ni style ni script : la CSP ne cassera rien plus tard.

## 2026-11-20 — Identité git : adresse noreply GitHub

L'e-mail personnel d'Arthur ne doit pas apparaître dans l'historique public.
Retenu : `user.email = 92148174+Arthur-Lecomte@users.noreply.github.com` en
config locale du dépôt. L'historique ne révèle aucune adresse réelle.

## 2026-11-20 — Licences : MIT pur + réserve dans le README

Un seul fichier LICENSE mélangeant MIT et « tous droits réservés » casse la
détection de licence GitHub. Retenu : LICENSE = MIT inchangé, et le README
précise que textes, images et CV restent tous droits réservés.

## 2026-11-20 — Dépendances du socle

astro (le framework) ; en dev : prettier + prettier-plugin-astro (formatage),
@astrojs/check + typescript (exigés par `astro check`).
Rien d'autre ; toute dépendance future sera justifiée ici.
