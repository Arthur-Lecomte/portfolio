// Scene renderer (canvas 2D). The static track is pre-rendered to an
// offscreen layer, rebuilt only on track change or resize; cars are drawn
// on top each frame. Nothing here schedules frames — the caller owns the
// render-on-demand loop.

import { CAR } from '../sim/car.js';
import { SIM } from '../sim/simulation.js';

const COLORS = {
  road: '#2a3340',
  roadEdge: '#5b6b82',
  centerDash: '#3d4a5e',
  startLine: '#cdd7e4',
  car: 'rgba(96, 205, 255, 0.85)',
  carDead: 'rgba(130, 140, 155, 0.28)',
  best: '#ffd166',
  champion: '#ff6ec7',
  ray: 'rgba(82, 214, 251, 0.5)',
  rayHit: 'rgba(255, 123, 114, 0.9)',
  draft: '#52d6fb',
  draftBad: '#ff7b72',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const trackLayer = document.createElement('canvas');
  let track = null;
  let view = { scale: 1, ox: 0, oy: 0 }; // world -> canvas px transform
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;

  // Returns true when the backing store actually changed size.
  function resize() {
    const r = canvas.getBoundingClientRect();
    const nDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width === cssW && r.height === cssH && nDpr === dpr) return false;
    cssW = r.width;
    cssH = r.height;
    dpr = nDpr;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    trackLayer.width = canvas.width;
    trackLayer.height = canvas.height;
    computeView();
    if (track) renderTrackLayer();
    return true;
  }

  function computeView() {
    if (!track) return;
    const b = track.bounds;
    const worldW = b.maxX - b.minX;
    const worldH = b.maxY - b.minY;
    const scale = Math.min(canvas.width / worldW, canvas.height / worldH) * 0.97;
    view = {
      scale,
      ox: (canvas.width - worldW * scale) / 2 - b.minX * scale,
      oy: (canvas.height - worldH * scale) / 2 - b.minY * scale,
    };
  }

  function setTrack(t) {
    track = t;
    computeView();
    renderTrackLayer();
  }

  function applyView(c) {
    c.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  }

  function renderTrackLayer() {
    const c = trackLayer.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, trackLayer.width, trackLayer.height);
    if (!track) return;
    applyView(c);

    // Road surface: outer ring with the inner ring as a hole.
    c.fillStyle = COLORS.road;
    c.fill(makePath(track), 'evenodd');

    // Road edges.
    c.lineWidth = 2 / view.scale + 1.2;
    c.strokeStyle = COLORS.roadEdge;
    c.stroke(ringPath(track.outer));
    c.stroke(ringPath(track.inner));

    // Dashed center line.
    c.setLineDash([10, 14]);
    c.lineWidth = 1.6;
    c.strokeStyle = COLORS.centerDash;
    c.stroke(ringPath(track.samples));
    c.setLineDash([]);

    // Start line across the road at sample 0.
    c.lineWidth = 4;
    c.strokeStyle = COLORS.startLine;
    c.beginPath();
    c.moveTo(track.inner[0].x, track.inner[0].y);
    c.lineTo(track.outer[0].x, track.outer[0].y);
    c.stroke();
  }

  function makePath(t) {
    const p = new Path2D();
    addRing(p, t.outer);
    addRing(p, t.inner);
    return p;
  }

  function ringPath(pts) {
    const p = new Path2D();
    addRing(p, pts);
    return p;
  }

  function addRing(p, pts) {
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    p.closePath();
  }

  function drawCar(c, car, color) {
    c.save();
    c.translate(car.x, car.y);
    c.rotate(car.heading);
    c.fillStyle = color;
    const L = CAR.length;
    const W = CAR.width;
    c.beginPath();
    c.roundRect(-L / 2, -W / 2, L, W, 3);
    c.fill();
    // Windshield hint so the driving direction reads at a glance.
    c.fillStyle = 'rgba(14, 18, 24, 0.55)';
    c.fillRect(L * 0.08, -W * 0.32, L * 0.22, W * 0.64);
    c.restore();
  }

  function drawRays(c, car) {
    for (const a of SIM.rayAngles) {
      const ang = car.heading + a;
      const d = track.raycast(car.x, car.y, ang, SIM.rayLen);
      const hx = car.x + Math.cos(ang) * d;
      const hy = car.y + Math.sin(ang) * d;
      c.strokeStyle = COLORS.ray;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(car.x, car.y);
      c.lineTo(hx, hy);
      c.stroke();
      if (d < SIM.rayLen) {
        c.fillStyle = COLORS.rayHit;
        c.beginPath();
        c.arc(hx, hy, 2.6, 0, 2 * Math.PI);
        c.fill();
      }
    }
  }

  // scene = { cars, bestCar, champion } — any part may be missing.
  function draw(scene) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(trackLayer, 0, 0);
    applyView(ctx);

    if (scene.cars) {
      for (const car of scene.cars) {
        if (car === scene.bestCar) continue;
        drawCar(ctx, car, car.alive ? COLORS.car : COLORS.carDead);
      }
    }
    if (scene.bestCar) {
      drawRays(ctx, scene.bestCar);
      drawCar(ctx, scene.bestCar, COLORS.best);
    }
    if (scene.champion) {
      drawRays(ctx, scene.champion);
      drawCar(ctx, scene.champion, COLORS.champion);
    }
  }

  // Editor preview: the in-progress stroke or the validated centerline.
  // draft = { points, closed, badIndex, width }
  function drawDraft(draft) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyView(ctx);

    if (draft.points.length < 2) return;
    if (draft.closed && draft.width) {
      // Ghost of the future road width.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(82, 214, 251, 0.14)';
      ctx.lineWidth = draft.width;
      ctx.stroke(ringPath(draft.points));
    }
    ctx.strokeStyle = draft.badIndex >= 0 ? COLORS.draftBad : COLORS.draft;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const p = new Path2D();
    p.moveTo(draft.points[0].x, draft.points[0].y);
    for (let i = 1; i < draft.points.length; i++) p.lineTo(draft.points[i].x, draft.points[i].y);
    if (draft.closed) p.closePath();
    ctx.stroke(p);

    if (draft.badIndex >= 0) {
      const b = draft.points[draft.badIndex];
      ctx.fillStyle = COLORS.draftBad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Maps a pointer event to world coordinates (for the editor).
  function worldFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * dpr;
    const py = (e.clientY - r.top) * dpr;
    return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
  }

  // Editor needs a view even with no track yet: frame the given world box.
  function setWorldView(bounds) {
    track = null;
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    const scale = Math.min(canvas.width / worldW, canvas.height / worldH) * 0.97;
    view = {
      scale,
      ox: (canvas.width - worldW * scale) / 2 - bounds.minX * scale,
      oy: (canvas.height - worldH * scale) / 2 - bounds.minY * scale,
    };
    const c = trackLayer.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, trackLayer.width, trackLayer.height);
  }

  return { resize, setTrack, draw, drawDraft, worldFromEvent, setWorldView };
}
