import './style.css';

import { PRESETS } from './tracks/presets.js';
import { CHAMPIONS } from './tracks/champions.js';
import { buildTrack, validateCenterline, SAMPLE_SPACING } from './sim/track.js';
import { Simulation, SIM, stepCarWithBrain, senseInputs } from './sim/simulation.js';
import { forwardTrace } from './sim/nn.js';
import { createCar } from './sim/car.js';
import { makeRng } from './sim/rng.js';
import { createRenderer } from './render/renderer.js';
import { createNetviz } from './render/netviz.js';
import { createChart } from './render/chart.js';
import { createEditor, CUSTOM_WIDTH } from './ui/editor.js';

// RÈGLE PORTFOLIO — toutes les démos partagent la même origine : les
// clés localStorage sont TOUJOURS préfixées par le slug du projet.
const STORAGE_KEY = 'auto-ecole:tracks';

const $ = (id) => document.getElementById(id);
const sceneCanvas = $('scene');
const els = {
  overlay: $('overlay'),
  overlayText: $('overlay-text'),
  overlayAction: $('overlay-action'),
  pill: $('status-pill'),
  accept: $('editor-accept'),
  gen: $('stat-gen'),
  alive: $('stat-alive'),
  best: $('stat-best'),
  record: $('stat-record'),
  play: $('btn-play'),
  restart: $('btn-restart'),
  champion: $('btn-champion'),
  championHint: $('champion-hint'),
  draw: $('btn-draw'),
  pop: $('in-pop'),
  popOut: $('out-pop'),
  sigma: $('in-sigma'),
  sigmaOut: $('out-sigma'),
  trackList: $('track-list'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  mode: 'train', // 'train' | 'champion' | 'editor'
  running: false,
  userStarted: false,
  wasRunningBeforeEditor: false,
  speed: 1, // 1 | 2 | 8 | 'max'
  trackDef: PRESETS[0],
  track: null,
  sim: null,
  champion: null, // { car, genome, laps }
  customs: loadCustoms(),
};

const renderer = createRenderer(sceneCanvas);
const netviz = createNetviz($('netviz'));
const chart = createChart($('chart'));
const editor = createEditor({
  canvas: sceneCanvas,
  worldFromEvent: (e) => renderer.worldFromEvent(e),
  requestRender,
  onStatus: (msg) => showPill(msg),
  onDraftChange: (valid) => {
    els.accept.hidden = !valid;
  },
});

/* ---------- Persistence (drawn tracks only, per agreed scope) ---------- */

function loadCustoms() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (t) =>
        t &&
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        typeof t.width === 'number' &&
        Array.isArray(t.points) &&
        t.points.length >= 24 &&
        t.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
        validateCenterline(t.points, SAMPLE_SPACING, t.width).ok,
    );
  } catch {
    return [];
  }
}

function saveCustoms() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customs));
  } catch {
    // Quota full or site data blocked: the track still works this visit.
    showPill('Sauvegarde locale impossible — le circuit reste jouable pour cette visite.');
  }
}

/* ---------- Render-on-demand loop ----------
   A frame is scheduled only while the simulation runs, or once after any
   visual mutation (requestRender). An idle scene never repaints. */

let rafId = 0;
let needsRender = false;
let lastTime = 0;
let simAcc = 0;
let chartDirty = true;

function requestRender() {
  needsRender = true;
  schedule();
}

function schedule() {
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function frame(now) {
  rafId = 0;
  if (state.running) {
    advanceSim(now);
    needsRender = true;
  }
  if (needsRender) {
    render();
    needsRender = false;
  }
  if (state.running) schedule();
}

function advanceSim(now) {
  if (!lastTime) lastTime = now;
  const elapsed = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  // Max is a wall-clock budget for training; for the one-car champion
  // replay it would be a teleport, so cap it to a watchable multiplier.
  const speed = state.mode === 'champion' && state.speed === 'max' ? 8 : state.speed;
  if (speed === 'max') {
    const budget = performance.now() + 12;
    while (performance.now() < budget) stepOnce();
  } else {
    simAcc += elapsed * speed;
    let n = 0;
    while (simAcc >= SIM.dt && n < 240) {
      simAcc -= SIM.dt;
      stepOnce();
      n++;
    }
    if (n >= 240) simAcc = 0; // tab was frozen: drop the backlog
  }
}

function stepOnce() {
  if (state.mode === 'champion') {
    const ch = state.champion;
    stepCarWithBrain(state.track, ch.car, ch.genome, SIM.dt);
    if (!ch.car.alive) {
      ch.car = createCar(state.track.startPose); // the champion retries
    }
  } else {
    const genEnded = state.sim.step();
    if (genEnded) chartDirty = true;
  }
}

/* ---------- Rendering ---------- */

const statCache = { gen: '', alive: '', best: '', record: '' };

function setStat(key, value) {
  if (statCache[key] !== value) {
    statCache[key] = value;
    els[key].textContent = value;
  }
}

const meters = (px) => `${Math.round(px / 10)} m`;

function drawNet(car, genome) {
  if (!car || !genome) return;
  const trace = forwardTrace(SIM.layers, genome, senseInputs(state.track, car));
  netviz.draw(trace, genome);
}

function render() {
  if (state.mode === 'editor') {
    renderer.drawDraft(editor.draft);
    // A resize wipes the panel canvases; keep them drawn even here.
    drawNet(state.sim.bestCar(), state.sim.genomes[0]);
    if (chartDirty) {
      chart.draw(state.sim.history, state.track.lapLength);
      chartDirty = false;
    }
    return;
  }
  if (state.mode === 'champion') {
    const ch = state.champion;
    renderer.draw({ champion: ch.car });
    drawNet(ch.car, ch.genome);
    const laps = Math.floor(ch.car.progressIdx / state.track.n);
    if (laps !== ch.laps) {
      ch.laps = laps;
      showPill(`🏆 Le champion roule — ${laps} tour${laps > 1 ? 's' : ''}`);
    }
    setStat('alive', '1');
    setStat('best', meters(ch.car.progressDist));
  } else {
    const sim = state.sim;
    const best = sim.bestCar();
    renderer.draw({ cars: sim.cars, bestCar: best });
    drawNet(best, sim.genomes[sim.cars.indexOf(best)]);
    setStat('gen', String(sim.generation));
    setStat('alive', String(sim.aliveCount()));
    const bestDist = best ? best.progressDist : 0;
    setStat('best', meters(bestDist));
    setStat('record', meters(Math.max(sim.recordDist, bestDist)));
  }
  if (chartDirty) {
    chart.draw(state.sim.history, state.track.lapLength);
    chartDirty = false;
  }
}

/* ---------- Mode & controls ---------- */

// The pill keeps its role=status node in the tree (see .status-pill:empty)
// so screen readers reliably announce the first message too.
function showPill(msg) {
  els.pill.textContent = msg;
}

function hidePill() {
  els.pill.textContent = '';
}

function setRunning(run) {
  if (run && !state.running) lastTime = 0;
  state.running = run;
  if (run) els.overlay.hidden = true; // whatever started the sim dismisses the start gate
  els.play.textContent = run ? '⏸ Pause' : '▶ Reprendre';
  if (run) {
    state.userStarted = true;
    schedule();
  } else {
    requestRender(); // one last frame so the paused scene is current
  }
}

function updateChampionButton() {
  if (state.mode === 'champion') {
    els.champion.disabled = false;
    els.champion.textContent = '🏫 Retour à l’école';
    els.champion.title = '';
    els.championHint.hidden = true;
    return;
  }
  const has = Boolean(CHAMPIONS[state.trackDef.id]);
  els.champion.disabled = !has;
  els.champion.textContent = '🏆 Voir le champion';
  els.champion.title = has ? 'Faire rouler un réseau déjà entraîné (embarqué dans la démo)' : '';
  // Visible text, not a tooltip: a disabled button is unfocusable, so the
  // explanation must not live only in `title`.
  els.championHint.hidden = has;
}

function selectTrack(def) {
  if (state.mode === 'editor') exitEditor(false);
  state.trackDef = def;
  state.track = buildTrack(def);
  state.mode = 'train';
  state.champion = null;
  hidePill();
  renderer.setTrack(state.track);
  state.sim.setTrack(state.track);
  chartDirty = true;
  updateChampionButton();
  renderTrackList();
  requestRender();
  if (state.userStarted || !reducedMotion) setRunning(true);
}

function enterChampion() {
  state.mode = 'champion';
  state.champion = {
    car: createCar(state.track.startPose),
    genome: CHAMPIONS[state.trackDef.id].weights,
    laps: -1,
  };
  updateChampionButton();
  setRunning(true);
}

function exitChampion() {
  state.mode = 'train';
  state.champion = null;
  hidePill();
  updateChampionButton();
  requestRender();
}

function enterEditor() {
  if (state.mode === 'champion') exitChampion();
  state.wasRunningBeforeEditor = state.running;
  state.mode = 'editor';
  state.running = false;
  els.overlay.hidden = true; // the reduced-motion start gate must not cover the editor
  els.play.textContent = '▶ Reprendre';
  state.sim.spawn(); // mid-generation state would be stale when we return
  editor.enter();
  renderer.setWorldView(editor.worldBounds());
  sceneCanvas.setAttribute('aria-label', 'Zone de dessin : tracez votre circuit à main levée');
  els.draw.textContent = '✖ Annuler le tracé';
  els.play.disabled = true;
  els.restart.disabled = true;
  els.champion.disabled = true;
  requestRender();
}

function exitEditor(restore) {
  editor.exit();
  els.accept.hidden = true;
  hidePill();
  sceneCanvas.setAttribute(
    'aria-label',
    'Vue de la piste : les voitures de la promotion en cours d’entraînement',
  );
  els.draw.textContent = '✏️ Tracer mon circuit';
  els.play.disabled = false;
  els.restart.disabled = false;
  state.mode = 'train';
  updateChampionButton();
  if (restore) {
    renderer.setTrack(state.track);
    requestRender();
    if (state.wasRunningBeforeEditor) setRunning(true);
  }
}

function acceptDraft() {
  const points = editor.takeCenterline();
  // Dry-run: never save or select a definition that cannot actually be
  // built into a track — a silent dead end would be worse than a message.
  try {
    buildTrack({ points, width: CUSTOM_WIDTH, smoothIterations: 0 });
  } catch {
    showPill('Ce tracé ne donne pas un circuit utilisable. Redessinez.');
    return;
  }
  const n =
    1 +
    state.customs.reduce((max, t) => {
      const m = /^Mon circuit (\d+)$/.exec(t.name);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
  const def = {
    id: `custom-${Date.now().toString(36)}`,
    name: `Mon circuit ${n}`,
    width: CUSTOM_WIDTH,
    points,
    smoothIterations: 0,
    custom: true,
  };
  state.customs.push(def);
  saveCustoms();
  exitEditor(false);
  selectTrack(def);
}

/* ---------- Track list ---------- */

function renderTrackList() {
  els.trackList.textContent = '';
  const defs = [...PRESETS, ...state.customs];
  for (const def of defs) {
    const item = document.createElement('div');
    item.className = 'track-item';
    item.dataset.current = String(def.id === state.trackDef.id);

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'select';
    select.dataset.id = def.id;
    select.setAttribute('aria-pressed', String(def.id === state.trackDef.id));
    const name = document.createElement('span');
    name.textContent = def.name;
    const diff = document.createElement('span');
    diff.className = 'difficulty';
    diff.textContent = def.custom ? 'Dessiné' : def.difficulty;
    select.append(name, diff);
    item.append(select);

    if (def.custom) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete';
      del.dataset.delete = def.id;
      del.textContent = '🗑';
      del.setAttribute('aria-label', `Supprimer ${def.name}`);
      item.append(del);
    }
    els.trackList.append(item);
  }
}

els.trackList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  // The list is rebuilt below, removing the focused button from the DOM;
  // keyboard users must not be dropped back to <body>.
  const refocus = (id) =>
    (
      els.trackList.querySelector(`button[data-id="${id}"]`) ??
      els.trackList.querySelector('button')
    )?.focus();
  if (btn.dataset.delete) {
    const id = btn.dataset.delete;
    state.customs = state.customs.filter((t) => t.id !== id);
    saveCustoms();
    if (state.trackDef.id === id) selectTrack(PRESETS[0]);
    else renderTrackList();
    refocus(state.trackDef.id);
    return;
  }
  const def = [...PRESETS, ...state.customs].find((t) => t.id === btn.dataset.id);
  if (def && def.id !== state.trackDef.id) {
    selectTrack(def);
    refocus(def.id);
  }
});

/* ---------- Wiring ---------- */

els.play.addEventListener('click', () => setRunning(!state.running));

els.restart.addEventListener('click', () => {
  if (state.mode === 'champion') exitChampion();
  state.sim.reset();
  chartDirty = true;
  requestRender();
});

els.champion.addEventListener('click', () => {
  if (state.mode === 'champion') exitChampion();
  else enterChampion();
});

els.draw.addEventListener('click', () => {
  if (state.mode === 'editor') exitEditor(true);
  else enterEditor();
});

els.accept.addEventListener('click', acceptDraft);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.mode === 'editor') exitEditor(true);
});

for (const input of document.querySelectorAll('input[name="speed"]')) {
  input.addEventListener('change', () => {
    state.speed = input.value === 'max' ? 'max' : Number(input.value);
    simAcc = 0;
  });
}

els.pop.addEventListener('input', () => {
  const v = Number(els.pop.value);
  els.popOut.textContent = String(v);
  state.sim.popSize = v; // applies at the next evolve()
});

els.sigma.addEventListener('input', () => {
  const v = Number(els.sigma.value);
  els.sigmaOut.textContent = v.toFixed(2).replace('.', ',');
  state.sim.sigma = v;
});

const ro = new ResizeObserver(() => {
  renderer.resize();
  if (state.mode === 'editor') renderer.setWorldView(editor.worldBounds());
  netviz.resize();
  if (chart.resize()) chartDirty = true;
  requestRender();
});
ro.observe(sceneCanvas);
ro.observe($('netviz'));
ro.observe($('chart'));

/* ---------- Boot ---------- */

state.track = buildTrack(state.trackDef);
state.sim = new Simulation({
  track: state.track,
  popSize: Number(els.pop.value),
  sigma: Number(els.sigma.value),
  rng: makeRng((Math.random() * 0xffffffff) >>> 0),
});
renderer.setTrack(state.track);
renderTrackList();
updateChampionButton();

if (reducedMotion) {
  els.overlayText.textContent =
    'Votre système demande des animations réduites : la simulation ne démarre que sur votre ordre.';
  els.overlayAction.textContent = '▶ Démarrer la simulation';
  els.overlayAction.hidden = false;
  els.overlay.hidden = false;
  els.play.textContent = '▶ Démarrer';
  els.overlayAction.addEventListener('click', () => {
    els.overlay.hidden = true;
    setRunning(true);
  });
  requestRender();
} else {
  setRunning(true);
}
