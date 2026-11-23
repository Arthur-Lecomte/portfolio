---
# Fiche projet « effet-papillon » — le français fait foi. Les données partagées
# (date, stack, liens, image) vivent ici ; en.md ne contient que le
# texte anglais. Champs commentés = optionnels.
title: 'Effet Papillon'
summary: "Des pendules lâchés presque du même point : au début ils dansent ensemble, quelques secondes plus tard chacun fait sa vie. L'effet papillon, en direct."
date: 2026-11-23
status: done # wip | done | archived
kind: web # web | game | desktop | mod | tool
stack:
  - JavaScript
  - Canvas 2D
  - Vite
demo: internal # la démo vit dans demos/effet-papillon/
links:
  repo: 'https://github.com/Arthur-Lecomte/Effet-Papillon'
cover: ./cover.png
coverAlt: "Démo sur fond sombre : dix pendules doubles presque identiques, dont les traînées encore superposées dessinent un ruban dégradé du turquoise au rose, tandis qu'un pendule déjà divergé trace à part de grandes boucles violettes ; en bas, les boutons Pause et Relancer et les curseurs de réglage."
featured: false
draft: false # publié le 2026-11-24 sur décision d'Arthur
thirdParty: [] # rien d'embarqué : JavaScript pur, tout est dessiné au canvas
aiNote: "Projet réalisé en dirigeant une IA : j'ai cadré, testé et tranché ; elle a écrit le gros du code."
---

## L'idée

Tout le monde connaît la formule : un battement d'ailes de papillon au
Brésil, une tempête au Texas. Mais on la cite plus souvent qu'on ne la
voit. Le double pendule est l'objet le plus simple qui la montre pour de
vrai : deux tiges, deux masses, et un comportement impossible à prédire.
Je voulais qu'on puisse le constater soi-même : lancer plusieurs
pendules quasi identiques et regarder le « quasi » tout changer.

## Ce que ça fait

Une poignée de pendules doubles — de 2 à 30 — partent de la même
position, à un cheveu près : un écart réglable, jusqu'au
cent-millionième de radian. Au début ils se superposent si bien qu'on
croit n'en voir qu'un ; puis les traînées colorées se séparent, et
chacun part dans sa propre danse. Sous la scène, une courbe suit
l'écart entre les pendules au fil du temps, en échelle logarithmique :
une droite qui monte, c'est la signature du chaos. On choisit la
position de départ en attrapant une masse à la souris ou au doigt — ou
entièrement au clavier, flèches comprises — et on règle en direct le
nombre de pendules, l'écart initial et la vitesse. Les réglages sont
retenus d'une visite à l'autre.

## Sous le capot

Les équations classiques du double pendule, intégrées en Runge-Kutta
d'ordre 4 à pas fixe de 1/240 s : assez précis pour que la divergence
affichée vienne du chaos, pas des erreurs de calcul. L'écart initial ne
porte que sur l'angle du bras supérieur, réparti symétriquement autour
de la position choisie. La courbe trace la distance maximale entre les
bouts des pendules, en mètres ; l'historique complet tient en mémoire
en divisant progressivement l'échantillonnage par deux. Le rendu suit
la règle « à la demande » : en pause ou au repos, zéro redessin — un
compteur de rendus est exposé en console pour le vérifier. Et pas de
lecture automatique pour qui préfère réduire les animations.

## Ce que j'ai appris ou décidé

La question piège du projet : quand deux trajectoires s'écartent,
est-ce le chaos ou l'imprécision du calcul ? D'où l'intégrateur soigné
à pas fixe : tous les pendules subissent exactement les mêmes erreurs
numériques, donc ce qui les sépare, ce sont bien leurs conditions de
départ. J'ai aussi choisi de ne décaler que l'angle du bras du haut :
c'est la perturbation la plus simple à expliquer, et elle suffit.
Enfin, l'échelle logarithmique du graphe n'est pas un gadget : en
échelle normale, on ne verrait qu'une courbe plate qui explose d'un
coup ; en log, la divergence exponentielle devient une droite, lisible
dès les premières secondes.

## Limites connues

Le pendule est idéal : pas de frottement, pas d'air — l'énergie ne se
dissipe jamais et la danse ne s'arrête pas toute seule. La courbe
d'écart finit par plafonner : une fois les pendules complètement
décorrélés, la distance entre eux ne peut pas dépasser leur envergure.
Et passé quelques secondes, la trajectoire affichée n'est plus « la
vraie » au sens strict — aucun ordinateur ne peut suivre exactement un
système chaotique — mais c'est précisément ce que la démo raconte.
