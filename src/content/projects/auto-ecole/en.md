---
# English version of « auto-ecole » — text only, shared data lives in fr.md.
# Claude drafts this from Arthur's French, Arthur reviews.
title: 'Auto-École'
summary: 'A driving school for virtual cars: nobody teaches them to drive, they figure it out — and every class drives a bit better than the last.'
coverAlt: 'Top-down view of a dark winding track: a line of small blue cars enters a bend, led by the yellow car of the best student with its distance sensors traced; on the right, the dashboard shows the class number, cars still on track and the school record.'
aiNote: 'Built by directing an AI: I set the frame, tested and made the calls; it wrote most of the code.'
---

## The idea

We hear everywhere that "AI learns", but we rarely get to watch it. I
wanted to show it literally: drop cars that know nothing onto a track,
let them drive off the road, and watch the school improve class after
class — no big machine-learning library, just selection.

## What it does

A class of student cars sets off on a top-down track. Each one senses
the road with five distance sensors and decides on its own how to steer
and accelerate; the clumsy ones leave the road, the best ones get
"children" that drive a little better. The dashboard tracks the current
class, the best run and the school record, and everything is adjustable
live: lesson speed (×1 to Max), class size, mutation boldness. You pick
one of three preset tracks, or draw your own freehand — it is checked,
then remembered from one visit to the next. A panel shows live what is
going on inside the head of the top of the class (its sensors, its
animated network) and the school's progress curve. And to see where it
all leads, an already-trained champion can take the track on each
preset circuit.

## Under the hood

Each car is driven by a tiny neural network: six inputs (five distance
sensors obtained by ray casting, plus speed), one hidden layer of eight
neurons, two outputs — steering and throttle. No backpropagation: a
genetic algorithm does all the learning. At the end of each class, the
best networks are kept as they are (elitism), the remaining seats are
filled by crossover between tournament-picked parents, then mutated
with Gaussian noise. The simulation is plain JavaScript with no access
to the page: the same code runs in the browser and in the repo's Node
tools, which pre-train the champions embedded in the demo. Rendering
follows the "on demand" rule: a paused scene never repaints, and Max
mode advances the simulation by time budget rather than by frame count.

## What I learned or decided

The hard part was not the algorithm, it was making it watchable. Hence
the driving-school metaphor: students, classes, school record — with
the real technical term as a subtitle every time, so it stays honest
without losing anyone. The embedded champions are not simply the top
scores: they are selected for their robustness to small perturbations
of the start, so they drive the same from one browser to the next. The
track editor took several iterations: a too-tight stroke is
reinterpreted rather than rejected, and a self-crossing loop is refused
with a clear message. Finally, the local save re-checks every track on
reload — a corrupted drawing is discarded instead of breaking the demo.

## Known limits

The driving is deliberately arcade: no real car physics (no drift, no
realistic braking) — what matters is the learning, not the simulator.
Evolution stays capricious: two sessions on the same track do not
progress at the same pace, and a school can stall for several classes
before cracking a corner. "Max" speed depends on the machine, since it
advances the simulation as long as there is time left in the frame. And
drawing a track is mouse- or finger-only — no keyboard alternative for
that one gesture, while the rest of the demo remains fully
keyboard-operable.
