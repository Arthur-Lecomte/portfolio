import './style.css';
import { resampleClosed, analyse, reconstructPath } from './fourier.js';
import { EXAMPLES } from './shapes.js';

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const stage = canvas.parentElement;
const invite = document.getElementById('invite');
const circlesInput = document.getElementById('circles');
const circlesValue = document.getElementById('circles-value');
const speedInput = document.getElementById('speed');
const showCirclesInput = document.getElementById('show-circles');
const clearButton = document.getElementById('clear');
const inviteText = invite.textContent;

const COLORS = {
  stroke: '#ffd27d',
  watermark: 'rgba(148, 163, 184, 0.3)',
  trailGlow: 'rgba(255, 193, 94, 0.22)',
  trail: '#ffd27d',
  circle: 'rgba(148, 163, 184, 0.55)', // >= 3:1 on the stage (WCAG 1.4.11)
  arm: 'rgba(196, 205, 220, 0.5)',
  penHalo: 'rgba(255, 210, 125, 0.35)',
  pen: '#ffffff',
};

// All path geometry lives in a normalized space (origin at the canvas
// centre, 1 unit = min(width, height)); only `view` depends on the canvas
// size, so resizing never forces a Fourier recompute.
const state = {
  source: null, // resampled input path: watermark + DFT input
  analysis: null, // { offset, terms } sorted by amplitude
  trail: null, // reconstructed path for the current circle count
  circles: Number(circlesInput.value),
  period: periodFromSlider(Number(speedInput.value)), // seconds per lap
  showCircles: showCirclesInput.checked,
  phase: 0, // position along the lap, in [0, 1)
  trailComplete: false,
  stroke: null, // freehand stroke being drawn, if any
};

const view = { w: 0, h: 0, scale: 1, dpr: 1 };

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let pageVisible = !document.hidden;
let inViewport = true;
let rafId = 0;
let lastTime = 0;
let renderQueued = false;

// --------------------------------------------------------------------------
// Animation scheduling. The loop runs only while there is something moving
// AND someone can see it; everything else renders a single frame on demand,
// so the demo at rest never repaints.

function animating() {
  return (
    state.analysis !== null &&
    state.stroke === null &&
    !reducedMotion.matches &&
    pageVisible &&
    inViewport
  );
}

function syncLoop() {
  if (animating() && rafId === 0) {
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  } else if (!animating() && rafId !== 0) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function tick(time) {
  if (lastTime !== 0) {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    state.phase += dt / state.period;
    if (state.phase >= 1) {
      state.phase %= 1;
      state.trailComplete = true;
    }
  }
  lastTime = time;
  render();
  rafId = requestAnimationFrame(tick);
}

function requestRender() {
  if (rafId !== 0 || renderQueued) return; // the running loop will cover it
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

// --------------------------------------------------------------------------
// Rendering

// Scalar on purpose: drawChain calls these every frame for every circle,
// and object arguments would allocate in the hot loop.
const toX = (x) => view.w / 2 + x * view.scale;
const toY = (y) => view.h / 2 + y * view.scale;

function tracePath(points, count, closed) {
  ctx.beginPath();
  ctx.moveTo(toX(points[0].x), toY(points[0].y));
  for (let i = 1; i < count; i++) ctx.lineTo(toX(points[i].x), toY(points[i].y));
  if (closed) ctx.closePath();
}

function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (state.stroke) {
    if (state.stroke.length > 1) {
      tracePath(state.stroke, state.stroke.length, false);
      ctx.strokeStyle = COLORS.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    return;
  }
  if (!state.analysis) return;

  // Original drawing, as a faint watermark under the reconstruction.
  tracePath(state.source, state.source.length, true);
  ctx.strokeStyle = COLORS.watermark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Trail: the path already traced by the chain tip. Once a full lap is
  // done it stays complete; a wide translucent pass under a thin bright
  // one gives the glow without shadowBlur.
  const count = state.trailComplete
    ? state.trail.length
    : Math.floor(state.phase * state.trail.length) + 1;
  if (count > 1) {
    tracePath(state.trail, count, state.trailComplete);
    ctx.strokeStyle = COLORS.trailGlow;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = COLORS.trail;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawChain();
}

function drawChain() {
  const { offset, terms } = state.analysis;
  const used = Math.min(state.circles, terms.length);
  const t = state.phase;
  let x = offset.x;
  let y = offset.y;
  ctx.lineWidth = 1;
  for (let k = 0; k < used; k++) {
    // Must match the term evaluation in reconstructPath (fourier.js), or
    // the live pen drifts off the precomputed trail.
    const phi = 2 * Math.PI * terms[k].freq * t + terms[k].phase;
    const nx = x + terms[k].amp * Math.cos(phi);
    const ny = y + terms[k].amp * Math.sin(phi);
    if (state.showCircles) {
      const r = terms[k].amp * view.scale;
      if (r > 0.75) {
        ctx.beginPath();
        ctx.arc(toX(x), toY(y), r, 0, 2 * Math.PI);
        ctx.strokeStyle = COLORS.circle;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(toX(x), toY(y));
      ctx.lineTo(toX(nx), toY(ny));
      ctx.strokeStyle = COLORS.arm;
      ctx.stroke();
    }
    x = nx;
    y = ny;
  }

  const px = toX(x);
  const py = toY(y);
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, 2 * Math.PI);
  ctx.fillStyle = COLORS.penHalo;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = COLORS.pen;
  ctx.fill();
}

// --------------------------------------------------------------------------
// Content changes

// The invite is a status live region: toggling its text (rather than a
// `hidden` attribute) is what makes the result of « Effacer » audible to
// screen readers. Derived from state so no call site can desync it.
function syncInvite() {
  const text = state.stroke === null && state.analysis === null ? inviteText : '';
  if (invite.textContent !== text) invite.textContent = text;
}

function adopt(points) {
  const source = resampleClosed(points);
  if (!source) return;
  state.source = source;
  state.analysis = analyse(source);
  state.trail = reconstructPath(state.analysis, state.circles);
  state.phase = 0;
  // Without animation the full reconstruction is shown straight away.
  state.trailComplete = reducedMotion.matches;
  syncInvite();
  syncLoop();
  requestRender();
}

function clearScene() {
  state.source = null;
  state.analysis = null;
  state.trail = null;
  state.phase = 0;
  state.trailComplete = false;
  syncInvite();
  syncLoop();
  requestRender();
}

// --------------------------------------------------------------------------
// Freehand drawing

function normPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - rect.width / 2) / view.scale,
    y: (e.clientY - rect.top - rect.height / 2) / view.scale,
  };
}

// Permissive on purpose: a very fast flick can yield only a handful of
// pointermove events; the bounding-box test below is the real gate.
function strokeIsUsable(stroke) {
  if (stroke.length < 4) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of stroke) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return Math.hypot(maxX - minX, maxY - minY) > 0.04;
}

// Only one pointer may draw: the one that started the stroke. A second
// finger, or a mouse press during a touch stroke, is ignored entirely.
let activePointer = null;

canvas.addEventListener('pointerdown', (e) => {
  if (state.stroke !== null || e.button !== 0) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  activePointer = e.pointerId;
  state.stroke = [normPoint(e)];
  syncInvite();
  syncLoop();
  requestRender();
});

canvas.addEventListener('pointermove', (e) => {
  if (state.stroke === null || e.pointerId !== activePointer) return;
  const p = normPoint(e);
  const last = state.stroke[state.stroke.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) < 0.003) return;
  state.stroke.push(p);
  requestRender();
});

function endStroke(e) {
  if (state.stroke === null || e.pointerId !== activePointer) return;
  activePointer = null;
  const stroke = state.stroke;
  state.stroke = null;
  if (strokeIsUsable(stroke)) {
    adopt(stroke);
  } else {
    // Too small to mean anything: resume whatever was there before.
    syncInvite();
    syncLoop();
    requestRender();
  }
}

canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);

// --------------------------------------------------------------------------
// Controls

function periodFromSlider(v) {
  // One lap in 24 s (slider at 0) down to 2 s (slider at 100), log scale.
  return 24 * Math.pow(2 / 24, v / 100);
}

circlesInput.addEventListener('input', () => {
  state.circles = Number(circlesInput.value);
  circlesValue.textContent = circlesInput.value;
  if (state.analysis) {
    state.trail = reconstructPath(state.analysis, state.circles);
    requestRender();
  }
});

speedInput.addEventListener('input', () => {
  state.period = periodFromSlider(Number(speedInput.value));
});

showCirclesInput.addEventListener('change', () => {
  state.showCircles = showCirclesInput.checked;
  requestRender();
});

clearButton.addEventListener('click', clearScene);

for (const button of document.querySelectorAll('[data-example]')) {
  button.addEventListener('click', () => {
    const example = EXAMPLES.find((e) => e.id === button.dataset.example);
    if (example) adopt(example.points());
  });
}

// --------------------------------------------------------------------------
// Visibility: no animation frames when the page is hidden, the canvas is
// scrolled out of view, or the visitor prefers reduced motion.

document.addEventListener('visibilitychange', () => {
  pageVisible = !document.hidden;
  syncLoop();
});

new IntersectionObserver((entries) => {
  // Batched records arrive oldest-first: only the last one is current.
  inViewport = entries[entries.length - 1].isIntersecting;
  syncLoop();
}).observe(canvas);

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && state.analysis) state.trailComplete = true;
  syncLoop();
  requestRender();
});

// --------------------------------------------------------------------------
// Boot

function resize() {
  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (rect.width === view.w && rect.height === view.h && dpr === view.dpr) return;
  view.dpr = dpr;
  view.w = rect.width;
  view.h = rect.height;
  view.scale = Math.min(view.w, view.h);
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  // Resizing the backing store just wiped the bitmap, and this frame's rAF
  // callbacks have already run (ResizeObserver fires after them): repaint
  // synchronously or the frame is presented blank.
  render();
}

// ResizeObserver only sees CSS-pixel changes; a devicePixelRatio change with
// an unchanged layout (monitor switch, browser zoom) needs its own watcher,
// re-armed each time because the media query hardcodes the current ratio.
function watchPixelRatio() {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  query.addEventListener(
    'change',
    () => {
      resize();
      watchPixelRatio();
    },
    { once: true },
  );
}

resize();
new ResizeObserver(resize).observe(stage);
watchPixelRatio();
adopt(EXAMPLES[0].points());
