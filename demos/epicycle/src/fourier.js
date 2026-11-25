// Discrete Fourier transform of a closed 2D path, for the epicycle machine.
//
// All geometry lives in a shared normalized space: origin at the canvas
// centre, y pointing down, 1 unit = min(canvas width, height). Rendering
// applies the transform, so a window resize never forces a recompute.

export const SAMPLES = 512; // points per resampled path and per trail

// Resample a polyline into `count` points evenly spaced along the closed
// loop (the last point connects back to the first). Returns null for a
// degenerate (zero-length) input.
export function resampleClosed(points, count = SAMPLES) {
  const n = points.length;
  const lengths = [0];
  let total = 0;
  for (let i = 1; i <= n; i++) {
    const a = points[i - 1];
    const b = points[i % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(total);
  }
  if (total === 0) return null;

  const out = new Array(count);
  let seg = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    while (lengths[seg + 1] < target) seg++;
    const a = points[seg];
    const b = points[(seg + 1) % n];
    const span = lengths[seg + 1] - lengths[seg];
    const t = span > 0 ? (target - lengths[seg]) / span : 0;
    out[i] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return out;
}

// Full DFT of the resampled path (points as complex numbers x + iy).
// Returns the zero-frequency term apart — it is the path's centre of mass,
// a fixed offset rather than a rotating circle — and the remaining terms
// sorted by amplitude, so "the first N circles" is always the best N.
export function analyse(points) {
  const n = points.length;
  const terms = [];
  let offset = { x: 0, y: 0 };
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const phi = (-2 * Math.PI * k * i) / n;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      re += points[i].x * c - points[i].y * s;
      im += points[i].x * s + points[i].y * c;
    }
    re /= n;
    im /= n;
    if (k === 0) {
      offset = { x: re, y: im };
    } else {
      terms.push({
        freq: k <= n / 2 ? k : k - n,
        amp: Math.hypot(re, im),
        phase: Math.atan2(im, re),
      });
    }
  }
  terms.sort((a, b) => b.amp - a.amp);
  return { offset, terms };
}

// Path traced by the chain tip over one full period, keeping only the
// first `count` circles. Cheap enough to recompute on every slider move.
export function reconstructPath({ offset, terms }, count, samples = SAMPLES) {
  const used = Math.min(count, terms.length);
  const out = new Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    let x = offset.x;
    let y = offset.y;
    for (let k = 0; k < used; k++) {
      // Must match the term evaluation in drawChain (main.js), or the live
      // pen drifts off this precomputed trail.
      const phi = 2 * Math.PI * terms[k].freq * t + terms[k].phase;
      x += terms[k].amp * Math.cos(phi);
      y += terms[k].amp * Math.sin(phi);
    }
    out[i] = { x, y };
  }
  return out;
}
