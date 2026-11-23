// Light transport: spectral rays, Snell refraction, dispersion, filtering.

import { add, dot, mul, norm, raySegment, rayCircle, reflect, sub } from './geometry.js';
import { surfacesOf } from './objects.js';

export const LAMBDA_MIN = 400;
export const LAMBDA_MAX = 680;

const MAX_BOUNCES = 48;
const MAX_STEPS = 4000;
const MIN_INTENSITY = 0.02;
const MIN_HIT_DIST = 0.25; // world px — avoids re-hitting the surface just left
const SPECTRAL_SAMPLES = 16; // rays spawned when white light refracts
const FILTER_BANDWIDTH = 48; // nm, gaussian width of colour filters

// Cauchy-like dispersion, exaggerated versus real glass so the rainbow
// fan stays clearly visible at demo scale.
export function refractiveIndex(lambdaNm) {
  const um = lambdaNm / 1000;
  return 1.44 + 0.02 / (um * um);
}

// Approximate spectral colour (Bruton's algorithm, mild gamma).
export function wavelengthToRGB(l) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (l < 440) {
    r = (440 - l) / 60;
    b = 1;
  } else if (l < 490) {
    g = (l - 440) / 50;
    b = 1;
  } else if (l < 510) {
    g = 1;
    b = (510 - l) / 20;
  } else if (l < 580) {
    r = (l - 510) / 70;
    g = 1;
  } else if (l < 645) {
    r = 1;
    g = (645 - l) / 65;
  } else {
    r = 1;
  }
  const gamma = (v) => Math.pow(v, 0.8);
  return [gamma(r), gamma(g), gamma(b)];
}

export function rayColor(lambda) {
  return lambda == null ? [1, 1, 1] : wavelengthToRGB(lambda);
}

function nearestHit(o, d, surfaces) {
  let best = null;
  for (const s of surfaces) {
    if (s.kind === 'segment') {
      const h = raySegment(o, d, s.a, s.b);
      if (h && h.t > MIN_HIT_DIST && (!best || h.t < best.t)) {
        best = { t: h.t, point: h.point, surface: s };
      }
    } else {
      // arc
      for (const t of rayCircle(o, d, s.c, s.r)) {
        if (t <= MIN_HIT_DIST || (best && t >= best.t)) continue;
        const p = add(o, mul(d, t));
        if (s.within(p)) {
          best = { t, point: p, surface: s };
          break; // ts are sorted; first valid is the nearest on this arc
        }
      }
    }
  }
  return best;
}

// Refract unit direction d at surface with unit normal n facing the ray
// (dot(d, n) < 0). Returns the new direction or null on total internal
// reflection.
function refractDir(d, n, n1, n2) {
  const eta = n1 / n2;
  const cosI = -dot(d, n);
  const sin2T = eta * eta * (1 - cosI * cosI);
  if (sin2T > 1) return null;
  const cosT = Math.sqrt(1 - sin2T);
  const k = eta * cosI - cosT;
  return { x: eta * d.x + k * n.x, y: eta * d.y + k * n.y };
}

function surfaceNormalAt(surface, point) {
  if (surface.kind === 'segment') return surface.normal;
  // Arc: radial, oriented outward (away from the glass) by normalSign.
  return mul(norm(sub(point, surface.c)), surface.normalSign);
}

// Apply refraction for a single spectral ray at a hit. Returns the new ray.
function refractRay(ray, point, outward, lambda) {
  const entering = dot(ray.d, outward) < 0;
  const n = entering ? outward : mul(outward, -1);
  const nGlass = refractiveIndex(lambda);
  const n1 = entering ? 1 : nGlass;
  const n2 = entering ? nGlass : 1;
  const t = refractDir(ray.d, n, n1, n2);
  const d = t ? norm(t) : reflect(ray.d, n); // null => total internal reflection
  return {
    o: point,
    d,
    lambda,
    color: rayColor(lambda),
    intensity: ray.intensity,
    bounces: ray.bounces + 1,
  };
}

// Trace every laser through the scene.
// Returns { beams: [{a, b, color, intensity}], spots: [{p, color, intensity}] }.
export function trace(objects, world) {
  const surfaces = [];
  for (const obj of objects) {
    for (const s of surfacesOf(obj)) surfaces.push(s);
  }
  // World border absorbs silently (no glow spot).
  const { w, h } = world;
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    surfaces.push({
      kind: 'segment',
      a,
      b,
      normal: norm(sub({ x: w / 2, y: h / 2 }, a)),
      action: 'absorb',
      spot: false,
    });
  }

  const beams = [];
  const spots = [];
  const queue = [];
  for (const obj of objects) {
    if (obj.type !== 'laser') continue;
    const d = { x: Math.cos(obj.angle), y: Math.sin(obj.angle) };
    queue.push({
      o: add({ x: obj.x, y: obj.y }, mul(d, 30)), // start past the housing
      d,
      lambda: obj.lambda,
      color: rayColor(obj.lambda),
      intensity: 1,
      bounces: 0,
    });
  }

  let steps = 0;
  while (queue.length && steps++ < MAX_STEPS) {
    const ray = queue.pop();
    if (ray.intensity < MIN_INTENSITY || ray.bounces > MAX_BOUNCES) continue;
    const hit = nearestHit(ray.o, ray.d, surfaces);
    if (!hit) continue; // outside the world border, nothing to draw
    beams.push({ a: ray.o, b: hit.point, color: ray.color, intensity: ray.intensity });

    const s = hit.surface;
    const outward = surfaceNormalAt(s, hit.point);
    switch (s.action) {
      case 'absorb': {
        if (s.spot) spots.push({ p: hit.point, color: ray.color, intensity: ray.intensity });
        break;
      }
      case 'reflect': {
        const n = dot(ray.d, outward) < 0 ? outward : mul(outward, -1);
        queue.push({
          o: hit.point,
          d: reflect(ray.d, n),
          lambda: ray.lambda,
          color: ray.color,
          intensity: ray.intensity * 0.96,
          bounces: ray.bounces + 1,
        });
        break;
      }
      case 'filter': {
        const lf = s.obj.lambda;
        if (ray.lambda == null) {
          // White picks up the filter's colour.
          queue.push({
            o: hit.point,
            d: ray.d,
            lambda: lf,
            color: wavelengthToRGB(lf),
            intensity: ray.intensity * 0.92,
            bounces: ray.bounces + 1,
          });
        } else {
          const dl = (ray.lambda - lf) / FILTER_BANDWIDTH;
          const t = Math.exp(-dl * dl);
          queue.push({
            o: hit.point,
            d: ray.d,
            lambda: ray.lambda,
            color: ray.color,
            intensity: ray.intensity * t,
            bounces: ray.bounces + 1,
          });
        }
        break;
      }
      case 'refract': {
        if (ray.lambda == null) {
          // White light disperses: spawn one spectral ray per sample. The
          // total is boosted (x3.2, deliberately not energy-conserving) so
          // the fan stays visible against the dark background.
          const span = LAMBDA_MAX - LAMBDA_MIN;
          const each = (ray.intensity * 3.2) / SPECTRAL_SAMPLES;
          for (let i = 0; i < SPECTRAL_SAMPLES; i++) {
            const lambda = LAMBDA_MIN + (span * i) / (SPECTRAL_SAMPLES - 1);
            const r = refractRay(ray, hit.point, outward, lambda);
            r.intensity = each;
            queue.push(r);
          }
        } else {
          queue.push(refractRay(ray, hit.point, outward, ray.lambda));
        }
        break;
      }
    }
  }

  return { beams, spots };
}
