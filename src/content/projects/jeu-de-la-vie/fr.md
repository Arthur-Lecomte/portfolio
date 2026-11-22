---
# Fiche projet « jeu-de-la-vie » — le français fait foi. Les données partagées
# (date, stack, liens, image) vivent ici ; en.md ne contient que le
# texte anglais. Champs commentés = optionnels.
title: 'Jeu de la vie'
summary: 'Le jeu de la vie de Conway sur une grille sans bords : on dessine des cellules, on pose des structures classiques, et on regarde la colonie évoluer.'
date: 2026-11-22
status: done # wip | done | archived
kind: web # web | game | desktop | mod | tool
stack:
  - JavaScript
  - Canvas 2D
  - Vite
demo: internal # la démo vit dans demos/jeu-de-la-vie/
links:
  repo: 'https://github.com/Arthur-Lecomte/Jeu-de-la-vie'
cover: ./cover.png
coverAlt: 'Un canon de Gosper en pleine action sur la grille sombre du jeu de la vie, avec la bibliothèque de patterns à gauche et les compteurs de population en bas.'
featured: false
draft: true # SEUL Arthur passe cette ligne à false — publier est sa décision
thirdParty: [] # rien d'embarqué : JavaScript pur, interface en polices système
aiNote: "Projet réalisé en dirigeant une IA : j'ai cadré, testé et tranché ; elle a écrit le gros du code."
disclaimer: "Le « jeu de la vie » désigne ici l'automate cellulaire de John Conway (1970), sans lien avec aucun jeu de société du même nom."
---

## L'idée

Après le Rubik's Cube, un autre classique : le jeu de la vie de Conway.
Deux règles, pas de joueur, et des structures qui semblent vivantes. Je
voulais la version qu'on a envie de triturer : une grille vraiment sans
bords, où on navigue comme sur une carte.

## Ce que ça fait

Une grille infinie où chaque case est vivante ou morte. On dessine des
cellules à la souris ou au doigt (repasser dessus les efface), ou on pose
une des dix structures classiques de la bibliothèque — planeur, pulsar,
canon de Gosper… — avec un aperçu fantôme avant de cliquer. On zoome à la
molette ou au pincement, on se déplace en glissant, et des compteurs
suivent la population, les naissances et les morts à chaque génération.
Lecture, pause, pas à pas, vitesse de 1 à 60 générations par seconde,
remplissage aléatoire à densité réglable : tout se pilote aussi au
clavier, et un panneau d'aide explique les règles. À l'arrivée, un canon
de Gosper tourne déjà — sauf si le système demande de réduire les
animations.

## Sous le capot

Pas de tableau à deux dimensions : la grille est un ensemble de cellules
vivantes repérées par leurs coordonnées, donc le monde n'a pas de bords
et une grille presque vide ne coûte presque rien. À chaque génération,
on compte les voisines des seules cellules concernées et on applique les
deux règles. Le rendu est dessiné sur un canvas, caméra libre (zoom,
déplacement, pincement à deux doigts), et la boucle d'animation plafonne
le nombre de générations calculées par image pour ne jamais figer la
page. Zéro bibliothèque embarquée : du JavaScript pur, Vite ne sert
qu'à construire les fichiers. Les patterns sont décrits en ASCII art
dans le code — un « O » par cellule vivante, lisibles tels quels.

## Ce que j'ai appris ou décidé

Le choix qui commande tout le reste : stocker uniquement les cellules
vivantes plutôt qu'une grille de taille fixe. C'est ce qui rend le monde
infini, et c'est aussi plus simple à écrire. Le reste, ce sont des
garde-fous décidés en testant : le remplissage aléatoire se limite à la
zone visible (plafonnée) pour ne pas noyer la machine, la simulation
saute des générations plutôt que de geler quand la colonie explose, et
la page respecte la préférence « réduire les animations » du système.

## Limites connues

Le moteur recompte les voisines à chaque génération : parfait jusqu'à
quelques dizaines de milliers de cellules, mais loin des algorithmes
spécialisés (Hashlife) qui simulent des millions de générations d'un
coup. Rien n'est sauvegardé : on recharge la page, on repart du canon de
Gosper — c'est voulu, la démo ne stocke rien du tout. Et sur mobile, le
dessin précis de cellules reste plus confortable au stylet qu'au doigt.
