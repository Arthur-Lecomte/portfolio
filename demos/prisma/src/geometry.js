// Pure 2D geometry helpers. World coordinates are abstract pixels, y down.

export const EPS = 1e-9;

export function vec(x, y) {
  return { x, y };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(a, s) {
  return { x: a.x * s, y: a.y * s };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

export function len(a) {
  return Math.hypot(a.x, a.y);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function norm(a) {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}

// Perpendicular, rotated +90 degrees (clockwise on screen, y down).
export function perp(a) {
  return { x: -a.y, y: a.x };
}

export function fromAngle(t) {
  return { x: Math.cos(t), y: Math.sin(t) };
}

export function angleOf(a) {
  return Math.atan2(a.y, a.x);
}

export function reflect(d, n) {
  const k = 2 * dot(d, n);
  return { x: d.x - k * n.x, y: d.y - k * n.y };
}

// Intersection of ray (o, unit d) with segment [p1, p2].
// Returns { t, s, point } with t = distance along ray, s in [0, 1], or null.
export function raySegment(o, d, p1, p2) {
  const e = sub(p2, p1);
  const denom = cross(d, e);
  if (Math.abs(denom) < EPS) return null;
  const q = sub(p1, o);
  const t = cross(q, e) / denom;
  const s = cross(q, d) / denom;
  if (t <= EPS || s < 0 || s > 1) return null;
  return { t, s, point: add(o, mul(d, t)) };
}

// Intersections of ray (o, unit d) with circle (c, r).
// Returns the positive ray distances, closest first.
export function rayCircle(o, d, c, r) {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const disc = b * b - (dot(oc, oc) - r * r);
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  const out = [];
  if (-b - sq > EPS) out.push(-b - sq);
  if (-b + sq > EPS) out.push(-b + sq);
  return out;
}

// Distance from point p to segment [a, b].
export function pointSegmentDist(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < EPS) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, mul(ab, t)));
}

// Is point p inside the polygon (array of vertices)? Winding-agnostic.
export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}
