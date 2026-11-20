---
name: nouveau-projet
description: Intègre un projet terminé d'Arthur dans le portfolio — fiche, démo éventuelle, checklist « publiable ». Utiliser quand Arthur donne le chemin d'un projet à ajouter au site.
argument-hint: '[chemin-du-projet]'
---

# Intégrer un projet fini dans le portfolio

Arthur fournit le chemin d'un projet terminé : `$ARGUMENTS`.
Relis d'abord CLAUDE.md (règles) et docs/demos.md (règles des démos).

## Étapes

1. **Branche** : crée `content/<slug>` (slug kebab-case déduit du nom du projet,
   confirme-le à Arthur s'il est ambigu).
2. **Lecture** : lis le README et le code du projet fourni. Note : ce qu'il
   fait, la stack réelle, les dépendances embarquées et leurs licences, tout
   asset qui n'est pas d'Arthur.
3. **Fiche** : lance `npm run new:project -- <slug>` (ajoute `--demo` si démo
   web). Si démo : copie/adapte le projet dans `demos/<slug>/`, chemins
   relatifs, lien de retour vers `../../projets/<slug>/`, clés localStorage
   préfixées `<slug>:`, aucune requête externe (tout embarqué).
4. **Pré-remplissage** : remplis ce qui est factuel (date, status, kind,
   stack, liens, thirdParty complet avec licences). Laisse des `TODO(arthur)`
   pour ce qui relève de lui : l'idée, ses décisions, la note IA, le résumé.
   Ne rien inventer sur lui.
5. **Anglais** : UNE FOIS le français d'Arthur écrit, rédige `en.md` fidèle à
   son ton (ne pas lisser, ne pas ajouter d'humour).
6. **Checklist « publiable »** — vérifie et signale chaque échec à Arthur :
   - `npm run build` vert (schéma, démos, en-têtes, contenu) ;
   - règles des démos respectées (docs/demos.md) ; le scan du build doit
     passer sans avertissement localStorage ;
   - aucun secret, clé ou jeton dans le code copié ;
   - aucun asset, logo, nom de marque ou contenu d'un jeu/produit existant
     sans droit ; si projet inspiré d'une œuvre : champ `disclaimer` rempli ;
   - `thirdParty` complet, licences compatibles et créditées ;
   - captures : uniquement ses propres réalisations ;
   - cover réelle (pas le placeholder gris) avec `coverAlt` dans les 2 langues.
7. **Fin** : laisse `draft: true` (SEUL Arthur publie). Rappelle-lui que le
   brouillon est invisible sur le site mais lisible par tous sur GitHub.
   Dis-lui en deux lignes ce qu'il lui reste à écrire.
