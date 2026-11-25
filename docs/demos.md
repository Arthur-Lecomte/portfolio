# Les démos : règles et fonctionnement

Les démos vivent dans `demos/<slug>/` et sont servies sous `/demos/<slug>/`,
sur le même domaine que le portfolio. C'est pour ça que les règles sont
strictes : une démo boguée ne doit rien pouvoir charger ni envoyer ailleurs.

## Deux formes acceptées

- **Statique** : un `index.html` à la racine du dossier, avec ses fichiers.
- **Avec build** : un `package.json` dont `npm run build` produit un dossier
  `dist/` statique. Les dépendances restent dans le dossier de la démo, avec
  leur propre lockfile.

## Le pipeline (`scripts/build-demos.mjs`)

Lancé automatiquement avant chaque build (`npm run build`) et avant le serveur
de dev (`npm run dev`). Attention : un `npm run build` lancé pendant que le
serveur de dev tourne vide `public/demos/` des brouillons (c'est son rôle en
production) — relancer `npm run dev` pour les retrouver. Le pipeline :

1. vide puis remplit `public/demos/` (dossier généré, jamais commité) ;
2. exclut en production et en preview les démos des projets en `draft`
   (elles restent visibles en local) ;
3. construit les démos « avec build » ; **une démo dont le build plante est
   exclue du déploiement avec un avertissement bruyant — elle ne casse jamais
   le portfolio** ;
4. analyse les fichiers servis et **fait échouer le build** s'il trouve :
   - une URL vers un autre domaine (dans le HTML, le JS, le CSS…) ;
   - `document.cookie` ;
   - un service worker ;
   - une chaîne qui ressemble à une clé d'API ou à un jeton.

## Les règles, côté auteur

- 100 % statique, exécutée dans le navigateur. Aucun backend, aucune clé.
- **Aucune requête vers un autre domaine** : pas de CDN, de police distante,
  d'API, de stats. Tout est embarqué dans le dossier.
- Aucun cookie. `localStorage` uniquement pour une sauvegarde ou des
  préférences, avec des clés préfixées `"<slug>:"` (toutes les démos
  partagent la même origine).
- Pas de service worker, pas de formulaire qui envoie des données, pas de
  contenu saisi par un visiteur et montré aux autres.
- Chemins relatifs : la démo doit marcher sous `/demos/<slug>/`.
- Un lien de retour vers `../../projets/<slug>/`.
- Si elle n'est pas utilisable sur mobile, la fiche du projet le dit.
- Les licences des bibliothèques embarquées sont respectées et créditées
  dans le champ `thirdParty` de la fiche.

Un projet qui a besoin d'un serveur, d'une API externe ou d'un compte n'a
pas de démo hébergée : sa fiche renvoie vers le repo, des captures ou un
téléchargement. Ces règles ne se contournent pas.

## Charte d'interface (décidée le 25/11/2026)

But : on passe d'une démo à l'autre sans réapprendre l'interface. La charte
unifie l'habillage, pas la disposition : chaque démo garde sa mise en page
(page qui défile ou application plein écran) et place ses contrôles où c'est
pertinent. La version de référence (texte complet + `src/style.css` modèle)
vit dans le repo [demo-template](https://github.com/Arthur-Lecomte/demo-template) ;
chaque nouveau repo de projet la porte d'office. L'essentiel :

- **Thème sombre fixe**, tokens aux mêmes noms et valeurs que le mode sombre
  du site (`--color-bg/-text/-muted/-surface/-border/-accent/-accent-contrast`,
  `--radius-sm/md`). L'habillage ne consomme que ces tokens ; les couleurs de
  la **scène** (ce que dessine le canvas) restent libres (`--scene-*` ou JS) :
  c'est l'identité de la démo.
- **Structure** : tagline sous le h1 (ou en tête du dialog d'aide en plein
  écran) ; volet « Comment ça marche ? » obligatoire (`<details>` fermé, ou
  `<dialog>` ouvert par un bouton « ? ») ; `<meta name="description">` ;
  footer centré hors de `<main>`, lien retour en `--color-muted`.
- **Contrôles** : libellés standard (« Lecture »/« Pause » alternant,
  « Réinitialiser », « Effacer »), pas d'emoji dans titres et libellés,
  sliders `label > input > output`, boutons au gabarit commun avec cibles
  ≥ 44 px, `:focus-visible` universel à l'accent.
- **Divers** : `box-sizing` universel, `prefers-reduced-motion` respecté
  (une simulation continue démarre en pause dans ce mode).

Écarts assumés (identité ou sémantique, documentés dans les repos) : le h1
arc-en-ciel de prisma et ses couleurs « danger », l'écho doré du record
d'auto-ecole, le slider de cube-solver sans `<output>` (valeur interne non
parlante).

## Limites connues du scan

L'analyse est volontairement « fail-closed » : une URL absolue légitime dans
une chaîne JS fera échouer le build — c'est voulu, elle n'a rien à y faire.
Les commentaires sont ignorés pour la détection d'URL (les bibliothèques
embarquées citent leur site en en-tête) ; les namespaces `www.w3.org` sont
tolérés. La vraie barrière reste la CSP servie sur `/demos/*` : tout
chargement ou envoi vers un autre domaine est bloqué par le navigateur,
service workers compris. Limite résiduelle assumée : une CSP ne bloque pas
la _navigation_ (un lien ou `location.href` construit vers l'extérieur) —
d'où la relecture humaine de tout code de démo avant publication.
