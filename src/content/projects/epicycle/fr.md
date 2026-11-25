---
# Fiche projet « epicycle » — le français fait foi. Les données partagées
# (date, stack, liens, image) vivent ici ; en.md ne contient que le
# texte anglais. Champs commentés = optionnels.
title: 'Épicycle'
summary: "On dessine une forme d'un seul trait, et une chaîne de cercles qui tournent la redessine en boucle — plus il y a de cercles, plus c'est fidèle."
date: 2026-11-24
status: done # wip | done | archived
kind: web # web | game | desktop | mod | tool
stack:
  - JavaScript
  - Canvas 2D
  - Vite
demo: internal # la démo vit dans demos/epicycle/
links:
  repo: 'https://github.com/Arthur-Lecomte/Epicycles'
cover: ./cover.png
coverAlt: "Démo sur fond sombre : un grand cœur au trait doré, aux trois quarts retracé par la machine à cercles — une grappe de petits cercles gris marque le stylo en cours de course — au-dessus des curseurs Cercles et Vitesse et des boutons d'exemples Croche, Étoile, Cœur et Éclair."
featured: false
draft: false # publié le 2026-11-24 sur décision d'Arthur
thirdParty: [] # rien d'embarqué : JavaScript pur, formes d'exemple générées par le code
aiNote: "Projet réalisé en dirigeant une IA : j'ai cadré, testé et tranché ; elle a écrit le gros du code."
---

## L'idée

Il existe une famille d'animations hypnotiques où des cercles qui
tournent, accrochés les uns aux autres, finissent par dessiner un
visage ou une signature. Derrière le tour de magie, un outil très
sérieux : la transformée de Fourier, celle qui sert tous les jours à
compresser la musique et les images. Je voulais ma propre version, où
on ne subit pas la figure imposée : on dessine ce qu'on veut, et la
machine à cercles le rejoue.

## Ce que ça fait

On trace une forme d'un seul trait, à la souris ou au doigt. Dès qu'on
relâche, une chaîne de cercles en rotation prend le relais : le bout de
la chaîne repasse sur le dessin, en boucle, pendant que l'original
reste en filigrane. Un curseur règle le nombre de cercles, de 1 à
200 — avec trois cercles on obtient une patate, avec cinquante les
angles apparaissent — et un autre la vitesse. On peut masquer les
cercles pour ne garder que le trait doré, ou partir d'une des quatre
formes d'exemple (croche, étoile, cœur, éclair) sans rien dessiner.
Un volet « Comment ça marche ? » explique le principe sans formule, et
la réponse courte est dans le nom : un cercle porté par un autre
cercle, c'est ce que les astronomes anciens appelaient un épicycle.

## Sous le capot

Le trait est rééchantillonné en 512 points réguliers le long de la
boucle fermée, puis décomposé par transformée de Fourier discrète.
Le terme de fréquence nulle devient un décalage fixe — le centre de
gravité du dessin — et les autres sont triés par amplitude
décroissante : « les N premiers cercles » sont toujours les N plus
utiles. À chaque coup de curseur, le tracé reconstruit est précalculé
une fois pour toutes ; l'animation ne fait que le parcourir. Toute la
géométrie vit dans un espace normalisé, indépendant de l'écran : un
redimensionnement ne recalcule rien. Et la scène a beau être animée par
nature, elle s'arrête proprement dès qu'on ne la voit plus — onglet
caché, canvas hors de l'écran, préférence pour les animations
réduites — avec zéro redessin au repos.

## Ce que j'ai appris ou décidé

Le piège était d'avoir deux codes qui doivent tomber d'accord au pixel
près : le stylo vivant au bout de la chaîne, et le tracé précalculé
qu'il est censé suivre. La même formule vit donc aux deux endroits,
avec un commentaire de chaque côté qui interdit d'en toucher une sans
l'autre. Les tests sur téléphone ont aussi appris l'humilité : un
éclair dessiné d'un geste vif ne produit qu'une poignée de points, et
la première version le rejetait — le seuil est passé de huit points à
quatre, c'est la taille du dessin qui fait le tri. Enfin, un détail
auquel je tenais : la démo ne doit jamais être vide, alors une croche
tourne déjà à l'arrivée.

## Limites connues

Une forme, c'est un seul trait fermé : pas moyen de dessiner en
plusieurs fois, le point où on lève le doigt est relié au point de
départ. Les angles vifs restent le point faible des cercles — autour
d'une pointe d'étoile, le trait ondule légèrement tant qu'on n'ajoute
pas de cercles, c'est la rançon mathématique de l'exercice. Et le
dessin à main levée se fait uniquement à la souris ou au doigt : pas
d'alternative au clavier pour ce geste-là, les formes d'exemple et tous
les réglages restant, eux, pilotables au clavier.
