# Mise en ligne — guide pas à pas (phase 8, ARRÊT 4)

Toi aux commandes de tes comptes, Claude à côté. Ordre conçu pour qu'à
aucun moment une étape ne dépende d'une étape suivante. Coche au fur et
à mesure.

## 0. Avant de commencer

- [ ] Version « web » du CV (sans téléphone, sans adresse, sans photo)
      déposée dans `public/` et `site.cv.fr` renseigné dans `src/data/site.ts`.
- [ ] Identité complète (nom, prénoms, adresse, téléphone) exacte dans les
      comptes OVH **et** Cloudflare — condition du régime LCEN
      (docs/juridique.md, point 2).
- [ ] 2FA activée sur : GitHub, OVH, Cloudflare.
- [ ] `npm run build` vert en local, aucun `TODO(arthur)` restant.

## 1. Repo GitHub

1. Sur github.com : nouveau dépôt **public** nommé `portfolio`, sans README
   ni licence (tout existe déjà en local). Compte : Arthur-Lecomte.
2. En local :
   ```
   git remote add origin https://github.com/Arthur-Lecomte/portfolio.git
   git push -u origin main
   ```
3. Vérifie sur GitHub : `_prive/`, `CLAUDE.md` et `.claude/` sont ABSENTS ;
   la licence détectée est MIT ; l'e-mail des commits est l'adresse noreply.

## 2. Outil `gh` (pour que Claude gère les PR ensuite)

1. Installe GitHub CLI : https://cli.github.com (installeur Windows).
2. Dans un terminal : `gh auth login` → GitHub.com → HTTPS → navigateur.
3. Vérifie : `gh auth status`.

## 3. Protection de `main`

Sur GitHub → Settings → Branches → Add branch ruleset :

- Target : `main` ; Enforcement : Active.
- Cocher « Require status checks to pass » et sélectionner le check **CI /
  build** (il apparaît après le premier push).
- Ne PAS exiger de relecture par une autre personne (tu travailles seul).
- Cocher « Block force pushes » (et rien d'autre d'exotique).

## 4. Cloudflare : le site

Cloudflare recommande les **Workers** (static assets) pour les nouveaux
sites — c'est ce que ce repo attend (`public/_headers` y est géré nativement).

Vécu du 20/11/2026 : l'assistant « Créer une application → Importer un
dépôt » peut échouer avec « This Worker does not exist on this account »
après avoir créé le Worker mais AVANT d'avoir relié GitHub. Pas grave —
le chemin fiable passe par les paramètres du Worker :

1. Si l'assistant a planté : Workers et Pages → `portfolio` →
   Paramètres → **Compilations** → « Référentiel Git : Se connecter » →
   GitHub → limite l'accès au seul dépôt `portfolio` → branche de
   production `main`.
2. Configuration de build :
   - Commande de build : `npm run build`
   - Déployer la commande : `npx wrangler deploy`
3. La connexion ne construit PAS l'existant : le build part au push
   suivant sur `main` (une fusion de PR suffit).
4. Premier déploiement : activer l'URL `*.workers.dev` (onglet
   Domaines) puis vérifier — pages FR, /en/, une page légale, et les
   en-têtes (F12 → Network → Headers : une seule
   `Content-Security-Policy`).
   Le `wrangler.jsonc` du dépôt décrit déjà les assets (`./dist`).

## 5. Le domaine `arthurlecomte.fr`

Cloudflare ne gère pas les `.fr` en tant que registrar : le domaine RESTE
chez OVH, seul le DNS passe chez Cloudflare.

1. Cloudflare → Add a domain → `arthurlecomte.fr` → plan Free → il affiche
   deux serveurs de noms (ex. `xxx.ns.cloudflare.com`).
2. Chez OVH → Zone DNS / Serveurs DNS → remplace les NS par ceux de
   Cloudflare. (Propagation : de quelques minutes à 24 h.)
3. Cloudflare → ton Worker → Settings → Domains & Routes → ajoute
   `arthurlecomte.fr` (et `www.arthurlecomte.fr` en redirection si proposé).
4. Teste : `https://arthurlecomte.fr` affiche l'accueil **français**.

## 6. DNSSEC

1. Cloudflare → ton domaine → DNS → Settings → **Enable DNSSEC** → il
   affiche un enregistrement **DS**.
2. Chez OVH → domaine → DNSSEC → ajoute ce DS tel quel.
3. Quelques heures plus tard, Cloudflare doit afficher « DNSSEC active ».

## 7. E-mail : `contact@arthurlecomte.fr`

Réception seule (répondre partira de ta boîte perso — tes correspondants
verront alors ton adresse personnelle, c'est le compromis choisi).

1. Cloudflare → ton domaine → Email → Email Routing → Enable.
2. Crée la règle : `contact@arthurlecomte.fr` → ton adresse perso →
   clique le mail de confirmation reçu sur ta boîte perso.
3. Laisse Cloudflare créer les enregistrements MX et SPF proposés
   (`v=spf1 include:_spf.mx.cloudflare.net ~all` — NE PAS le remplacer).
4. Anti-usurpation (personne ne doit pouvoir écrire « de » ton domaine) :
   DNS → Add record → TXT, nom `_dmarc`, valeur :
   `v=DMARC1; p=reject; rua=mailto:contact@arthurlecomte.fr`
   (pas de DKIM à créer : le domaine n'envoie jamais de mail).
5. Test : envoie un mail depuis ta boîte perso vers
   `contact@arthurlecomte.fr` → il doit arriver chez toi. Réponds-toi
   pour vérifier le chemin complet.

## 8. Vérifications finales de l'ARRÊT 4

- [ ] `https://arthurlecomte.fr` → accueil FR, `/en/` → accueil EN.
- [ ] WHOIS du domaine (whois.afnic.fr) : ton adresse n'apparaît pas
      (« diffusion restreinte » automatique pour les particuliers).
- [ ] DevTools → Application → Cookies : zéro cookie.
- [ ] Une PR de test : la CI tourne, une URL de preview apparaît, la
      fusion n'est possible que CI verte.
- [ ] docs/juridique.md : items 1 à 4 de la checklist cochés.

Ensuite : phase 9, audit complet du site en ligne.
