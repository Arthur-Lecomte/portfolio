// Scene object model: factories, optical surfaces, hit-testing, labels.
// Objects are plain JSON-serialisable records.

import {
  add,
  dot,
  fromAngle,
  mul,
  norm,
  perp,
  pointInPolygon,
  pointSegmentDist,
  sub,
} from './geometry.js';

let nextId = 1;

export function bumpIdsAbove(objects) {
  for (const o of objects) nextId = Math.max(nextId, o.id + 1);
}

const DEFAULTS = {
  laser: { angle: 0, lambda: null }, // lambda null = white
  mirror: { angle: -Math.PI / 4, length: 190 },
  prism: { angle: 0, size: 110 },
  lens: { angle: 0, kind: 'convex', aperture: 90, R: 150 },
  wall: { angle: 0, w: 220, h: 18 },
  filter: { angle: Math.PI / 2, length: 170, lambda: 640 },
};

export function createObject(type, x, y, extra = {}) {
  return { id: nextId++, type, x, y, ...DEFAULTS[type], ...extra };
}

export function labelOf(obj) {
  switch (obj.type) {
    case 'laser':
      return 'Laser';
    case 'mirror':
      return 'Miroir';
    case 'prism':
      return 'Prisme';
    case 'lens':
      return obj.kind === 'convex' ? 'Lentille convergente' : 'Lentille divergente';
    case 'wall':
      return 'Mur';
    case 'filter':
      return 'Filtre coloré';
  }
  return 'Objet';
}

function center(obj) {
  return { x: obj.x, y: obj.y };
}

// Endpoints of line-like objects (mirror, filter).
export function endpointsOf(obj) {
  const d = fromAngle(obj.angle);
  const h = obj.length / 2;
  return [sub(center(obj), mul(d, h)), add(center(obj), mul(d, h))];
}

// Triangle vertices of a prism, point "up" at angle 0 (screen y is down).
export function prismVertices(obj) {
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const t = obj.angle - Math.PI / 2 + (i * 2 * Math.PI) / 3;
    pts.push(add(center(obj), mul(fromAngle(t), obj.size)));
  }
  return pts;
}

export function sagitta(R, a) {
  return R - Math.sqrt(R * R - a * a);
}

// Analytic lens description shared by surfaces and renderer.
// Convex: two arcs meeting at the rim (vesica shape).
// Concave: two inward arcs plus two absorbing rim caps (the mount).
export function lensGeometry(obj) {
  const d = fromAngle(obj.angle); // optical axis
  const u = perp(d); // aperture direction
  const a = obj.aperture;
  const R = obj.R;
  const s = sagitta(R, a);
  if (obj.kind === 'convex') {
    return {
      d,
      u,
      a,
      R,
      s,
      halfT: s,
      c1: add(center(obj), mul(d, R - s)),
      c2: sub(center(obj), mul(d, R - s)),
    };
  }
  const tc = 8; // centre thickness
  return {
    d,
    u,
    a,
    R,
    s,
    tc,
    rimHalf: tc / 2 + s,
    c1: sub(center(obj), mul(d, tc / 2 + R)),
    c2: add(center(obj), mul(d, tc / 2 + R)),
  };
}

// Sampled outline polygon of a lens, for rendering and hit-testing.
export function lensOutline(obj, steps = 24) {
  const { d, u, a, R } = lensGeometry(obj);
  const c = center(obj);
  const pts = [];
  const profile = (y, side) => {
    // side -1 = left surface, +1 = right surface; pd = offset along axis
    const root = Math.sqrt(R * R - y * y);
    let pd;
    if (obj.kind === 'convex') {
      pd = side * (root - (R - sagitta(R, a)));
    } else {
      pd = side * (4 + R - root); // 4 = tc / 2, see lensGeometry
    }
    return add(c, add(mul(d, pd), mul(u, y)));
  };
  for (let i = 0; i <= steps; i++) {
    pts.push(profile(-a + (2 * a * i) / steps, -1));
  }
  for (let i = steps; i >= 0; i--) {
    pts.push(profile(-a + (2 * a * i) / steps, 1));
  }
  return pts;
}

function segmentSurface(a, b, action, obj, spot = false) {
  return { kind: 'segment', a, b, normal: norm(perp(sub(b, a))), action, obj, spot };
}

// Rectangle (centre, angle, w along angle, h across) as four absorbing walls.
function rectSurfaces(obj, w, h, spot) {
  const d = fromAngle(obj.angle);
  const u = perp(d);
  const c = center(obj);
  const hw = mul(d, w / 2);
  const hh = mul(u, h / 2);
  const p1 = add(add(c, hw), hh);
  const p2 = add(sub(c, hw), hh);
  const p3 = sub(sub(c, hw), hh);
  const p4 = sub(add(c, hw), hh);
  return [
    segmentSurface(p1, p2, 'absorb', obj, spot),
    segmentSurface(p2, p3, 'absorb', obj, spot),
    segmentSurface(p3, p4, 'absorb', obj, spot),
    segmentSurface(p4, p1, 'absorb', obj, spot),
  ];
}

export function surfacesOf(obj) {
  switch (obj.type) {
    case 'laser':
      return rectSurfaces({ ...obj }, 56, 22, false);
    case 'wall':
      return rectSurfaces(obj, obj.w, obj.h, true);
    case 'mirror': {
      const [a, b] = endpointsOf(obj);
      return [segmentSurface(a, b, 'reflect', obj)];
    }
    case 'filter': {
      const [a, b] = endpointsOf(obj);
      return [segmentSurface(a, b, 'filter', obj)];
    }
    case 'prism': {
      const pts = prismVertices(obj);
      const c = center(obj);
      const out = [];
      for (let i = 0; i < 3; i++) {
        const s = segmentSurface(pts[i], pts[(i + 1) % 3], 'refract', obj);
        // Orient the stored normal outward (away from the centroid).
        const mid = mul(add(pts[i], pts[(i + 1) % 3]), 0.5);
        if (dot(s.normal, sub(mid, c)) < 0) s.normal = mul(s.normal, -1);
        out.push(s);
      }
      return out;
    }
    case 'lens': {
      const g = lensGeometry(obj);
      const c = center(obj);
      if (obj.kind === 'convex') {
        const within = (side) => (p) => {
          const rel = sub(p, c);
          return Math.abs(dot(rel, g.u)) <= g.a + 0.5 && side * dot(rel, g.d) <= 0.5;
        };
        return [
          {
            kind: 'arc',
            c: g.c1,
            r: g.R,
            normalSign: 1,
            within: within(1),
            action: 'refract',
            obj,
          },
          {
            kind: 'arc',
            c: g.c2,
            r: g.R,
            normalSign: 1,
            within: within(-1),
            action: 'refract',
            obj,
          },
        ];
      }
      // Concave: arcs curve inward; outward normal points back toward the
      // arc's circle centre, hence normalSign -1. The box test below is
      // enough to reject the far hemisphere of each arc circle.
      const withinC = (p) => {
        const rel = sub(p, c);
        return Math.abs(dot(rel, g.u)) <= g.a + 0.5 && Math.abs(dot(rel, g.d)) <= g.rimHalf + 0.5;
      };
      const caps = [];
      for (const sign of [1, -1]) {
        const ua = mul(g.u, sign * g.a);
        caps.push(
          segmentSurface(
            add(add(c, ua), mul(g.d, -g.rimHalf)),
            add(add(c, ua), mul(g.d, g.rimHalf)),
            'absorb',
            obj,
            false,
          ),
        );
      }
      return [
        { kind: 'arc', c: g.c1, r: g.R, normalSign: -1, within: withinC, action: 'refract', obj },
        { kind: 'arc', c: g.c2, r: g.R, normalSign: -1, within: withinC, action: 'refract', obj },
        ...caps,
      ];
    }
  }
  return [];
}

// Rough radius used for selection rings and handle placement.
export function radiusOf(obj) {
  switch (obj.type) {
    case 'laser':
      return 36;
    case 'mirror':
    case 'filter':
      return obj.length / 2;
    case 'prism':
      return obj.size;
    case 'lens':
      return obj.aperture + 10;
    case 'wall':
      return Math.max(obj.w, obj.h) / 2;
  }
  return 40;
}

// Generous hit test for selection (touch-friendly). pad in world px.
export function hitTest(obj, p, pad = 14) {
  const rel = sub(p, center(obj));
  switch (obj.type) {
    case 'laser':
      return Math.hypot(rel.x, rel.y) <= 36 + pad / 2;
    case 'mirror':
    case 'filter': {
      const [a, b] = endpointsOf(obj);
      return pointSegmentDist(p, a, b) <= 8 + pad;
    }
    case 'prism': {
      const pts = prismVertices(obj);
      if (pointInPolygon(p, pts)) return true;
      for (let i = 0; i < 3; i++) {
        if (pointSegmentDist(p, pts[i], pts[(i + 1) % 3]) <= pad) return true;
      }
      return false;
    }
    case 'lens': {
      const g = lensGeometry(obj);
      const halfT = obj.kind === 'convex' ? g.halfT : g.rimHalf;
      return Math.abs(dot(rel, g.u)) <= g.a + pad && Math.abs(dot(rel, g.d)) <= halfT + pad;
    }
    case 'wall': {
      const d = fromAngle(obj.angle);
      return (
        Math.abs(dot(rel, d)) <= obj.w / 2 + pad && Math.abs(dot(rel, perp(d))) <= obj.h / 2 + pad
      );
    }
  }
  return false;
}
