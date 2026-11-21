---
# Fiche projet « cube-solver » — le français fait foi. Les données partagées
# (date, stack, liens, image) vivent ici ; en.md ne contient que le
# texte anglais. Champs commentés = optionnels.
title: "Rubik's Cube 3D"
summary: 'TODO(arthur): une phrase sans jargon qui dit ce que fait le projet, 160 max'
date: 2026-11-21
status: done # wip | done | archived
kind: web # web | game | desktop | mod | tool
stack:
  - JavaScript
  - three.js
  - Vite
demo: internal # la démo vit dans demos/cube-solver/
links:
  repo: 'https://github.com/Arthur-Lecomte/CubeSolver'
cover: ./cover.png # remplacer par une vraie image (le placeholder est gris)
coverAlt: "TODO(arthur): ce que montre l'image, pour qui ne la voit pas"
featured: false
draft: true # SEUL Arthur passe cette ligne à false — publier est sa décision
thirdParty:
  - name: three.js
    license: MIT
    url: 'https://github.com/mrdoob/three.js'
# aiNote: "TODO(arthur): ce que tu as décidé et fait toi-même sur ce projet"
disclaimer: "Projet personnel non officiel, sans lien avec Rubik's Brand Ltd ni Spin Master ; « Rubik's Cube » désigne ici le casse-tête."
---

## L'idée

TODO(arthur): pourquoi ce truc existe.

## Ce que ça fait

Un Rubik's Cube 3×3 en 3D dans le navigateur : on orbite autour du cube,
on attrape une tranche à la souris ou au doigt pour la tourner (elle se
recale au quart de tour le plus proche), ou on joue au clavier et aux
boutons de notation (U, U', D… B'). Un bouton mélange le cube (25 coups
animés), un autre le résout tout seul : la solution s'affiche en notation,
se lit coup par coup ou en continu, avec une vitesse réglable. L'état du
cube est retenu d'une visite à l'autre.

TODO(arthur): une capture.

## Sous le capot

La résolution utilise l'algorithme two-phase de Kociemba, implémenté from
scratch : modèle en cubies, coordonnées de phase, tables de pruning et
recherche IDA*. Le calcul tourne dans un Web Worker pour ne jamais figer
l'animation — les solutions font environ 20 coups et tombent en quelques
dizaines de millisecondes. Le rendu 3D est fait avec three.js (embarqué
au build, aucune requête externe) ; dans le repo du projet, un harnais
Node (`npm run verify`) rejoue 200 mélanges aléatoires et contrôle
chaque solution.

## Ce que j'ai appris ou décidé

TODO(arthur)

## Limites connues

TODO(arthur)
