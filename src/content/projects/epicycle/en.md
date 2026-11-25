---
# English version of « epicycle » — text only, shared data lives in fr.md.
# Claude drafts this from Arthur's French, Arthur reviews.
title: 'Épicycle'
summary: 'Draw a shape in one stroke, and a chain of spinning circles redraws it on a loop — the more circles, the closer it gets.'
coverAlt: 'Demo on a dark background: a large golden-line heart, three quarters retraced by the circle machine — a cluster of small grey circles marks the pen mid-run — above the Circles and Speed sliders and the example buttons (eighth note, star, heart, lightning bolt).'
aiNote: 'Built by directing an AI: I set the frame, tested and made the calls; it wrote most of the code.'
---

## The idea

There is a family of hypnotic animations where spinning circles, hooked
one to the next, end up drawing a face or a signature. Behind the magic
trick sits a very serious tool: the Fourier transform, the one used
every day to compress music and images. I wanted my own version, where
you are not stuck with a set piece: you draw whatever you want, and the
circle machine plays it back.

## What it does

You draw a shape in a single stroke, with the mouse or a finger. The
moment you let go, a chain of rotating circles takes over: the tip of
the chain retraces your drawing, on a loop, while the original stays as
a faint watermark. One slider sets the number of circles, from 1 to
200 — with three circles you get a blob, with fifty the corners show
up — and another sets the speed. You can hide the circles to keep only
the golden line, or start from one of four example shapes (eighth note,
star, heart, lightning bolt) without drawing anything. A "How does it
work?" fold explains the principle without formulas, and the short
answer is in the name: a circle riding on another circle is what
ancient astronomers called an epicycle.

## Under the hood

The stroke is resampled into 512 evenly spaced points along the closed
loop, then decomposed by a discrete Fourier transform. The
zero-frequency term becomes a fixed offset — the drawing's centre of
gravity — and the rest are sorted by decreasing amplitude: "the first N
circles" are always the N most useful ones. On every slider move, the
reconstructed path is precomputed once and for all; the animation
merely walks along it. All the geometry lives in a normalized space,
independent of the screen: resizing recomputes nothing. And animated by
nature as the scene is, it stops cleanly as soon as nobody can see
it — hidden tab, canvas scrolled away, reduced-motion preference — with
zero repaints at rest.

## What I learned or decided

The trap was having two pieces of code that must agree to the pixel:
the live pen at the tip of the chain, and the precomputed path it is
supposed to follow. So the same formula lives in both places, with a
comment on each side forbidding anyone to touch one without the other.
Testing on a phone also taught some humility: a lightning bolt drawn
with a quick flick yields only a handful of points, and the first
version rejected it — the threshold went from eight points down to
four, and the drawing's size does the real sorting. Finally, a detail I
cared about: the demo must never be empty, so an eighth note is already
spinning when you arrive.

## Known limits

A shape is one closed stroke: no drawing in several passes — the point
where you lift your finger gets joined back to the start. Sharp corners
remain the circles' weak spot: around a star's tip, the line wobbles
slightly until you add more circles — that is the mathematical price of
the exercise. And freehand drawing is mouse- or finger-only: no
keyboard alternative for that one gesture, while the example shapes and
every control remain fully keyboard-operable.
