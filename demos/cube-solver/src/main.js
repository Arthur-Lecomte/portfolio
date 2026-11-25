// Point d'entrée : détient l'état logique du cube (chaîne de 54 facettes),
// relie la vue 3D, le solveur (Web Worker) et le panneau de contrôle.

import './style.css';
import {
  SOLVED,
  applyMove,
  invertMove,
  isSolved,
  isStructurallyValid,
  randomScramble,
} from './cube/facelets.js';
import { createCubeView } from './render/cubeView.js';
import { createSolver } from './solver/client.js';

// RÈGLE PORTFOLIO — clés localStorage préfixées par le slug du projet.
const STATE_KEY = 'cube-solver:state';
const SPEED_KEY = 'cube-solver:speed';

const SPEED_DEFAULT = 220; // ms par quart de tour
const SPEED_MIN = 80; // rapide
const SPEED_MAX = 600; // lent

// --- Éléments de l'interface ----------------------------------------------

const statusEl = document.getElementById('status');
const scrambleBtn = document.getElementById('btn-scramble');
const solveBtn = document.getElementById('btn-solve');
const resetBtn = document.getElementById('btn-reset');
const speedSlider = document.getElementById('speed-slider');
const solutionPanel = document.getElementById('solution-panel');
const solutionTitle = document.getElementById('solution-title');
const solutionList = document.getElementById('solution-list');
const prevBtn = document.getElementById('btn-prev');
const playBtn = document.getElementById('btn-play');
const nextBtn = document.getElementById('btn-next');
const moveButtons = [...document.querySelectorAll('.moves-grid [data-move]')];

function setStatus(text) {
  statusEl.textContent = text;
}

const moveCountLabel = (n) => `${n} ${n > 1 ? 'coups' : 'coup'}`;

// --- État logique et persistance -------------------------------------------

// localStorage peut lever : SecurityError si le stockage est bloqué
// (cookies interdits, iframe sandbox), QuotaExceededError s'il est plein.
// La démo doit fonctionner sans sauvegarde plutôt que mourir.
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}

const savedState = readStorage(STATE_KEY);
let state = isStructurallyValid(savedState) ? savedState : SOLVED;

let speed = Number(readStorage(SPEED_KEY));
if (!Number.isFinite(speed) || speed < SPEED_MIN || speed > SPEED_MAX) {
  speed = SPEED_DEFAULT;
}

function persist() {
  writeStorage(STATE_KEY, state);
}

// Chaque coup committé (drag utilisateur ou file d'animation) est appliqué
// à l'état logique puis persisté : la géométrie 3D et l'état restent
// toujours synchronisés.
function commitMove(move) {
  state = applyMove(state, move);
  persist();
}

// --- Modes et verrouillage --------------------------------------------------

// 'free' : interactions normales ; 'scramble' : lot de mélange en cours ;
// 'solution' : panneau solution actif (lecture ou navigation pas-à-pas).
let mode = 'free';
let playing = false; // lecture automatique de la solution
let playbackDone = false; // la lecture a atteint la fin au moins une fois
let searching = false;
let solverReady = false;
let solution = [];
let cursor = 0; // nombre de coups de la solution actuellement appliqués
let inFlight = 0; // coups de solution enfilés mais pas encore committés
let session = 0; // invalide les réponses du solveur après Réinitialiser
let activeStepBtn = null; // dernier bouton ⏮/⏭ activé (restauration du focus)

function isLocked() {
  return mode === 'scramble' || searching || (mode === 'solution' && !playbackDone);
}

function updateControls() {
  const locked = isLocked();
  // Tant qu'un coup est en vol (file, animation, drag ou recalage), l'état
  // logique peut encore bouger : Mélanger et Résoudre attendent.
  const busy = view.isBusy();
  scrambleBtn.disabled = locked || busy;
  solveBtn.disabled = locked || busy || !solverReady || mode === 'solution';
  for (const button of moveButtons) button.disabled = locked;
  view.setDragEnabled(!locked);

  const inSolution = mode === 'solution';
  playBtn.disabled = !inSolution;
  // Charte : le bouton affiche l'action qu'il déclenche (Lecture / Pause).
  playBtn.textContent = playing ? 'Pause' : 'Lecture';
  prevBtn.disabled = !inSolution || playing || inFlight > 0 || cursor === 0;
  nextBtn.disabled = !inSolution || playing || inFlight > 0 || cursor >= solution.length;
}

// Désactiver ⏮/⏭ pendant l'animation fait tomber le focus clavier sur
// <body> : on le rend au bouton (ou à son jumeau en bout de course) pour
// que la navigation pas-à-pas reste utilisable au clavier.
function restoreStepFocus() {
  if (!activeStepBtn || document.activeElement !== document.body) return;
  const twin = activeStepBtn === nextBtn ? prevBtn : nextBtn;
  const target = activeStepBtn.disabled ? twin : activeStepBtn;
  if (!target.disabled) target.focus();
}

// --- Panneau solution --------------------------------------------------------

function showSolution() {
  solutionTitle.textContent = `Solution : ${moveCountLabel(solution.length)}`;
  solutionList.textContent = '';
  for (const move of solution) {
    const chip = document.createElement('li');
    chip.textContent = move;
    solutionList.appendChild(chip);
  }
  solutionPanel.hidden = false;
}

function hideSolution() {
  solutionPanel.hidden = true;
  solutionList.textContent = '';
}

// Surligne le coup courant et le garde visible (auto-scroll).
function highlight(index) {
  const chips = solutionList.children;
  for (const chip of chips) chip.classList.remove('current');
  const chip = chips[index];
  if (chip) {
    chip.classList.add('current');
    // behavior:'smooth' en JS outrepasserait la CSS : on respecte ici même
    // la préférence « réduire les animations ».
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    chip.scrollIntoView({
      block: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }
}

// Sort du mode solution (le panneau devient obsolète après un coup libre).
function exitSolution() {
  if (mode !== 'solution') return;
  mode = 'free';
  playing = false;
  activeStepBtn = null;
  hideSolution();
  updateControls();
}

// Enfile le prochain coup de la solution si la lecture est active.
function pump() {
  if (mode !== 'solution' || !playing || inFlight > 0) return;
  if (cursor >= solution.length) return;
  inFlight++;
  view.enqueue([solution[cursor]], 'solution');
}

// --- Vue 3D ------------------------------------------------------------------

const viewCallbacks = {
  // Geste de drag utilisateur committé : la géométrie est déjà figée.
  onUserMove(move) {
    commitMove(move);
    exitSolution();
    updateControls();
  },

  onMoveStart(move, meta) {
    if (meta === 'solution') highlight(cursor);
    else if (meta === 'solution-back') highlight(cursor - 1);
  },

  onMoveCommitted(move, meta) {
    commitMove(move);
    if (meta === 'solution' || meta === 'solution-back') {
      inFlight = Math.max(0, inFlight - 1);
    }
    if (mode === 'solution') {
      if (meta === 'solution') {
        cursor++;
        if (cursor >= solution.length) {
          playing = false;
          playbackDone = true;
          highlight(solution.length - 1);
          // Ceinture et bretelles : ne crier victoire que si c'est vrai.
          setStatus(
            isSolved(state)
              ? `Résolu en ${moveCountLabel(solution.length)} ✓`
              : 'Lecture terminée — le cube a bougé entre-temps.',
          );
        } else if (playing) {
          pump();
        } else {
          highlight(cursor);
        }
        updateControls();
        restoreStepFocus();
      } else if (meta === 'solution-back') {
        cursor--;
        highlight(cursor);
        // Si Lecture a été pressé pendant que ce coup retour était en vol,
        // la lecture est active mais rien n'a pu être pompé (inFlight > 0) :
        // on relance ici, sinon elle resterait figée à jamais.
        if (playing) pump();
        updateControls();
        restoreStepFocus();
      } else if (meta === 'manual' || meta === 'scramble') {
        // Un coup hors solution rend le panneau obsolète.
        exitSolution();
      }
    }
  },

  onQueueEmpty() {
    if (mode === 'scramble') {
      mode = 'free';
      view.setSpeed(speed);
      setStatus('Cube mélangé — à vous de jouer !');
    }
    updateControls(); // réactive Mélanger/Résoudre une fois la file épuisée
  },
};

// WebGL peut manquer (accélération coupée, VM, pilote sur liste noire) :
// plutôt qu'une exception brute et un « Chargement… » éternel, on informe
// et on neutralise l'interface.
let view;
try {
  view = createCubeView(document.getElementById('scene'), viewCallbacks);
} catch (error) {
  setStatus('Affichage 3D indisponible sur cet appareil (WebGL requis).');
  const controls = [
    scrambleBtn,
    solveBtn,
    resetBtn,
    playBtn,
    prevBtn,
    nextBtn,
    speedSlider,
    ...moveButtons,
  ];
  for (const control of controls) control.disabled = true;
  throw error; // stoppe le reste du module ; la page reste informative
}

view.setSpeed(speed);
// Restaure la position sauvegardée (géométrie remise à l'identité + stickers).
view.setFacelets(state);

// --- Solveur (Web Worker) ----------------------------------------------------

const solver = createSolver();
setStatus('Préparation du solveur…');
solver.ready
  .then(() => {
    solverReady = true;
    setStatus('Solveur prêt. À vous de jouer !');
    updateControls();
  })
  .catch((error) => {
    setStatus(error?.message || 'Solveur indisponible.');
  });

// --- Actions -----------------------------------------------------------------

scrambleBtn.addEventListener('click', () => {
  if (isLocked()) return;
  exitSolution();
  mode = 'scramble';
  updateControls();
  setStatus('Mélange en cours…');
  // Lot de mélange accéléré, la vitesse utilisateur revient à la fin.
  view.setSpeed(Math.min(speed, 120));
  view.enqueue(randomScramble(25), 'scramble');
});

solveBtn.addEventListener('click', () => {
  if (isLocked() || !solverReady || mode === 'solution') return;
  if (view.isBusy()) return; // un coup est encore en vol (garde anti-course)
  if (isSolved(state)) {
    setStatus('Déjà résolu !');
    return;
  }
  searching = true;
  updateControls(); // coupe le drag : un recalage en vol se committe ici même
  setStatus('Recherche de la solution…');
  const mySession = session;
  const sentState = state; // photographie APRÈS la purge du drag
  solver
    .solve(sentState)
    .then((moves) => {
      if (mySession !== session) return; // réinitialisé entre-temps
      searching = false;
      if (state !== sentState) {
        // Un coup s'est committé pendant la recherche : solution périmée.
        setStatus('Le cube a bougé pendant la recherche — réessayez.');
        updateControls();
        return;
      }
      if (moves.length === 0) {
        setStatus('Déjà résolu !');
        updateControls();
        return;
      }
      solution = moves;
      cursor = 0;
      inFlight = 0;
      playing = true;
      playbackDone = false;
      mode = 'solution';
      showSolution();
      highlight(0);
      view.setSpeed(speed);
      setStatus(`Solution : ${moveCountLabel(moves.length)} — lecture…`);
      updateControls();
      pump();
    })
    .catch((error) => {
      if (mySession !== session) return;
      searching = false;
      setStatus(error?.message || 'Résolution impossible.');
      updateControls();
    });
});

// Réinitialiser : toujours actif, interrompt tout proprement.
resetBtn.addEventListener('click', () => {
  session++;
  mode = 'free';
  playing = false;
  playbackDone = false;
  searching = false;
  solution = [];
  cursor = 0;
  inFlight = 0;
  activeStepBtn = null;
  hideSolution();
  view.clearQueue(); // termine proprement le coup en cours
  view.setFacelets(SOLVED);
  state = SOLVED;
  persist();
  view.setSpeed(speed);
  updateControls();
  setStatus('Cube réinitialisé.');
});

// --- Lecture de la solution ---------------------------------------------------

playBtn.addEventListener('click', () => {
  if (mode !== 'solution') return;
  if (playing) {
    playing = false;
    setStatus('Lecture en pause — naviguez coup par coup.');
  } else if (cursor < solution.length) {
    playing = true;
    // Une relecture (après Précédent en fin de lecture) redevient une
    // lecture active à part entière : les entrées doivent se reverrouiller.
    playbackDone = false;
    setStatus('Lecture de la solution…');
    pump();
  }
  updateControls();
});

nextBtn.addEventListener('click', () => {
  if (mode !== 'solution' || playing || inFlight > 0) return;
  if (cursor >= solution.length) return;
  activeStepBtn = nextBtn;
  inFlight++;
  view.enqueue([solution[cursor]], 'solution');
  updateControls();
});

// Rejoue le coup précédent à l'envers, géométriquement et logiquement.
prevBtn.addEventListener('click', () => {
  if (mode !== 'solution' || playing || inFlight > 0) return;
  if (cursor === 0) return;
  activeStepBtn = prevBtn;
  inFlight++;
  view.enqueue([invertMove(solution[cursor - 1])], 'solution-back');
  updateControls();
});

// --- Coups manuels (boutons + clavier) ----------------------------------------

for (const button of moveButtons) {
  button.addEventListener('click', () => {
    if (isLocked()) return;
    view.enqueue([button.dataset.move], 'manual');
    updateControls(); // gèle Mélanger/Résoudre le temps de l'animation
  });
}

const KEYBOARD_FACES = { u: 'U', d: 'D', l: 'L', r: 'R', f: 'F', b: 'B' };
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target;
  if (
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable)
  ) {
    return;
  }
  const face = KEYBOARD_FACES[e.key.toLowerCase()];
  if (!face) return;
  if (isLocked()) return;
  view.enqueue([face + (e.shiftKey ? "'" : '')], 'manual');
  updateControls(); // gèle Mélanger/Résoudre le temps de l'animation
  e.preventDefault();
});

// --- Curseur de vitesse --------------------------------------------------------

// Le curseur affiche « lent -> rapide » : valeur = 680 - durée (ms).
speedSlider.value = String(SPEED_MIN + SPEED_MAX - speed);
speedSlider.addEventListener('input', () => {
  speed = SPEED_MIN + SPEED_MAX - Number(speedSlider.value);
  writeStorage(SPEED_KEY, String(speed));
  view.setSpeed(mode === 'scramble' ? Math.min(speed, 120) : speed);
});

updateControls();
