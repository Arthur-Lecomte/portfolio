# arthurlecomte.fr

Portfolio d'Arthur Lecomte, développeur logiciel junior dans le Var. Le site
présente mon parcours et mes projets personnels, dont certains sont jouables
directement dans le navigateur sous `/demos/`.

## Choix techniques

- Site 100 % statique généré avec [Astro](https://astro.build) : aucun serveur,
  aucune base de données, aucun formulaire, aucun secret.
- TypeScript strict, CSS natif (pas de framework UI), zéro JavaScript côté
  client sur les pages du portfolio — elles fonctionnent JavaScript désactivé.
- Les démos vivent dans ce dépôt (`demos/<slug>/`), sont servies sous
  `/demos/<slug>/` et embarquent toutes leurs dépendances : aucune requête
  vers un autre domaine, nulle part.
- Hébergement sur Cloudflare, déployé automatiquement depuis ce dépôt.
- Ces projets sont développés avec assistance IA, et c'est assumé : cadrer,
  diriger et vérifier une IA fait partie de ce que ce site montre.

## Lancer en local

```sh
npm ci
npm run dev       # serveur de développement
npm run build     # build de production dans dist/
npm run check     # vérification TypeScript
```

Node 24 (LTS) ou plus récent.

## Réglages hors dépôt

À faire à la main sur les comptes concernés (rien dans le code n'en dépend) :

- GitHub : protection de la branche `main` (CI verte obligatoire), 2FA.
- Registrar et Cloudflare : 2FA, DNSSEC.

## Licences

Le code source de ce dépôt (mise en page, scripts, code des démos) est sous
licence [MIT](LICENSE).

Ne sont **pas** couverts par la licence MIT et restent soumis au droit
d'auteur — tous droits réservés : les textes, les images, les captures,
le CV et toute donnée personnelle présents dans ce dépôt ou sur le site.
Toute réutilisation nécessite mon accord écrit préalable.

Site réalisé avec Astro.
