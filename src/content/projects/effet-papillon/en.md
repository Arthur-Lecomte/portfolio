---
# English version of « effet-papillon » — text only, shared data lives in fr.md.
# Claude drafts this from Arthur's French, Arthur reviews.
title: 'Effet Papillon'
summary: 'Pendulums released from almost the same spot: at first they dance together, a few seconds later each goes its own way. The butterfly effect, live.'
coverAlt: 'Demo on a dark background: ten nearly identical double pendulums, their still-overlapping trails drawing a ribbon fading from turquoise to pink, while one pendulum that has already diverged traces its own wide purple loops; at the bottom, the Pause and Reset buttons and the settings sliders.'
aiNote: 'Built by directing an AI: I set the frame, tested and made the calls; it wrote most of the code.'
---

## The idea

Everyone knows the line: a butterfly flaps its wings in Brazil, a storm
hits Texas. But it gets quoted far more often than it gets seen. The
double pendulum is the simplest object that actually shows it: two
rods, two masses, and behaviour that is impossible to predict. I wanted
people to witness it for themselves: launch several nearly identical
pendulums and watch the "nearly" change everything.

## What it does

A handful of double pendulums — from 2 to 30 — start from the same
position, give or take a hair: an adjustable offset, down to a
hundred-millionth of a radian. At first they overlap so perfectly you
would swear there is only one; then the coloured trails split apart,
and each goes into its own dance. Below the scene, a curve tracks the
gap between pendulums over time, on a logarithmic scale: a rising
straight line, the signature of chaos. You pick the starting position
by grabbing a mass with the mouse or a finger — or entirely with the
keyboard, arrow keys included — and you adjust the number of pendulums,
the initial offset and the speed live. Settings are remembered from one
visit to the next.

## Under the hood

The classic double-pendulum equations, integrated with fourth-order
Runge-Kutta at a fixed step of 1/240 s: precise enough that the
displayed divergence comes from chaos, not from numerical error. The
initial offset only affects the upper arm's angle, spread symmetrically
around the chosen position. The curve plots the maximum distance
between the pendulum tips, in metres; the full history fits in memory
by progressively halving the sampling rate. Rendering follows the "on
demand" rule: paused or idle, zero repaints — a render counter is even
exposed in the console to check it. And no autoplay for anyone who
prefers reduced motion.

## What I learned or decided

The project's trick question: when two trajectories drift apart, is it
chaos or numerical imprecision? Hence the careful fixed-step
integrator: every pendulum suffers exactly the same numerical errors,
so what separates them really is their starting conditions. I also
chose to offset only the upper arm's angle: it is the simplest
perturbation to explain, and it is enough. Finally, the graph's
logarithmic scale is not a gimmick: on a linear scale you would only
see a flat curve that suddenly blows up; in log, the exponential
divergence becomes a straight line, readable from the very first
seconds.

## Known limits

The pendulum is ideal: no friction, no air — energy never dissipates
and the dance never stops on its own. The divergence curve eventually
plateaus: once the pendulums are fully decorrelated, the distance
between them cannot exceed their reach. And past a few seconds, the
displayed trajectory is no longer "the true one" in the strict sense —
no computer can follow a chaotic system exactly — but that is precisely
what the demo is about.
