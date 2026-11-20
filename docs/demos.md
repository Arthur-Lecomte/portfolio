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
de dev (`npm run dev`). Il :

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
