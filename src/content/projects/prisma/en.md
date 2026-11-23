---
# English version of « prisma » — text only, shared data lives in fr.md.
# Claude drafts this from Arthur's French, Arthur reviews.
title: 'Prisma'
summary: 'A light sandbox: place lasers, then shape their beams with mirrors, prisms, lenses and filters — rainbow included.'
coverAlt: 'A white light beam crosses a triangular prism on a dark background and comes out as a rainbow fan aimed at a tilted wall, with the object toolbar on the left.'
aiNote: 'Built by directing an AI: I set the frame, tested and made the calls; it wrote most of the code.'
disclaimer: '“Prisma” is the name of this optics sandbox, unrelated to any existing software or product of the same name.'
---

## The idea

Everyone has seen the picture: a white beam enters a prism, a rainbow
comes out. I wanted to do it myself on screen — drop a laser, put a
prism in its path, and play with the result like on an optics bench,
with no rules and no goal.

## What it does

You place lasers, white or coloured, and shape their beams with five
families of objects: mirrors, prisms, converging or diverging lenses,
walls and colour filters. Everything is manipulated directly: drag an
object to move it, pull its round handle to aim it (or twist with two
fingers on mobile), and the beams recompute instantly. A laser's colour
is set with a wavelength slider, four ready-made scenes show what it can
do — rainbow, mirror corridor, focal point, colour mixing — and the
current scene is remembered from one visit to the next. Everything is
keyboard-operable too.

## Under the hood

On every change, each beam is traced bounce after bounce: reflection on
mirrors, refraction through glass by Snell's law, total internal
reflection included. Colours are not mere tints: every ray carries a
wavelength (400 to 680 nm), and the glass's refractive index depends on
it — that is what dispersion is. A white ray entering a prism is
sampled into sixteen spectral rays that naturally fan out; a red laser,
on the other hand, goes through without splitting, just like in real
life. Lenses are genuine circular surfaces, so spherical aberration is
visible. The neon look is drawn on a canvas with additive blending,
redrawn only when the scene changes. Zero bundled libraries: plain
JavaScript, with Vite only there to build the files.

## What I learned or decided

The real subject of the project is the gap between exact physics and
what reads well on screen. Real glass disperses too little to be
appreciated on a display: I exaggerated it (about twofold) so the
prism's fan stays spectacular. Same logic for energy: the dispersed fan
is deliberately overexposed, otherwise sixteen rays sharing the
intensity of one become invisible against the dark background.
Conversely, I kept the true Snell's law and true lens surfaces: their
flaws (spherical aberration) are part of what the demo wants to show.
And the local save validates everything it reloads, so a corrupted
scene can never break the engine.

## Known limits

The physics is simplified where it barely shows: no partial reflections
(a ray entering glass goes in entirely, whereas in reality part of it
bounces off), filters with approximated transmission, and two
overlapping glass objects produce fanciful paths. The displayed
intensity is not true energy conservation — it is a visual choice, not
a measurement. Finally, on a small touch screen, hitting the rotation
handle precisely takes some patience; two-finger rotation works better.
