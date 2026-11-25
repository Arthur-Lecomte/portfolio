import './style.css';
import { DT, L1, L2, jointPositions, rk4Step } from './physics.js';

// RÈGLE PORTFOLIO — toutes les démos partagent la même origine : les
// clés localStorage sont TOUJOURS préfixées par le slug du projet.
const PREFIX = 'effet-papillon:';

const TRAIL_CAP = 420; // points kept per pendulum
const TRAIL_DT = 1 / 60; // simulated seconds between trail points
const GRAPH_DT0 = 1 / 20; // initial sampling period of the divergence graph
const GRAPH_CAP = 1200; // samples kept before decimating
const WORLD_RADIUS = (L1 + L2) * 1.12; // fitted into the canvas
const GRAB_RADIUS = 24; // px

const sceneEl = document.getElementById('scene');
const graphEl = document.getElementById('graph');
const graphTitleEl = document.getElementById('graph-title');
const toggleBtn = document.getElementById('toggle');
const resetBtn = document.getElementById('reset');
const inputs = {
  count: document.getElementById('count'),
  eps: document.getElementById('eps'),
  speed: document.getElementById('speed'),
};
const outputs = {
  count: document.getElementById('count-out'),
  eps: document.getElementById('eps-out'),
  speed: document.getElementById('speed-out'),
};
const sceneCtx = sceneEl.getContext('2d');
const graphCtx = graphEl.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- settings

const DEFAULTS = { count: 10, epsExp: -6, speed: 1 };

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(`${PREFIX}settings`);
    if (!raw) return { ...DEFAULTS };
    const s = JSON.parse(raw);
    return {
      count: clamp(Math.round(s.count), 2, 30) || DEFAULTS.count,
      epsExp: clamp(Math.round(s.epsExp), -8, -2) || DEFAULTS.epsExp,
      speed: clamp(Math.round(s.speed * 10) / 10, 0.1, 2) || DEFAULTS.speed,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(`${PREFIX}settings`, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode); the demo works without it.
  }
}

const settings = loadSettings();

// -------------------------------------------------------------- simulation

// Launch angles shared by every clone; offsets are applied to th1 only.
const base = { th1: 2.0, th2: 2.5 };

let pendulums = []; // { s, color, trail: { xs, ys, len, head } }
let simTime = 0;
let accumulator = 0;
let nextTrailAt = 0;
let nextGraphAt = 0;
let graphDt = GRAPH_DT0;
let graphT = [];
let graphV = [];

function colorFor(i, n) {
  const hue = 185 + (135 * i) / Math.max(n - 1, 1);
  return `hsl(${hue} 100% 65%)`;
}

function resetRun() {
  const n = settings.count;
  const eps = 10 ** settings.epsExp;
  if (pendulums.length !== n) {
    pendulums = Array.from({ length: n }, (_, i) => ({
      s: new Float64Array(4),
      color: colorFor(i, n),
      trail: {
        xs: new Float32Array(TRAIL_CAP),
        ys: new Float32Array(TRAIL_CAP),
        len: 0,
        head: 0,
      },
    }));
  }
  for (let i = 0; i < n; i++) {
    const p = pendulums[i];
    p.s[0] = base.th1 + (i - (n - 1) / 2) * eps;
    p.s[1] = 0;
    p.s[2] = base.th2;
    p.s[3] = 0;
    p.trail.len = 0;
    p.trail.head = 0;
  }
  simTime = 0;
  accumulator = 0;
  nextTrailAt = 0;
  nextGraphAt = 0;
  graphDt = GRAPH_DT0;
  graphT = [];
  graphV = [];
}

function pushTrailPoints() {
  for (const p of pendulums) {
    const [, , x2, y2] = jointPositions(p.s);
    const t = p.trail;
    t.xs[t.head] = x2;
    t.ys[t.head] = y2;
    t.head = (t.head + 1) % TRAIL_CAP;
    if (t.len < TRAIL_CAP) t.len++;
  }
}

function currentSpread() {
  let max = 0;
  const pts = pendulums.map((p) => jointPositions(p.s));
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i][2] - pts[j][2];
      const dy = pts[i][3] - pts[j][3];
      const d2 = dx * dx + dy * dy;
      if (d2 > max) max = d2;
    }
  }
  return Math.sqrt(max);
}

function pushGraphSample() {
  graphT.push(simTime);
  graphV.push(currentSpread());
  if (graphT.length >= GRAPH_CAP) {
    // Halve the resolution but keep the whole history.
    const kept = Math.ceil(graphT.length / 2);
    for (let i = 0, j = 0; j < kept; i += 2, j++) {
      graphT[j] = graphT[i];
      graphV[j] = graphV[i];
    }
    graphT.length = kept;
    graphV.length = kept;
    graphDt *= 2;
  }
}

function advance(dtReal) {
  accumulator += dtReal * settings.speed;
  while (accumulator >= DT) {
    for (const p of pendulums) rk4Step(p.s, DT);
    simTime += DT;
    accumulator -= DT;
    if (simTime >= nextTrailAt) {
      pushTrailPoints();
      nextTrailAt += TRAIL_DT;
    }
    if (simTime >= nextGraphAt) {
      pushGraphSample();
      nextGraphAt = simTime + graphDt;
    }
  }
}

// --------------------------------------------------------------- rendering

// Full render passes, exposed so the "demo at rest = zero redraws" rule can
// be checked from the console (the counter must stop moving when idle).
window.__epDrawCalls = 0;

const dpr = () => window.devicePixelRatio || 1;

function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr()));
  const h = Math.max(1, Math.round(rect.height * dpr()));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function viewTransform() {
  const w = sceneEl.clientWidth;
  const h = sceneEl.clientHeight;
  return {
    cx: w / 2,
    cy: h / 2,
    scale: Math.min(w, h) / 2 / WORLD_RADIUS,
  };
}

function drawDot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrail(ctx, p, view) {
  const { xs, ys, len, head } = p.trail;
  if (len < 2) return;
  const ringIdx = (k) => (head - len + k + TRAIL_CAP) % TRAIL_CAP;
  const toX = (k) => view.cx + xs[ringIdx(k)] * view.scale;
  const toY = (k) => view.cy + ys[ringIdx(k)] * view.scale;
  const BANDS = 10;
  const per = Math.ceil(len / BANDS);
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  let k = 0;
  for (let b = 0; b < BANDS && k < len - 1; b++) {
    ctx.globalAlpha = 0.04 + 0.5 * ((b + 1) / BANDS) ** 2;
    ctx.beginPath();
    ctx.moveTo(toX(k), toY(k));
    const end = Math.min(len - 1, (b + 1) * per);
    while (k < end) {
      k++;
      ctx.lineTo(toX(k), toY(k));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawArms(ctx, p, view) {
  const [x1, y1, x2, y2] = jointPositions(p.s);
  const X1 = view.cx + x1 * view.scale;
  const Y1 = view.cy + y1 * view.scale;
  const X2 = view.cx + x2 * view.scale;
  const Y2 = view.cy + y2 * view.scale;
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(view.cx, view.cy);
  ctx.lineTo(X1, Y1);
  ctx.lineTo(X2, Y2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  drawDot(ctx, X1, Y1, 2.5, p.color);
  ctx.globalAlpha = 0.25;
  drawDot(ctx, X2, Y2, 7, p.color);
  ctx.globalAlpha = 1;
  drawDot(ctx, X2, Y2, 3.5, p.color);
}

function renderScene() {
  const ctx = sceneCtx;
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
  ctx.clearRect(0, 0, sceneEl.clientWidth, sceneEl.clientHeight);
  const view = viewTransform();
  drawDot(ctx, view.cx, view.cy, 3, 'rgba(255,255,255,0.5)');
  for (const p of pendulums) drawTrail(ctx, p, view);
  for (const p of pendulums) drawArms(ctx, p, view);
}

const SUPERSCRIPTS = {
  '-': '⁻',
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
};

function pow10Label(exp) {
  if (exp === 0) return '1';
  const sup = String(exp)
    .split('')
    .map((c) => SUPERSCRIPTS[c])
    .join('');
  return `10${sup}`;
}

const GRAPH_LOG_MIN = -9;
const GRAPH_LOG_MAX = 0.8;

function renderGraph() {
  const ctx = graphCtx;
  const w = graphEl.clientWidth;
  const h = graphEl.clientHeight;
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
  ctx.clearRect(0, 0, w, h);
  const padL = 44;
  const padR = 10;
  const padT = 8;
  const padB = 18;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  if (innerW <= 0 || innerH <= 0) return;

  const yFor = (v) => {
    const lg = clamp(Math.log10(Math.max(v, 1e-12)), GRAPH_LOG_MIN, GRAPH_LOG_MAX);
    return padT + ((GRAPH_LOG_MAX - lg) / (GRAPH_LOG_MAX - GRAPH_LOG_MIN)) * innerH;
  };
  const tMax = Math.max(10, graphT[graphT.length - 1] || 0);
  const xFor = (t) => padL + (t / tMax) * innerW;

  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#8fa3b8';
  ctx.strokeStyle = 'rgba(143,163,184,0.18)';
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let exp = -8; exp <= 0; exp += 2) {
    const y = yFor(10 ** exp);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillText(pow10Label(exp), padL - 6, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('0 s', padL, h - padB + 4);
  ctx.fillText(`${Math.round(tMax).toLocaleString('fr-FR')} s`, w - padR - 12, h - padB + 4);

  if (graphT.length >= 2) {
    ctx.strokeStyle = '#53d9ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xFor(graphT[0]), yFor(graphV[0]));
    for (let i = 1; i < graphT.length; i++) {
      ctx.lineTo(xFor(graphT[i]), yFor(graphV[i]));
    }
    ctx.stroke();
  }
}

let shownTime = -1;

function render() {
  renderScene();
  renderGraph();
  const t = Math.round(simTime * 10) / 10;
  if (t !== shownTime) {
    shownTime = t;
    graphTitleEl.textContent = `Écart maximal entre les bouts (m, échelle log) — t = ${t.toLocaleString(
      'fr-FR',
      { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    )} s`;
  }
  window.__epDrawCalls++;
}

// -------------------------------------------------------- main loop (rAF)

let running = false;
let rafId = 0;
let lastNow = 0;

function scheduleRender() {
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function frame(now) {
  rafId = 0;
  if (running) {
    // Clamp so a backgrounded tab does not fast-forward on return.
    advance(Math.min((now - lastNow) / 1000, 0.05));
    lastNow = now;
    scheduleRender();
  }
  render();
}

function setRunning(on) {
  running = on;
  if (on) {
    lastNow = performance.now();
    scheduleRender();
  }
  // Charter: the alternating label carries the state — no aria-pressed.
  toggleBtn.textContent = on ? 'Pause' : 'Lecture';
}

// ------------------------------------------------------------ interaction

function pointerWorld(e) {
  const view = viewTransform();
  return {
    wx: (e.offsetX - view.cx) / view.scale,
    wy: (e.offsetY - view.cy) / view.scale,
    view,
  };
}

function hitTest(e) {
  const { wx, wy, view } = pointerWorld(e);
  let best = null;
  let bestD2 = (GRAB_RADIUS * GRAB_RADIUS) / (view.scale * view.scale);
  for (const p of pendulums) {
    const [x1, y1, x2, y2] = jointPositions(p.s);
    for (const [bob, bx, by] of [
      [2, x2, y2],
      [1, x1, y1],
    ]) {
      const d2 = (wx - bx) ** 2 + (wy - by) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { p, bob };
      }
    }
  }
  return best;
}

let drag = null; // { bob: 1 | 2, resume: boolean }

sceneEl.addEventListener('pointerdown', (e) => {
  const hit = hitTest(e);
  if (!hit) return;
  e.preventDefault();
  sceneEl.setPointerCapture(e.pointerId);
  drag = { bob: hit.bob, resume: running || !reducedMotion.matches };
  base.th1 = hit.p.s[0];
  base.th2 = hit.p.s[2];
  running = false;
  toggleBtn.textContent = 'Lecture';
  applyDrag(e);
});

function applyDrag(e) {
  const { wx, wy } = pointerWorld(e);
  if (drag.bob === 1) {
    base.th1 = Math.atan2(wx, wy);
  } else {
    const x1 = L1 * Math.sin(base.th1);
    const y1 = L1 * Math.cos(base.th1);
    base.th2 = Math.atan2(wx - x1, wy - y1);
  }
  resetRun();
  scheduleRender();
}

sceneEl.addEventListener('pointermove', (e) => {
  if (drag) {
    applyDrag(e);
    return;
  }
  // Cheap hover feedback; touching the style only on change avoids churn.
  const cursor = hitTest(e) ? 'grab' : '';
  if (sceneEl.style.cursor !== cursor) sceneEl.style.cursor = cursor;
});

function endDrag() {
  if (!drag) return;
  const { resume } = drag;
  drag = null;
  setRunning(resume);
  scheduleRender();
}

sceneEl.addEventListener('pointerup', endDrag);
sceneEl.addEventListener('pointercancel', endDrag);

sceneEl.addEventListener('keydown', (e) => {
  const step = ((e.shiftKey ? 0.2 : 2) * Math.PI) / 180;
  switch (e.key) {
    case 'ArrowLeft':
      base.th1 -= step;
      break;
    case 'ArrowRight':
      base.th1 += step;
      break;
    case 'ArrowUp':
      base.th2 += step;
      break;
    case 'ArrowDown':
      base.th2 -= step;
      break;
    case ' ':
      e.preventDefault();
      setRunning(!running);
      return;
    default:
      return;
  }
  e.preventDefault();
  running = false;
  toggleBtn.textContent = 'Lecture';
  resetRun();
  scheduleRender();
});

// ---------------------------------------------------------------- controls

toggleBtn.addEventListener('click', () => setRunning(!running));

resetBtn.addEventListener('click', () => {
  resetRun();
  setRunning(true);
  scheduleRender();
});

function reflectOutputs() {
  outputs.count.textContent = String(settings.count);
  outputs.eps.textContent = `${pow10Label(settings.epsExp)} rad`;
  outputs.speed.textContent = `×${settings.speed.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
}

inputs.count.addEventListener('input', () => {
  settings.count = Number(inputs.count.value);
  saveSettings();
  reflectOutputs();
  resetRun();
  scheduleRender();
});

inputs.eps.addEventListener('input', () => {
  settings.epsExp = Number(inputs.eps.value);
  saveSettings();
  reflectOutputs();
  resetRun();
  scheduleRender();
});

inputs.speed.addEventListener('input', () => {
  settings.speed = Math.round(Number(inputs.speed.value) * 10) / 10;
  saveSettings();
  reflectOutputs();
});

// -------------------------------------------------------------------- init

const resizeObserver = new ResizeObserver(() => {
  sizeCanvas(sceneEl);
  sizeCanvas(graphEl);
  scheduleRender();
});
resizeObserver.observe(sceneEl);
resizeObserver.observe(graphEl);

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && running) setRunning(false);
});

inputs.count.value = String(settings.count);
inputs.eps.value = String(settings.epsExp);
inputs.speed.value = String(settings.speed);
reflectOutputs();
sizeCanvas(sceneEl);
sizeCanvas(graphEl);
resetRun();
setRunning(!reducedMotion.matches);
scheduleRender();
