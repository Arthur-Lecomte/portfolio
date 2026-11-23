// Track geometry. A track is built from a closed centerline polyline plus a
// road width: the centerline is smoothed, resampled at even spacing, then
// offset on both sides into inner/outer wall rings. A uniform grid over the
// wall segments accelerates raycasts (sensors) and circle collision tests.

export const SAMPLE_SPACING = 10;
const CELL_SIZE = 48;

export function chaikinClosed(points, iterations) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      out.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    pts = out;
  }
  return pts;
}

export function resampleClosed(points, spacing) {
  const n = points.length;
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const count = Math.max(8, Math.round(perimeter / spacing));
  const step = perimeter / count;
  const out = [];
  let i = 0;
  let acc = 0; // distance from points[i] to the segment cursor
  let segLen = Math.hypot(points[1 % n].x - points[0].x, points[1 % n].y - points[0].y);
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (acc + segLen < target) {
      acc += segLen;
      i++;
      const a = points[i % n];
      const b = points[(i + 1) % n];
      segLen = Math.hypot(b.x - a.x, b.y - a.y);
    }
    const a = points[i % n];
    const b = points[(i + 1) % n];
    const t = segLen > 0 ? (target - acc) / segLen : 0;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

function pointSegDist2(px, py, ax, ay, bx, by) {
  const rx = bx - ax;
  const ry = by - ay;
  const len2 = rx * rx + ry * ry;
  let t = len2 > 0 ? ((px - ax) * rx + (py - ay) * ry) / len2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = px - (ax + rx * t);
  const dy = py - (ay + ry * t);
  return dx * dx + dy * dy;
}

// Strict segment-segment crossing (shared endpoints and collinear touches
// excluded — those are the pinch check's business).
function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

// Checks a resampled centerline is drivable for a given road width:
// no curve tighter than the road half-width, no self-crossing, and no two
// distinct parts of the loop closer than the road width (pinch). Returns
// {ok} or {ok:false, reason:'curve'|'cross'|'pinch', index}.
export function validateCenterline(samples, spacing, width) {
  const n = samples.length;
  const minRadius = width * 0.58;
  for (let i = 0; i < n; i++) {
    const p0 = samples[(i - 1 + n) % n];
    const p1 = samples[i];
    const p2 = samples[(i + 1) % n];
    const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let turn = Math.abs(a2 - a1);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if (turn > 1e-4 && spacing / turn < minRadius) {
      return { ok: false, reason: 'curve', index: i };
    }
  }
  // A loop that crosses itself is never a drivable circuit, however smooth
  // it is. The pinch guard window does NOT apply here: a crossing right
  // next to the start/finish seam is just as invalid.
  for (let i = 0; i < n; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % n];
    for (let j = i + 3; j < n; j++) {
      if (j >= n + i - 2) continue; // circularly adjacent across the seam
      const c = samples[j];
      const d = samples[(j + 1) % n];
      if (segsCross(a, b, c, d)) return { ok: false, reason: 'cross', index: i };
    }
  }
  const guard = Math.ceil((width * 1.7) / spacing);
  const minDist2 = width * 1.05 * (width * 1.05);
  for (let i = 0; i < n; i++) {
    const p = samples[i];
    for (let j = 0; j < n; j++) {
      const dAhead = (j - i + n) % n;
      const dBehind = (i - j + n) % n;
      if (dAhead <= guard || dBehind <= guard + 1) continue;
      const a = samples[j];
      const b = samples[(j + 1) % n];
      if (pointSegDist2(p.x, p.y, a.x, a.y, b.x, b.y) < minDist2) {
        return { ok: false, reason: 'pinch', index: i };
      }
    }
  }
  return { ok: true };
}

export function buildTrack({ id, name, points, width, smoothIterations = 2 }) {
  const smoothed = chaikinClosed(points, smoothIterations);
  const samples = resampleClosed(smoothed, SAMPLE_SPACING);
  const n = samples.length;

  const inner = new Array(n);
  const outer = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = samples[(i - 1 + n) % n];
    const next = samples[(i + 1) % n];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty;
    const ny = tx;
    const h = width / 2;
    inner[i] = { x: samples[i].x - nx * h, y: samples[i].y - ny * h };
    outer[i] = { x: samples[i].x + nx * h, y: samples[i].y + ny * h };
  }

  // Wall segments: both offset rings.
  const walls = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    walls.push({ ax: inner[i].x, ay: inner[i].y, bx: inner[j].x, by: inner[j].y });
    walls.push({ ax: outer[i].x, ay: outer[i].y, bx: outer[j].x, by: outer[j].y });
  }

  // Bounds + uniform grid over wall segment AABBs.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.ax, w.bx);
    maxX = Math.max(maxX, w.ax, w.bx);
    minY = Math.min(minY, w.ay, w.by);
    maxY = Math.max(maxY, w.ay, w.by);
  }
  minX -= CELL_SIZE;
  minY -= CELL_SIZE;
  maxX += CELL_SIZE;
  maxY += CELL_SIZE;
  const cols = Math.ceil((maxX - minX) / CELL_SIZE);
  const rows = Math.ceil((maxY - minY) / CELL_SIZE);
  const cells = new Array(cols * rows).fill(null);
  for (let si = 0; si < walls.length; si++) {
    const w = walls[si];
    const gx0 = Math.floor((Math.min(w.ax, w.bx) - minX) / CELL_SIZE);
    const gx1 = Math.floor((Math.max(w.ax, w.bx) - minX) / CELL_SIZE);
    const gy0 = Math.floor((Math.min(w.ay, w.by) - minY) / CELL_SIZE);
    const gy1 = Math.floor((Math.max(w.ay, w.by) - minY) / CELL_SIZE);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const c = gy * cols + gx;
        if (!cells[c]) cells[c] = [];
        cells[c].push(si);
      }
    }
  }
  const segStamp = new Int32Array(walls.length);
  let stamp = 0;

  // segStamp is int32: keep the epoch in range (a long max-speed session
  // can push a plain counter past 2^31, silently disabling the dedup).
  function bumpStamp() {
    stamp = (stamp + 1) | 0;
    if (stamp === 0) {
      segStamp.fill(0);
      stamp = 1;
    }
  }

  function raySegment(x, y, dx, dy, w) {
    const rx = w.bx - w.ax;
    const ry = w.by - w.ay;
    const D = dx * ry - dy * rx;
    if (D > -1e-9 && D < 1e-9) return -1;
    const ex = w.ax - x;
    const ey = w.ay - y;
    const t = (ex * ry - ey * rx) / D;
    if (t < 0) return -1;
    const u = (dy * ex - dx * ey) / D;
    if (u < 0 || u > 1) return -1;
    return t;
  }

  // Distance to the nearest wall along (angle), capped at maxDist.
  // Amanatides & Woo traversal of the grid; works for origins inside the
  // grid bounds (cars always are).
  function raycast(x, y, angle, maxDist) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let minT = maxDist;
    bumpStamp();
    let gx = Math.floor((x - minX) / CELL_SIZE);
    let gy = Math.floor((y - minY) / CELL_SIZE);
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(CELL_SIZE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(CELL_SIZE / dy) : Infinity;
    let tMaxX = dx !== 0 ? (minX + (gx + (stepX > 0 ? 1 : 0)) * CELL_SIZE - x) / dx : Infinity;
    let tMaxY = dy !== 0 ? (minY + (gy + (stepY > 0 ? 1 : 0)) * CELL_SIZE - y) / dy : Infinity;
    let tEntry = 0;
    while (tEntry <= minT) {
      if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) break;
      const cell = cells[gy * cols + gx];
      if (cell) {
        for (let k = 0; k < cell.length; k++) {
          const si = cell[k];
          if (segStamp[si] === stamp) continue;
          segStamp[si] = stamp;
          const t = raySegment(x, y, dx, dy, walls[si]);
          if (t >= 0 && t < minT) minT = t;
        }
      }
      if (tMaxX < tMaxY) {
        tEntry = tMaxX;
        gx += stepX;
        tMaxX += tDeltaX;
      } else {
        tEntry = tMaxY;
        gy += stepY;
        tMaxY += tDeltaY;
      }
    }
    return minT;
  }

  function circleHit(x, y, r) {
    const gx0 = Math.max(0, Math.floor((x - r - minX) / CELL_SIZE));
    const gx1 = Math.min(cols - 1, Math.floor((x + r - minX) / CELL_SIZE));
    const gy0 = Math.max(0, Math.floor((y - r - minY) / CELL_SIZE));
    const gy1 = Math.min(rows - 1, Math.floor((y + r - minY) / CELL_SIZE));
    const r2 = r * r;
    bumpStamp();
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const cell = cells[gy * cols + gx];
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          const si = cell[k];
          if (segStamp[si] === stamp) continue;
          segStamp[si] = stamp;
          const w = walls[si];
          if (pointSegDist2(x, y, w.ax, w.ay, w.bx, w.by) < r2) return true;
        }
      }
    }
    return false;
  }

  // Advances car.progressIdx (unwrapped float centerline index) by
  // projecting the car onto the nearest centerline segment within a small
  // window around its previous position — cheap, shortcut-proof, and
  // naturally accumulates laps.
  function updateProgress(car) {
    const i0 = Math.round(car.progressIdx);
    let bestD = Infinity;
    let bestIdx = car.progressIdx;
    for (let k = -6; k <= 6; k++) {
      const i = i0 + k;
      const a = samples[((i % n) + n) % n];
      const b = samples[(((i + 1) % n) + n) % n];
      const rx = b.x - a.x;
      const ry = b.y - a.y;
      const len2 = rx * rx + ry * ry || 1;
      let t = ((car.x - a.x) * rx + (car.y - a.y) * ry) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const dx = car.x - (a.x + rx * t);
      const dy = car.y - (a.y + ry * t);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestIdx = i + t;
      }
    }
    car.progressIdx = bestIdx;
    car.progressDist = bestIdx * SAMPLE_SPACING;
  }

  const startPose = {
    x: samples[0].x,
    y: samples[0].y,
    heading: Math.atan2(samples[1].y - samples[0].y, samples[1].x - samples[0].x),
  };

  return {
    id,
    name,
    width,
    samples,
    inner,
    outer,
    n,
    spacing: SAMPLE_SPACING,
    lapLength: n * SAMPLE_SPACING,
    bounds: { minX, minY, maxX, maxY },
    startPose,
    raycast,
    circleHit,
    updateProgress,
    validate: () => validateCenterline(samples, SAMPLE_SPACING, width),
  };
}
