// Freehand track editor: the visitor draws the centerline in one stroke,
// we smooth it, close the loop, and validate drivability. Pointer events
// only (mouse, touch, pen); every visual change goes through
// requestRender — no polling, no free-running loop.

import { chaikinClosed, resampleClosed, validateCenterline, SAMPLE_SPACING } from '../sim/track.js';
import { WORLD } from '../tracks/presets.js';

export const CUSTOM_WIDTH = 46;
const MIN_PERIMETER = 500; // world px
const MAX_CLOSE_GAP_RATIO = 0.3; // stroke must end near its start

export function createEditor({ canvas, worldFromEvent, requestRender, onStatus, onDraftChange }) {
  const draft = {
    points: [],
    closed: false,
    badIndex: -1,
    width: CUSTOM_WIDTH,
    valid: false,
  };
  let drawing = false;
  let activePointer = -1; // a second finger must not corrupt the stroke

  function reset() {
    draft.points = [];
    draft.closed = false;
    draft.badIndex = -1;
    draft.valid = false;
    onDraftChange(false);
  }

  function onPointerDown(e) {
    if (!e.isPrimary || drawing) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort: drawing still works without it.
    }
    reset();
    drawing = true;
    activePointer = e.pointerId;
    draft.points.push(worldFromEvent(e));
    onStatus('Continuez la boucle et revenez au point de départ…');
    requestRender();
  }

  function onPointerMove(e) {
    if (!drawing || e.pointerId !== activePointer) return;
    const p = worldFromEvent(e);
    const last = draft.points[draft.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 4) return;
    draft.points.push(p);
    requestRender();
  }

  function onPointerUp(e) {
    if (!drawing || e.pointerId !== activePointer) return;
    drawing = false;
    activePointer = -1;
    finishStroke();
  }

  function perimeterOf(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return d;
  }

  // A freehand stroke rarely meets its own start tangentially: the hand
  // leads in, overshoots, or crosses its own line to close the loop
  // ("balloon on a string"). Find the closest approach between an early
  // point and a late point and keep only the arc between them — the
  // lead-in and the overshoot are both discarded, and the loop closes at
  // the natural crossing point.
  function trimToLoop(pts) {
    const n = pts.length;
    const headEnd = Math.floor(n * 0.4);
    const tailStart = Math.floor(n * 0.6);
    let bi = 0;
    let bj = n - 1;
    let bd = Infinity;
    for (let i = 0; i < headEnd; i++) {
      for (let j = tailStart; j < n; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bd) {
          bd = d2;
          bi = i;
          bj = j;
        }
      }
    }
    return pts.slice(bi, bj + 1);
  }

  // One local smoothing pass: pull the samples around `center` toward
  // their neighbours' midpoint. Circular indices; mutates `pts`.
  function relaxWindow(pts, center, half) {
    const n = pts.length;
    const src = pts.map((p) => ({ x: p.x, y: p.y }));
    for (let k = -half; k <= half; k++) {
      const i = (((center + k) % n) + n) % n;
      const a = src[(i - 1 + n) % n];
      const b = src[i];
      const c = src[(i + 1) % n];
      pts[i] = { x: b.x * 0.4 + (a.x + c.x) * 0.3, y: b.y * 0.4 + (a.y + c.y) * 0.3 };
    }
  }

  function finishStroke() {
    const pts = trimToLoop(draft.points);
    const perimeter = perimeterOf(pts);
    if (pts.length < 12 || perimeter < MIN_PERIMETER) {
      onStatus('Tracé trop court : dessinez une grande boucle d’un seul geste.');
      reset();
      requestRender();
      return;
    }
    const gap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    if (gap > perimeter * MAX_CLOSE_GAP_RATIO) {
      onStatus('Boucle ouverte : terminez votre tracé près de son départ.');
      reset();
      requestRender();
      return;
    }

    // Smooth the hand tremor, make the loop even, then REINTERPRET rather
    // than reject: while a curve is too tight for the road width (the
    // closing seam, a sharp corner, a hand wobble…), relax the samples
    // around it and try again. The working check uses a 10% width margin so
    // a corner, once fixed, cannot drift back under the real threshold when
    // resampling shifts the points. Validation always runs on rounded
    // coordinates — the stored track must pass the exact same check when
    // reloaded from localStorage.
    const MARGIN = 1.06;
    // One Chaikin pass only: enough to tame pointer jitter, light enough
    // to keep deliberate tight turns as drawn.
    let samples = resampleClosed(chaikinClosed(pts, 1), SAMPLE_SPACING);
    let rounded = null;
    let v = null;
    for (let round = 0; round < 200; round++) {
      rounded = samples.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
      const vm = validateCenterline(rounded, SAMPLE_SPACING, CUSTOM_WIDTH * MARGIN);
      if (vm.ok || vm.reason !== 'curve') {
        // Done smoothing (or a pinch, which smoothing cannot fix): the
        // verdict that counts is the one at the real road width.
        v = validateCenterline(rounded, SAMPLE_SPACING, CUSTOM_WIDTH);
        break;
      }
      v = vm;
      for (let pass = 0; pass < 3; pass++) relaxWindow(samples, vm.index, 8);
      samples = resampleClosed(samples, SAMPLE_SPACING);
    }
    if (v && !v.ok) {
      // Rounds exhausted mid-smoothing: give the real width a last word.
      const vs = validateCenterline(rounded, SAMPLE_SPACING, CUSTOM_WIDTH);
      if (vs.ok) v = vs;
    }

    draft.points = rounded;
    draft.closed = true;
    if (!v.ok) {
      draft.badIndex = v.index;
      draft.valid = false;
      const messages = {
        curve: 'Virage impossible à adoucir pour la largeur de la route (point rouge). Redessinez.',
        cross: 'La piste se croise au point rouge : redessinez sans croisement.',
        pinch: 'La piste se pince au point rouge : espacez les portions. Redessinez.',
      };
      onStatus(messages[v.reason]);
    } else {
      draft.badIndex = -1;
      draft.valid = true;
      onStatus('Beau circuit ! Validez-le, ou redessinez par-dessus.');
    }
    onDraftChange(draft.valid);
    requestRender();
  }

  function onPointerCancel(e) {
    if (e.pointerId !== activePointer) return;
    drawing = false;
    activePointer = -1;
    reset();
    requestRender();
  }

  function enter() {
    reset();
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    onStatus('Tracez une boucle fermée d’un seul geste (souris ou doigt).');
  }

  function exit() {
    drawing = false;
    activePointer = -1;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    reset();
  }

  // The validated centerline, ready to be stored (already integers).
  function takeCenterline() {
    return draft.points.slice();
  }

  return {
    draft,
    enter,
    exit,
    takeCenterline,
    worldBounds: () => ({ minX: 0, minY: 0, maxX: WORLD.w, maxY: WORLD.h }),
  };
}
