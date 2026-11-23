// The three built-in tracks, as coarse closed centerlines in a 960x640
// world. buildTrack() smooths and resamples them.

export const WORLD = { w: 960, h: 640 };

// Oval-ish loop with optional radial sine modulation (lobes).
function loop(cx, cy, rx, ry, n, amp = 0, lobes = 0, phase = 0) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    const m = 1 + amp * Math.sin(lobes * a + phase);
    pts.push({ x: cx + Math.cos(a) * rx * m, y: cy + Math.sin(a) * ry * m });
  }
  return pts;
}

// Rounds every vertex of a closed polygon with an arc of radius r (reduced
// where the legs are too short), so sharp hand-laid corners stay drivable
// at a given road width. Returns a denser point list; no further smoothing
// needed before resampling.
function fillet(points, r) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const p = points[i];
    const next = points[(i + 1) % n];
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y);
    const outLen = Math.hypot(next.x - p.x, next.y - p.y);
    const ux = (p.x - prev.x) / inLen;
    const uy = (p.y - prev.y) / inLen;
    const vx = (next.x - p.x) / outLen;
    const vy = (next.y - p.y) / outLen;
    let turn = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const absTurn = Math.abs(turn);
    if (absTurn < 0.05) {
      out.push({ x: p.x, y: p.y });
      continue;
    }
    // Trim distance for radius r, clamped so neighbouring fillets never
    // overlap; the effective radius shrinks with it.
    let t = r * Math.tan(absTurn / 2);
    const tMax = 0.45 * Math.min(inLen, outLen);
    if (t > tMax) t = tMax;
    const re = t / Math.tan(absTurn / 2);
    const a0 = { x: p.x - ux * t, y: p.y - uy * t };
    // Arc center: offset from a0 perpendicular to the incoming direction,
    // on the inside of the turn.
    const side = Math.sign(turn);
    const cxn = a0.x - uy * re * side;
    const cyn = a0.y + ux * re * side;
    const startAng = Math.atan2(a0.y - cyn, a0.x - cxn);
    const steps = Math.max(2, Math.ceil(absTurn / 0.26)); // ~15° per step
    for (let s = 0; s <= steps; s++) {
      const a = startAng + turn * (s / steps);
      out.push({ x: cxn + Math.cos(a) * re, y: cyn + Math.sin(a) * re });
    }
  }
  return out;
}

export const PRESETS = [
  {
    id: 'parking',
    name: 'La boucle du parking',
    difficulty: 'Facile',
    width: 76,
    // Slightly wavy so a constant-steering lucky student can't solve it
    // outright at generation 1 — learning stays visible.
    points: loop(480, 320, 350, 205, 28, 0.07, 2, 2.1),
  },
  {
    id: 'departementale',
    name: 'La départementale',
    difficulty: 'Intermédiaire',
    width: 60,
    points: loop(480, 320, 330, 200, 36, 0.16, 3, 0.8),
  },
  {
    id: 'col',
    name: 'Le col des Épingles',
    difficulty: 'Difficile',
    width: 48,
    smoothIterations: 0, // corners are pre-rounded by fillet()
    // Hand-laid: perimeter loop, a hairpin switchback intruding from the
    // bottom right, and a chicane on the way home.
    points: fillet(
      [
        { x: 125, y: 465 },
        { x: 118, y: 300 },
        { x: 140, y: 170 },
        { x: 180, y: 115 },
        { x: 260, y: 95 },
        { x: 380, y: 105 },
        { x: 470, y: 130 },
        { x: 560, y: 100 },
        { x: 680, y: 95 },
        { x: 790, y: 110 },
        { x: 840, y: 170 },
        { x: 855, y: 260 },
        { x: 850, y: 360 },
        { x: 815, y: 440 },
        { x: 745, y: 462 },
        { x: 680, y: 450 },
        { x: 652, y: 390 },
        { x: 644, y: 300 },
        { x: 632, y: 210 },
        { x: 590, y: 165 },
        { x: 535, y: 185 },
        { x: 515, y: 250 },
        { x: 515, y: 330 },
        { x: 525, y: 420 },
        { x: 470, y: 478 },
        { x: 390, y: 498 },
        { x: 320, y: 540 },
        { x: 240, y: 505 },
        { x: 160, y: 540 },
      ],
      55,
    ),
  },
];
