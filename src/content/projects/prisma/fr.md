---
# Fiche projet « prisma » — le français fait foi. Les données partagées
# (date, stack, liens, image) vivent ici ; en.md ne contient que le
# texte anglais. Champs commentés = optionnels.
title: 'Prisma'
summary: 'Un bac à sable de lumière : on place des lasers, puis on sculpte leurs rayons avec des miroirs, des prismes, des lentilles et des filtres — arc-en-ciel compris.'
date: 2026-11-23
status: done # wip | done | archived
kind: web # web | game | desktop | mod | tool
stack:
  - JavaScript
  - Canvas 2D
  - Vite
demo: internal # la démo vit dans demos/prisma/
links:
  repo: 'https://github.com/Arthur-Lecomte/Prisma'
cover: ./cover.png
coverAlt: "Un rayon de lumière blanche traverse un prisme triangulaire sur fond sombre et ressort en éventail arc-en-ciel vers un mur incliné, avec la barre d'outils d'objets sur la gauche."
featured: false
draft: false # publié le 2026-11-23 sur décision d'Arthur
thirdParty: [] # rien d'embarqué : JavaScript pur, icônes SVG et styles faits main
aiNote: "Projet réalisé en dirigeant une IA : j'ai cadré, testé et tranché ; elle a écrit le gros du code."
disclaimer: '« Prisma » est le nom de ce bac à sable optique, sans lien avec aucun logiciel ou produit existant du même nom.'
---

## L'idée

Tout le monde a vu l'image : un rayon blanc entre dans un prisme, un
arc-en-ciel en sort. Je voulais pouvoir le faire moi-même à l'écran —
poser un laser, mettre un prisme sur son chemin, et jouer avec le
résultat comme sur une table d'optique, sans règle ni objectif.

## Ce que ça fait

On place des lasers, blancs ou colorés, et on sculpte leurs rayons avec
cinq familles d'objets : miroirs, prismes, lentilles convergentes ou
divergentes, murs et filtres colorés. Tout se manipule directement : on
fait glisser un objet pour le déplacer, on tire sa poignée ronde pour
l'orienter (ou on tourne à deux doigts sur mobile), et les rayons se
recalculent instantanément. La couleur d'un laser se règle avec un
curseur de longueur d'onde, quatre scènes toutes prêtes montrent ce que
ça sait faire — arc-en-ciel, couloir de miroirs, point de focale,
mélange de couleurs — et la scène en cours est retenue d'une visite à
l'autre. Tout est aussi pilotable au clavier.

## Sous le capot

À chaque modification, chaque rayon est tracé rebond après rebond :
réflexion sur les miroirs, réfraction par la loi de Snell dans le verre,
réflexion totale interne comprise. Les couleurs ne sont pas de simples
teintes : chaque rayon porte une longueur d'onde (400 à 680 nm), et
l'indice du verre en dépend — c'est ça, la dispersion. Un rayon blanc
qui entre dans un prisme est échantillonné en seize rayons spectraux qui
se séparent naturellement en éventail ; un laser rouge, lui, traverse
sans se décomposer, comme en vrai. Les lentilles sont de vraies surfaces
circulaires, donc l'aberration sphérique se voit. Le rendu néon est
dessiné sur un canvas en mélange additif, redessiné uniquement quand la
scène change. Zéro bibliothèque embarquée : du JavaScript pur, Vite ne
sert qu'à construire les fichiers.

## Ce que j'ai appris ou décidé

Le vrai sujet du projet, c'est l'écart entre la physique exacte et ce
qui est lisible à l'écran. La dispersion du verre réel est trop faible
pour s'apprécier sur un écran : je l'ai exagérée (environ deux fois) pour
que l'éventail du prisme reste spectaculaire. Même logique sur l'énergie :
l'éventail dispersé est volontairement surexposé, sinon seize rayons qui
se partagent l'intensité d'un seul deviennent invisibles sur fond sombre.
À l'inverse, j'ai gardé la vraie loi de Snell et les vraies surfaces de
lentilles : leurs défauts (l'aberration sphérique) font partie de ce
qu'on veut montrer. Et la sauvegarde locale vérifie tout ce qu'elle
recharge, pour qu'une scène corrompue ne casse jamais le moteur.

## Limites connues

La physique est simplifiée là où ça se voit peu : pas de réflexions
partielles (un rayon qui entre dans le verre y passe entièrement, alors
qu'en vrai une partie se reflète), filtres à transmission approchée, et
deux objets en verre qui se chevauchent produisent des trajets
fantaisistes. L'intensité affichée n'est pas une vraie conservation
d'énergie — c'est un choix d'image, pas de mesure. Enfin, sur un petit
écran tactile, viser précisément la poignée de rotation demande un peu
de patience ; la rotation à deux doigts marche mieux.
