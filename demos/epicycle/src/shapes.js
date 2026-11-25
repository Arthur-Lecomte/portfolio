// Example shapes, as closed outlines in the shared normalized space
// (origin at the canvas centre, y pointing down, 1 unit = min(width,
// height)). They go through the exact same resample + Fourier pipeline
// as a freehand stroke.

function cubic(points, p0, c0, c1, p1, steps) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
    });
  }
}

function ellipseArc(points, cx, cy, rx, ry, rot, a0, a1, steps) {
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 1; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const ex = rx * Math.cos(a);
    const ey = ry * Math.sin(a);
    points.push({ x: cx + ex * cr - ey * sr, y: cy + ex * sr + ey * cr });
  }
}

// Centre a shape and scale its largest dimension to `size` units, so every
// example fills the canvas the same way regardless of how it was authored.
function fit(points, size = 0.72) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const scale = size / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }));
}

// Eighth note (quaver): head, stem and flag drawn as one closed outline.
function note() {
  const pts = [];
  const stemLeft = -0.005;
  const stemRight = 0.035;
  const top = -0.34;
  pts.push({ x: stemLeft, y: 0.22 });
  pts.push({ x: stemLeft, y: top });
  pts.push({ x: stemRight, y: top });
  cubic(
    pts,
    { x: stemRight, y: top },
    { x: 0.12, y: -0.3 },
    { x: 0.19, y: -0.18 },
    { x: 0.17, y: -0.02 },
    14,
  );
  cubic(
    pts,
    { x: 0.17, y: -0.02 },
    { x: 0.16, y: -0.1 },
    { x: 0.1, y: -0.15 },
    { x: stemRight, y: -0.17 },
    14,
  );
  pts.push({ x: stemRight, y: 0.24 });
  ellipseArc(pts, -0.085, 0.275, 0.125, 0.085, -0.4, 0, 2 * Math.PI * 0.93, 40);
  return fit(pts);
}

function star() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.36 : 0.15;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return fit(pts);
}

function heart() {
  const pts = [];
  for (let i = 0; i < 180; i++) {
    const t = (i / 180) * 2 * Math.PI;
    pts.push({
      x: 16 * Math.sin(t) ** 3,
      y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    });
  }
  return fit(pts);
}

function bolt() {
  return fit([
    { x: 0.07, y: -0.38 },
    { x: -0.21, y: 0.06 },
    { x: -0.04, y: 0.06 },
    { x: -0.12, y: 0.38 },
    { x: 0.21, y: -0.09 },
    { x: 0.03, y: -0.09 },
  ]);
}

export const EXAMPLES = [
  { id: 'note', points: note },
  { id: 'star', points: star },
  { id: 'heart', points: heart },
  { id: 'bolt', points: bolt },
];
