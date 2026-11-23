import './style.css';
import { initInteraction } from './interaction.js';
import { bumpIdsAbove, createObject, labelOf } from './objects.js';
import { trace } from './optics.js';
import { render } from './render.js';
import { DEFAULT_SCENE, SCENES, WORLD } from './scenes.js';
import { loadScene, saveScene } from './storage.js';
import { initUI } from './ui.js';

// Graceful fallback for pre-2023 browsers (e.g. iOS 15): square corners.
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    this.rect(x, y, w, h);
  };
}

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const announcer = document.getElementById('announcer');

const state = {
  world: WORLD,
  objects: [],
  selectedId: null,
  traced: { beams: [], spots: [] },
};

// World-to-canvas mapping: uniform scale, centred (letterboxed).
const view = { dpr: 1, scale: 1, ox: 0, oy: 0, cssW: 0, cssH: 0 };

let rafPending = false;
function requestRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    render(ctx, view, state);
  });
}

let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveScene(state.objects), 400);
}

let announceTimer;
function announce(text) {
  announcer.textContent = '';
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    announcer.textContent = text;
  }, 50);
}

function selectedObj() {
  return state.objects.find((o) => o.id === state.selectedId);
}

let ui = null;

const app = {
  canvas,
  state,
  view,

  // Call after any mutation of the scene (move, rotate, add, remove, colour).
  changed() {
    state.traced = trace(state.objects, state.world);
    requestRender();
    scheduleSave();
  },

  select(id) {
    if (state.selectedId === id) {
      requestRender();
      return;
    }
    state.selectedId = id;
    ui?.onSelection();
    const obj = selectedObj();
    if (obj) announce(`Sélection : ${labelOf(obj)}`);
    requestRender();
  },

  addObject(type, extra) {
    const n = state.objects.length;
    const obj = createObject(
      type,
      WORLD.w / 2 + ((n % 5) - 2) * 60,
      WORLD.h / 2 + ((n % 3) - 1) * 60,
      extra,
    );
    state.objects.push(obj);
    app.select(obj.id);
    app.changed();
    announce(`Ajout : ${labelOf(obj)}`);
    // Keyboard flow: the new object is selected, put focus where the
    // arrow/R keys work.
    canvas.focus({ preventScroll: true });
  },

  deleteSelected() {
    const i = state.objects.findIndex((o) => o.id === state.selectedId);
    if (i < 0) return;
    const [obj] = state.objects.splice(i, 1);
    app.select(null);
    app.changed();
    announce(`Suppression : ${labelOf(obj)}`);
  },

  rotateSelected(delta) {
    const obj = selectedObj();
    if (!obj) return;
    obj.angle += delta;
    app.changed();
  },

  cycleSelection(dir) {
    if (!state.objects.length) return;
    const idx = state.objects.findIndex((o) => o.id === state.selectedId);
    const next = state.objects[(idx + dir + state.objects.length) % state.objects.length];
    app.select(next.id);
  },

  loadSceneById(id) {
    const scene = SCENES.find((s) => s.id === id);
    if (!scene) return;
    state.objects = scene.build();
    bumpIdsAbove(state.objects);
    state.selectedId = null;
    ui?.onSelection();
    app.changed();
    announce(`Scène « ${scene.name} » chargée`);
  },

  resetScene() {
    app.loadSceneById(DEFAULT_SCENE);
  },
};

function resize() {
  const r = canvas.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  view.cssW = r.width;
  view.cssH = r.height;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * view.dpr);
  canvas.height = Math.round(r.height * view.dpr);
  const pad = 14;
  view.scale = Math.max(
    0.05,
    Math.min((r.width - pad * 2) / WORLD.w, (r.height - pad * 2) / WORLD.h),
  );
  view.ox = (r.width - WORLD.w * view.scale) / 2;
  view.oy = (r.height - WORLD.h * view.scale) / 2;
  requestRender();
}

// Boot
const saved = loadScene();
if (saved) {
  state.objects = saved;
  bumpIdsAbove(saved);
} else {
  state.objects = SCENES.find((s) => s.id === DEFAULT_SCENE).build();
}
state.traced = trace(state.objects, state.world);

ui = initUI(app);
initInteraction(app);
new ResizeObserver(resize).observe(canvas);
resize();

// The debounced save could lose the last edit if the tab closes right
// after it; flush on pagehide.
window.addEventListener('pagehide', () => saveScene(state.objects));
