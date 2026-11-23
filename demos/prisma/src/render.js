// Canvas renderer: dark scene, glassy objects, additive glowing beams.

import { add, fromAngle, mul } from './geometry.js';
import { endpointsOf, lensGeometry, lensOutline, prismVertices, radiusOf } from './objects.js';
import { rayColor } from './optics.js';

const GLASS_FILL = 'rgba(140, 175, 255, 0.08)';
const GLASS_EDGE = 'rgba(170, 205, 255, 0.55)';

export function cssColor([r, g, b], a = 1) {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

function tracePolygon(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function line(ctx, a, b, stroke, width, cap = 'round') {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawLaser(ctx, obj) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.angle);
  ctx.beginPath();
  ctx.roundRect(-28, -11, 56, 22, 6);
  ctx.fillStyle = '#141a26';
  ctx.fill();
  ctx.strokeStyle = '#43536f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Nose
  ctx.beginPath();
  ctx.roundRect(16, -8, 12, 16, 3);
  ctx.fillStyle = '#243049';
  ctx.fill();
  // Emitter glow in the laser's colour
  const col = rayColor(obj.lambda);
  const grad = ctx.createRadialGradient(26, 0, 0, 26, 0, 12);
  grad.addColorStop(0, cssColor(col, 0.9));
  grad.addColorStop(1, cssColor(col, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(26, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  // Colour LED on the body
  ctx.beginPath();
  ctx.arc(-16, 0, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = cssColor(col, 0.95);
  ctx.fill();
  ctx.restore();
}

function drawMirror(ctx, obj) {
  const [a, b] = endpointsOf(obj);
  line(ctx, a, b, '#9fb2d4', 7);
  line(ctx, a, b, '#eef4ff', 2.2);
}

function drawFilter(ctx, obj) {
  const [a, b] = endpointsOf(obj);
  const col = rayColor(obj.lambda);
  line(ctx, a, b, cssColor(col, 0.35), 9);
  line(ctx, a, b, cssColor(col, 0.9), 2.2);
}

function drawPrism(ctx, obj) {
  tracePolygon(ctx, prismVertices(obj));
  ctx.fillStyle = GLASS_FILL;
  ctx.fill();
  ctx.strokeStyle = GLASS_EDGE;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawLens(ctx, obj) {
  tracePolygon(ctx, lensOutline(obj));
  ctx.fillStyle = GLASS_FILL;
  ctx.fill();
  ctx.strokeStyle = GLASS_EDGE;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (obj.kind === 'concave') {
    // Rim mounts (they absorb light, show them as solid)
    const g = lensGeometry(obj);
    const c = { x: obj.x, y: obj.y };
    for (const sign of [1, -1]) {
      const ua = mul(g.u, sign * g.a);
      line(
        ctx,
        add(add(c, ua), mul(g.d, -g.rimHalf)),
        add(add(c, ua), mul(g.d, g.rimHalf)),
        '#6b7694',
        5,
      );
    }
  }
}

function drawWall(ctx, obj) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.angle);
  ctx.beginPath();
  ctx.roundRect(-obj.w / 2, -obj.h / 2, obj.w, obj.h, 4);
  ctx.fillStyle = '#10141f';
  ctx.fill();
  ctx.strokeStyle = '#424d6d';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawObject(ctx, obj) {
  switch (obj.type) {
    case 'laser':
      return drawLaser(ctx, obj);
    case 'mirror':
      return drawMirror(ctx, obj);
    case 'filter':
      return drawFilter(ctx, obj);
    case 'prism':
      return drawPrism(ctx, obj);
    case 'lens':
      return drawLens(ctx, obj);
    case 'wall':
      return drawWall(ctx, obj);
  }
}

function drawBeams(ctx, traced) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const passes = [
    [11, 0.1],
    [3.6, 0.38],
    [1.4, 1],
  ];
  for (const [width, alpha] of passes) {
    ctx.lineWidth = width;
    for (const beam of traced.beams) {
      const a = Math.min(1, beam.intensity) * alpha;
      if (a < 0.004) continue;
      ctx.strokeStyle = cssColor(beam.color, a);
      ctx.beginPath();
      ctx.moveTo(beam.a.x, beam.a.y);
      ctx.lineTo(beam.b.x, beam.b.y);
      ctx.stroke();
    }
  }
  for (const spot of traced.spots) {
    const i = Math.min(1, spot.intensity);
    const grad = ctx.createRadialGradient(spot.p.x, spot.p.y, 0, spot.p.x, spot.p.y, 20);
    grad.addColorStop(0, cssColor(spot.color, 0.55 * i));
    grad.addColorStop(0.35, cssColor(spot.color, 0.22 * i));
    grad.addColorStop(1, cssColor(spot.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(spot.p.x, spot.p.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function handlePosition(obj) {
  return add({ x: obj.x, y: obj.y }, mul(fromAngle(obj.angle), radiusOf(obj) + 46));
}

function drawSelection(ctx, obj) {
  const r = radiusOf(obj) + 16;
  ctx.save();
  ctx.strokeStyle = 'rgba(138, 180, 255, 0.85)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rotation handle, along the object's facing direction
  const h = handlePosition(obj);
  const edge = add({ x: obj.x, y: obj.y }, mul(fromAngle(obj.angle), r));
  line(ctx, edge, h, 'rgba(138, 180, 255, 0.5)', 1.6);
  ctx.beginPath();
  ctx.arc(h.x, h.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 24, 44, 0.92)';
  ctx.fill();
  ctx.strokeStyle = '#8ab4ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Circular-arrow glyph
  ctx.beginPath();
  ctx.arc(h.x, h.y, 6, -2.4, 1.6);
  ctx.strokeStyle = '#d6e6ff';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  const tip = add(h, mul(fromAngle(1.6), 6));
  tracePolygon(ctx, [
    add(tip, { x: -3.4, y: 0.6 }),
    add(tip, { x: 3, y: -1.8 }),
    add(tip, { x: 1.4, y: 4 }),
  ]);
  ctx.fillStyle = '#d6e6ff';
  ctx.fill();
  ctx.restore();
}

export function render(ctx, view, state) {
  const { dpr, scale, ox, oy, cssW, cssH } = view;
  const { world } = state;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, cssW * dpr, cssH * dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

  // Play area: soft vignette, dotted grid, thin border
  const grad = ctx.createRadialGradient(
    world.w / 2,
    world.h / 2,
    0,
    world.w / 2,
    world.h / 2,
    world.w * 0.6,
  );
  grad.addColorStop(0, 'rgba(80, 100, 170, 0.07)');
  grad.addColorStop(1, 'rgba(80, 100, 170, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, world.w, world.h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let x = 80; x < world.w; x += 80) {
    for (let y = 80; y < world.h; y += 80) {
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  ctx.strokeStyle = 'rgba(120, 140, 200, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(1, 1, world.w - 2, world.h - 2, 10);
  ctx.stroke();

  for (const obj of state.objects) drawObject(ctx, obj);
  drawBeams(ctx, state.traced);

  const selected = state.objects.find((o) => o.id === state.selectedId);
  if (selected) drawSelection(ctx, selected);
}
