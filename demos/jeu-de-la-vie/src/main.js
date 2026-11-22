import './style.css';
import { key, parseKey, step, boundingBox } from './life.js';
import { PATTERNS, GOSPER_GUN } from './patterns.js';

// ---- State ----------------------------------------------------------

let cells = new Set();
let generation = 0;
let lastBirths = 0;
let lastDeaths = 0;
let running = false;
let speed = 10; // generations per second

// Camera: world coordinates (in cells) of the viewport center, and the
// size of one cell in CSS pixels.
const camera = { x: 0, y: 0, scale: 14 };
const MIN_SCALE = 0.5;
const MAX_SCALE = 64;

let tool = 'draw'; // 'draw' | 'pan'
let pendingPattern = null; // pattern awaiting placement, with ghost preview
let hoverCell = null; // [x, y] under the pointer, for the ghost

// Redraw only when the scene changed: the GPU is shared with every other
// window, and an idle demo repainting at 60 fps makes videos playing next
// to it stutter.
let needsRender = true;

// ---- DOM ------------------------------------------------------------

const canvas = document.getElementById('board');
// Opaque canvas: nothing shows through it, and it is cheaper to composite.
const ctx = canvas.getContext('2d', { alpha: false });
const boardWrap = canvas.parentElement;

const playBtn = document.getElementById('play');
const stepBtn = document.getElementById('step-btn');
const speedInput = document.getElementById('speed');
const speedOut = document.getElementById('speed-out');
const randomBtn = document.getElementById('random');
const densityInput = document.getElementById('density');
const densityOut = document.getElementById('density-out');
const clearBtn = document.getElementById('clear');
const recenterBtn = document.getElementById('recenter');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const toolDrawBtn = document.getElementById('tool-draw');
const toolPanBtn = document.getElementById('tool-pan');
const helpBtn = document.getElementById('help-btn');
const helpDialog = document.getElementById('help');
const patternList = document.getElementById('pattern-list');

const statGen = document.getElementById('stat-gen');
const statPop = document.getElementById('stat-pop');
const statBirths = document.getElementById('stat-births');
const statDeaths = document.getElementById('stat-deaths');

// ---- Coordinates ----------------------------------------------------

function viewSize() {
  return { w: canvas.clientWidth, h: canvas.clientHeight };
}

// Screen (CSS px) -> fractional world coordinates.
function screenToWorld(px, py) {
  const { w, h } = viewSize();
  return {
    x: camera.x + (px - w / 2) / camera.scale,
    y: camera.y + (py - h / 2) / camera.scale,
  };
}

function screenToCell(px, py) {
  const p = screenToWorld(px, py);
  return [Math.floor(p.x), Math.floor(p.y)];
}

function zoomAt(px, py, factor) {
  const anchor = screenToWorld(px, py);
  const { w, h } = viewSize();
  camera.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
  camera.x = anchor.x - (px - w / 2) / camera.scale;
  camera.y = anchor.y - (py - h / 2) / camera.scale;
  needsRender = true;
}

// ---- Rendering ------------------------------------------------------

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const { w, h } = viewSize();
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
}

function drawCellRect(cx, cy, w, h) {
  const s = camera.scale;
  const gap = s >= 6 ? 1 : 0;
  const px = (cx - camera.x) * s + w / 2;
  const py = (cy - camera.y) * s + h / 2;
  ctx.fillRect(px + gap / 2, py + gap / 2, s - gap, s - gap);
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const { w, h } = viewSize();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, w, h);

  const s = camera.scale;
  const left = camera.x - w / 2 / s;
  const top = camera.y - h / 2 / s;
  const right = camera.x + w / 2 / s;
  const bottom = camera.y + h / 2 / s;

  // Grid lines, only when cells are big enough to see them.
  if (s >= 8) {
    ctx.strokeStyle = '#1a202b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(left); x <= Math.ceil(right); x += 1) {
      const px = Math.round((x - camera.x) * s + w / 2) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = Math.floor(top); y <= Math.ceil(bottom); y += 1) {
      const py = Math.round((y - camera.y) * s + h / 2) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();
  }

  ctx.fillStyle = '#6ee7b7';
  for (const k of cells) {
    const [x, y] = parseKey(k);
    if (x + 1 < left || x > right || y + 1 < top || y > bottom) continue;
    drawCellRect(x, y, w, h);
  }

  // Ghost preview of the pattern about to be placed.
  if (pendingPattern && hoverCell) {
    const [ox, oy] = patternOrigin(pendingPattern, hoverCell);
    ctx.fillStyle = 'rgb(110 231 183 / 45%)';
    for (const [dx, dy] of pendingPattern.cells) {
      drawCellRect(ox + dx, oy + dy, w, h);
    }
  }
}

// ---- Stats ----------------------------------------------------------

const fmt = new Intl.NumberFormat('fr-FR');

function updateStats() {
  statGen.textContent = fmt.format(generation);
  statPop.textContent = fmt.format(cells.size);
  statBirths.textContent = fmt.format(lastBirths);
  statDeaths.textContent = fmt.format(lastDeaths);
}

// ---- Simulation -----------------------------------------------------

function doStep() {
  const res = step(cells);
  cells = res.cells;
  lastBirths = res.births;
  lastDeaths = res.deaths;
  generation += 1;
  needsRender = true;
}

function setRunning(value) {
  running = value;
  playBtn.setAttribute('aria-pressed', String(running));
  playBtn.textContent = running ? 'Pause' : 'Lecture';
}

let lastTime = performance.now();
let accumulator = 0;

function tick(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  if (running) {
    accumulator += dt * speed;
    let steps = Math.floor(accumulator);
    accumulator -= steps;
    // Never freeze the UI on a huge grid: drop extra steps if needed.
    steps = Math.min(steps, 8);
    for (let i = 0; i < steps; i += 1) doStep();
  } else {
    accumulator = 0;
  }
  if (needsRender) {
    needsRender = false;
    render();
    updateStats();
  }
  requestAnimationFrame(tick);
}

// ---- Actions --------------------------------------------------------

function clearGrid() {
  cells = new Set();
  generation = 0;
  lastBirths = 0;
  lastDeaths = 0;
  setRunning(false);
  needsRender = true;
}

function randomFill() {
  const density = Number(densityInput.value) / 100;
  const { w, h } = viewSize();
  // Seed the visible area, capped so extreme zoom-out stays reasonable.
  const SPAN = 120;
  const cols = Math.min(SPAN, Math.ceil(w / camera.scale));
  const rows = Math.min(SPAN, Math.ceil(h / camera.scale));
  const x0 = Math.round(camera.x - cols / 2);
  const y0 = Math.round(camera.y - rows / 2);
  for (let y = y0; y < y0 + rows; y += 1) {
    for (let x = x0; x < x0 + cols; x += 1) {
      if (Math.random() < density) cells.add(key(x, y));
    }
  }
  needsRender = true;
}

function recenter() {
  needsRender = true;
  const box = boundingBox(cells);
  const { w, h } = viewSize();
  if (!box) {
    camera.x = 0;
    camera.y = 0;
    camera.scale = 14;
    return;
  }
  const margin = 4;
  const bw = box.maxX - box.minX + 1 + margin * 2;
  const bh = box.maxY - box.minY + 1 + margin * 2;
  camera.x = (box.minX + box.maxX + 1) / 2;
  camera.y = (box.minY + box.maxY + 1) / 2;
  camera.scale = Math.min(16, Math.max(MIN_SCALE, Math.min(w / bw, h / bh)));
}

function setTool(next) {
  tool = next;
  if (next !== 'draw') cancelPattern();
  toolDrawBtn.setAttribute('aria-pressed', String(next === 'draw'));
  toolPanBtn.setAttribute('aria-pressed', String(next === 'pan'));
  canvas.classList.toggle('panning', next === 'pan');
}

// ---- Patterns -------------------------------------------------------

function patternOrigin(pattern, [cx, cy]) {
  return [cx - Math.floor(pattern.width / 2), cy - Math.floor(pattern.height / 2)];
}

function placePattern(pattern, at) {
  const [ox, oy] = patternOrigin(pattern, at);
  for (const [dx, dy] of pattern.cells) {
    cells.add(key(ox + dx, oy + dy));
  }
  needsRender = true;
}

function cancelPattern() {
  pendingPattern = null;
  needsRender = true;
  for (const btn of patternList.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', 'false');
  }
  showHint(null);
}

const patternHint = document.getElementById('pattern-hint');
const DEFAULT_HINT = patternHint.textContent.trim();

// Show the description of the hovered/focused pattern; fall back to the
// selected one, then to the generic instruction.
function showHint(pattern) {
  const shown = pattern || pendingPattern;
  patternHint.textContent = shown ? `${shown.name} — ${shown.hint}` : DEFAULT_HINT;
}

for (const pattern of PATTERNS) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = pattern.name;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    const wasSelected = pendingPattern === pattern;
    cancelPattern();
    if (!wasSelected) {
      setTool('draw');
      pendingPattern = pattern;
      btn.setAttribute('aria-pressed', 'true');
    }
    showHint(null);
  });
  btn.addEventListener('mouseenter', () => showHint(pattern));
  btn.addEventListener('mouseleave', () => showHint(null));
  btn.addEventListener('focus', () => showHint(pattern));
  btn.addEventListener('blur', () => showHint(null));
  li.append(btn);
  patternList.append(li);
}

// ---- Pointer input (draw, pan, pinch) -------------------------------

const pointers = new Map(); // pointerId -> { x, y } in CSS px
let paintValue = null; // true = add cells, false = erase, null = not painting
let lastPaintCell = null;
let panLast = null; // { x, y } of the pointer during a one-finger/mouse pan
let placeArmed = false; // a pattern will be stamped on pointer release

function eventPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function paintCell(x, y) {
  const k = key(x, y);
  if (paintValue) cells.add(k);
  else cells.delete(k);
  needsRender = true;
}

function paintLine(from, to) {
  const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), 1);
  for (let i = 1; i <= steps; i += 1) {
    const x = Math.round(from[0] + ((to[0] - from[0]) * i) / steps);
    const y = Math.round(from[1] + ((to[1] - from[1]) * i) / steps);
    paintCell(x, y);
  }
}

function stopGesture() {
  paintValue = null;
  lastPaintCell = null;
  panLast = null;
  placeArmed = false;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const pos = eventPos(e);
  pointers.set(e.pointerId, pos);

  if (pointers.size === 2) {
    // Second finger: switch to pinch, abandon any draw/pan in progress.
    stopGesture();
    return;
  }

  const rightOrMiddle = e.button === 1 || e.button === 2;
  if (tool === 'pan' || rightOrMiddle) {
    panLast = pos;
    return;
  }

  const cell = screenToCell(pos.x, pos.y);
  if (pendingPattern) {
    // Stamp on release, so a starting pinch gesture does not place it.
    placeArmed = true;
    hoverCell = cell;
    needsRender = true;
    return;
  }
  paintValue = !cells.has(key(cell[0], cell[1]));
  paintCell(cell[0], cell[1]);
  lastPaintCell = cell;
});

canvas.addEventListener('pointermove', (e) => {
  const pos = eventPos(e);
  hoverCell = screenToCell(pos.x, pos.y);
  if (pendingPattern) needsRender = true; // the ghost follows the pointer

  if (pointers.has(e.pointerId)) {
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, pos);

    if (pointers.size === 2) {
      // Pinch zoom + two-finger pan.
      const [a, b] = [...pointers.values()];
      const other = a === pos ? b : a;
      const prevDist = Math.hypot(other.x - prev.x, other.y - prev.y);
      const dist = Math.hypot(other.x - pos.x, other.y - pos.y);
      const center = { x: (pos.x + other.x) / 2, y: (pos.y + other.y) / 2 };
      const prevCenter = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
      if (prevDist > 0 && dist > 0) {
        zoomAt(center.x, center.y, dist / prevDist);
      }
      camera.x -= (center.x - prevCenter.x) / camera.scale;
      camera.y -= (center.y - prevCenter.y) / camera.scale;
      needsRender = true;
      return;
    }

    if (panLast) {
      camera.x -= (pos.x - panLast.x) / camera.scale;
      camera.y -= (pos.y - panLast.y) / camera.scale;
      panLast = pos;
      needsRender = true;
      return;
    }

    if (paintValue !== null && lastPaintCell) {
      paintLine(lastPaintCell, hoverCell);
      lastPaintCell = hoverCell;
    }
  }
});

function releasePointer(e) {
  pointers.delete(e.pointerId);
  stopGesture();
}

canvas.addEventListener('pointerup', (e) => {
  if (placeArmed && pendingPattern && pointers.size === 1) {
    const pos = eventPos(e);
    placePattern(pendingPattern, screenToCell(pos.x, pos.y));
  }
  releasePointer(e);
});
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', () => {
  hoverCell = null;
  if (pendingPattern) needsRender = true; // erase the ghost
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const pos = eventPos(e);
    // deltaMode 1 = lines (Firefox); normalize to pixel-ish values.
    const delta = e.deltaY * (e.deltaMode === 1 ? 20 : 1);
    zoomAt(pos.x, pos.y, Math.exp(-delta * 0.0015));
  },
  { passive: false },
);

// ---- Keyboard -------------------------------------------------------

canvas.addEventListener('keydown', (e) => {
  const { w, h } = viewSize();
  const panStep = 60 / camera.scale;
  switch (e.key) {
    case ' ':
      setRunning(!running);
      break;
    case 's':
    case 'S':
      setRunning(false);
      doStep();
      break;
    case 'ArrowLeft':
      camera.x -= panStep;
      break;
    case 'ArrowRight':
      camera.x += panStep;
      break;
    case 'ArrowUp':
      camera.y -= panStep;
      break;
    case 'ArrowDown':
      camera.y += panStep;
      break;
    case '+':
    case '=':
      zoomAt(w / 2, h / 2, 1.25);
      break;
    case '-':
      zoomAt(w / 2, h / 2, 0.8);
      break;
    case 'Escape':
      cancelPattern();
      return;
    default:
      return;
  }
  needsRender = true;
  e.preventDefault();
});

// ---- Toolbar wiring -------------------------------------------------

playBtn.addEventListener('click', () => setRunning(!running));
stepBtn.addEventListener('click', () => {
  setRunning(false);
  doStep();
});
speedInput.addEventListener('input', () => {
  speed = Number(speedInput.value);
  speedOut.textContent = `${speed} gén./s`;
});
densityInput.addEventListener('input', () => {
  densityOut.textContent = `${densityInput.value} %`;
});
randomBtn.addEventListener('click', randomFill);
clearBtn.addEventListener('click', clearGrid);
recenterBtn.addEventListener('click', recenter);
zoomInBtn.addEventListener('click', () => {
  const { w, h } = viewSize();
  zoomAt(w / 2, h / 2, 1.25);
});
zoomOutBtn.addEventListener('click', () => {
  const { w, h } = viewSize();
  zoomAt(w / 2, h / 2, 0.8);
});
toolDrawBtn.addEventListener('click', () => setTool('draw'));
toolPanBtn.addEventListener('click', () => setTool('pan'));
helpBtn.addEventListener('click', () => helpDialog.showModal());

new ResizeObserver(() => {
  resizeCanvas();
  render();
}).observe(boardWrap);

// ---- Boot: Gosper gun running on arrival ----------------------------

placePattern(GOSPER_GUN, [0, 0]);
resizeCanvas();
recenter();
updateStats();
setRunning(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
requestAnimationFrame(tick);
