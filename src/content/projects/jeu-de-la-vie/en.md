---
# English version of « jeu-de-la-vie » — text only, shared data lives in fr.md.
# Claude drafts this from Arthur's French, Arthur reviews.
title: 'Game of Life'
summary: "Conway's Game of Life on an edgeless grid: draw cells, drop in classic structures, and watch the colony evolve."
coverAlt: 'A Gosper gun in full swing on the dark Game of Life grid, with the pattern library on the left and the population counters at the bottom.'
aiNote: 'Built by directing an AI: I set the frame, tested and made the calls; it wrote most of the code.'
disclaimer: "“Game of Life” here means John Conway's cellular automaton (1970), unrelated to any board game of the same name."
---

## The idea

After the Rubik's Cube, another classic: Conway's Game of Life. Two
rules, no player, and structures that seem alive. I wanted the version
you feel like poking at: a grid genuinely without edges, where you move
around like on a map.

## What it does

An infinite grid where every cell is alive or dead. You draw cells with
the mouse or a finger (going over them again erases), or drop in one of
the ten classic structures from the library — glider, pulsar, Gosper
gun… — with a ghost preview before you click. You zoom with the wheel or
a pinch, pan by dragging, and live counters track the population, births
and deaths at every generation. Play, pause, single step, speed from 1
to 60 generations per second, random fill with adjustable density: it
all works from the keyboard too, and a help panel explains the rules.
When you arrive, a Gosper gun is already running — unless your system
asks for reduced motion.

## Under the hood

No two-dimensional array: the grid is a set of live cells keyed by their
coordinates, so the world has no edges and a nearly empty grid costs
nearly nothing. Each generation counts the neighbours of only the cells
that matter and applies the two rules. Rendering is drawn on a canvas
with a free camera (zoom, pan, two-finger pinch), and the animation loop
caps how many generations are computed per frame so the page never
freezes. Zero bundled libraries: plain JavaScript, with Vite only there
to build the files. Patterns are described as ASCII art in the code —
one “O” per live cell, readable as they are.

## What I learned or decided

The choice that drives everything else: storing only the live cells
rather than a fixed-size grid. That is what makes the world infinite,
and it is also simpler to write. The rest are guard rails settled by
testing: random fill only seeds the visible area (capped) so the machine
never drowns, the simulation drops generations rather than freezing when
the colony explodes, and the page honours the system's "reduce motion"
preference.

## Known limits

The engine recounts neighbours every generation: fine up to a few tens
of thousands of cells, but far from the specialised algorithms
(Hashlife) that simulate millions of generations at once. Nothing is
saved: reload the page and you are back to the Gosper gun — by design,
the demo stores nothing at all. And on mobile, precisely drawing cells
is still more comfortable with a stylus than a finger.
