---
# Fiche projet « auto-ecole » — le français fait foi. Les données partagées
# (date, stack, liens, image) vivent ici ; en.md ne contient que le
# texte anglais. Champs commentés = optionnels.
title: 'Auto-École'
summary: 'Une auto-école pour voitures virtuelles : personne ne leur apprend à conduire, elles se débrouillent — et chaque promotion fait mieux que la précédente.'
date: 2026-11-23
status: done # wip | done | archived
kind: web # web | game | desktop | mod | tool
stack:
  - JavaScript
  - Canvas 2D
  - Vite
demo: internal # la démo vit dans demos/auto-ecole/
links:
  repo: 'https://github.com/Arthur-Lecomte/Auto-Ecole'
cover: ./cover.png
coverAlt: "Vue de dessus d'un circuit sinueux sombre : une file de petites voitures bleues aborde un virage, menée par la voiture jaune du meilleur élève dont les capteurs de distance sont tracés ; à droite, le tableau de bord affiche la promotion, les voitures en piste et le record de l'école."
featured: false
draft: false # publié le 2026-11-23 sur décision d'Arthur
thirdParty: [] # rien d'embarqué : JavaScript pur, tout est dessiné au canvas
aiNote: "Projet réalisé en dirigeant une IA : j'ai cadré, testé et tranché ; elle a écrit le gros du code."
---

## L'idée

On entend partout que « l'IA apprend », mais on le voit rarement. Je
voulais le montrer au sens propre : lâcher sur un circuit des voitures
qui ne savent rien, les laisser sortir de la route, et regarder l'école
progresser promotion après promotion — sans grosse bibliothèque
d'apprentissage, juste de la sélection.

## Ce que ça fait

Une promotion de voitures-élèves s'élance sur un circuit vu de dessus.
Chacune perçoit la piste avec cinq capteurs de distance et décide seule
de tourner et d'accélérer ; les maladroites sortent de la route, les
meilleures ont des « enfants » qui conduisent un peu mieux. Le tableau
de bord suit la promotion en cours, le meilleur trajet et le record de
l'école, et on règle tout en direct : vitesse des leçons (×1 à Max),
taille des promotions, audace des mutations. On choisit parmi trois
circuits prédéfinis, ou on trace le sien à main levée — il est vérifié,
puis retenu d'une visite à l'autre. Un panneau montre en direct ce qui
se passe dans la tête du premier de la classe (ses capteurs, son réseau
animé) et la courbe de progression de l'école. Et pour voir où tout ça
mène, un champion déjà entraîné peut prendre la piste sur chaque circuit
prédéfini.

## Sous le capot

Chaque voiture est pilotée par un réseau de neurones minuscule : six
entrées (cinq capteurs de distance obtenus par lancer de rayons, plus la
vitesse), une couche cachée de huit neurones, deux sorties — volant et
gaz. Aucune rétropropagation : c'est un algorithme génétique qui fait
tout l'apprentissage. À la fin de chaque promotion, les meilleurs
réseaux sont gardés tels quels (élitisme), les autres places sont
remplies par croisement de parents choisis au tournoi, puis mutées au
bruit gaussien. La simulation est du JavaScript pur, sans accès à la
page : le même code tourne dans le navigateur et dans les outils Node du
repo, qui servent à pré-entraîner les champions embarqués dans la démo.
Le rendu suit la règle « à la demande » : une scène en pause ne se
redessine jamais, et le mode Max avance la simulation par budget de
temps plutôt que par nombre d'images.

## Ce que j'ai appris ou décidé

Le plus dur n'était pas l'algorithme, c'était de le rendre regardable.
D'où la métaphore de l'auto-école : élèves, promotions, record de
l'école — avec le vrai terme technique en sous-titre à chaque fois, pour
que ça reste honnête sans perdre personne. Les champions embarqués ne sont
pas simplement les meilleurs scores : ils sont sélectionnés pour leur
robustesse à de petites perturbations du départ, afin de rouler pareil
d'un navigateur à l'autre. L'éditeur de circuit a demandé plusieurs
itérations : un tracé trop serré est réinterprété plutôt que rejeté, et
une boucle qui se croise est refusée avec un message clair. Enfin, la
sauvegarde locale revérifie chaque circuit au rechargement — un tracé
corrompu est écarté plutôt que de casser la démo.

## Limites connues

La conduite est volontairement arcade : pas de vraie physique de
voiture (ni dérive, ni freinage réaliste) : ce qui compte, c'est
l'apprentissage, pas le simulateur. L'évolution reste capricieuse :
deux sessions sur le même circuit ne progressent pas à la même vitesse,
et une école peut stagner plusieurs promotions avant de débloquer un
virage. La vitesse « Max » dépend de la machine, puisqu'elle avance la
simulation tant qu'il reste du temps dans l'image. Et le tracé de
circuit se fait uniquement à la souris ou au doigt — pas d'alternative
au clavier pour ce geste-là, le reste de la démo restant entièrement
pilotable au clavier.
