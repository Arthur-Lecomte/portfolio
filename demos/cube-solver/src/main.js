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
const CLE_ETAT = 'cube-solver:state';
const CLE_VITESSE = 'cube-solver:speed';

const VITESSE_DEFAUT = 220; // ms par quart de tour
const VITESSE_MIN = 80; // rapide
const VITESSE_MAX = 600; // lent

// --- Éléments de l'interface ----------------------------------------------

const statutEl = document.getElementById('statut');
const btnMelanger = document.getElementById('btn-melanger');
const btnResoudre = document.getElementById('btn-resoudre');
const btnReinitialiser = document.getElementById('btn-reinitialiser');
const curseurVitesse = document.getElementById('curseur-vitesse');
const panneauSolution = document.getElementById('panneau-solution');
const solutionTitre = document.getElementById('solution-titre');
const solutionListe = document.getElementById('solution-liste');
const btnPrecedent = document.getElementById('btn-precedent');
const btnLecture = document.getElementById('btn-lecture');
const btnSuivant = document.getElementById('btn-suivant');
const boutonsCoups = [...document.querySelectorAll('.grille-coups [data-move]')];

function setStatut(texte) {
  statutEl.textContent = texte;
}

const libelleCoups = (n) => `${n} ${n > 1 ? 'coups' : 'coup'}`;

// --- État logique et persistance -------------------------------------------

// localStorage peut lever : SecurityError si le stockage est bloqué
// (cookies interdits, iframe sandbox), QuotaExceededError s'il est plein.
// La démo doit fonctionner sans sauvegarde plutôt que mourir.
function lireStockage(cle) {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}

const etatSauvegarde = lireStockage(CLE_ETAT);
let etat = isStructurallyValid(etatSauvegarde) ? etatSauvegarde : SOLVED;

let vitesse = Number(lireStockage(CLE_VITESSE));
if (!Number.isFinite(vitesse) || vitesse < VITESSE_MIN || vitesse > VITESSE_MAX) {
  vitesse = VITESSE_DEFAUT;
}

function persister() {
  ecrireStockage(CLE_ETAT, etat);
}

// Chaque coup committé (drag utilisateur ou file d'animation) est appliqué
// à l'état logique puis persisté : la géométrie 3D et l'état restent
// toujours synchronisés.
function coupCommis(move) {
  etat = applyMove(etat, move);
  persister();
}

// --- Modes et verrouillage --------------------------------------------------

// 'libre' : interactions normales ; 'melange' : lot de mélange en cours ;
// 'solution' : panneau solution actif (lecture ou navigation pas-à-pas).
let mode = 'libre';
let lecture = false; // lecture automatique de la solution
let lectureTerminee = false; // la lecture a atteint la fin au moins une fois
let rechercheEnCours = false;
let solveurPret = false;
let solution = [];
let curseur = 0; // nombre de coups de la solution actuellement appliqués
let enVol = 0; // coups de solution enfilés mais pas encore committés
let session = 0; // invalide les réponses du solveur après Réinitialiser
let boutonPasActif = null; // dernier bouton ⏮/⏭ activé (restauration du focus)

function estVerrouille() {
  return mode === 'melange' || rechercheEnCours || (mode === 'solution' && !lectureTerminee);
}

function majControles() {
  const verrou = estVerrouille();
  // Tant qu'un coup est en vol (file, animation, drag ou recalage), l'état
  // logique peut encore bouger : Mélanger et Résoudre attendent.
  const occupe = vue.estOccupee();
  btnMelanger.disabled = verrou || occupe;
  btnResoudre.disabled = verrou || occupe || !solveurPret || mode === 'solution';
  for (const bouton of boutonsCoups) bouton.disabled = verrou;
  vue.setDragEnabled(!verrou);

  const enSolution = mode === 'solution';
  btnLecture.disabled = !enSolution;
  btnPrecedent.disabled = !enSolution || lecture || enVol > 0 || curseur === 0;
  btnSuivant.disabled = !enSolution || lecture || enVol > 0 || curseur >= solution.length;
}

// Désactiver ⏮/⏭ pendant l'animation fait tomber le focus clavier sur
// <body> : on le rend au bouton (ou à son jumeau en bout de course) pour
// que la navigation pas-à-pas reste utilisable au clavier.
function restaurerFocusPas() {
  if (!boutonPasActif || document.activeElement !== document.body) return;
  const jumeau = boutonPasActif === btnSuivant ? btnPrecedent : btnSuivant;
  const cible = boutonPasActif.disabled ? jumeau : boutonPasActif;
  if (!cible.disabled) cible.focus();
}

// --- Panneau solution --------------------------------------------------------

function afficherSolution() {
  solutionTitre.textContent = `Solution : ${libelleCoups(solution.length)}`;
  solutionListe.textContent = '';
  for (const move of solution) {
    const puce = document.createElement('li');
    puce.textContent = move;
    solutionListe.appendChild(puce);
  }
  panneauSolution.hidden = false;
}

function cacherSolution() {
  panneauSolution.hidden = true;
  solutionListe.textContent = '';
}

// Surligne le coup courant et le garde visible (auto-scroll).
function surligner(index) {
  const puces = solutionListe.children;
  for (const puce of puces) puce.classList.remove('courant');
  const puce = puces[index];
  if (puce) {
    puce.classList.add('courant');
    // behavior:'smooth' en JS outrepasserait la CSS : on respecte ici même
    // la préférence « réduire les animations ».
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    puce.scrollIntoView({ block: 'nearest', behavior: reduit ? 'auto' : 'smooth' });
  }
}

// Sort du mode solution (le panneau devient obsolète après un coup libre).
function quitterSolution() {
  if (mode !== 'solution') return;
  mode = 'libre';
  lecture = false;
  boutonPasActif = null;
  cacherSolution();
  majControles();
}

// Enfile le prochain coup de la solution si la lecture est active.
function pomper() {
  if (mode !== 'solution' || !lecture || enVol > 0) return;
  if (curseur >= solution.length) return;
  enVol++;
  vue.enqueue([solution[curseur]], 'solution');
}

// --- Vue 3D ------------------------------------------------------------------

const callbacksVue = {
  // Geste de drag utilisateur committé : la géométrie est déjà figée.
  onUserMove(move) {
    coupCommis(move);
    quitterSolution();
    majControles();
  },

  onMoveStart(move, meta) {
    if (meta === 'solution') surligner(curseur);
    else if (meta === 'solution-retour') surligner(curseur - 1);
  },

  onMoveCommitted(move, meta) {
    coupCommis(move);
    if (meta === 'solution' || meta === 'solution-retour') {
      enVol = Math.max(0, enVol - 1);
    }
    if (mode === 'solution') {
      if (meta === 'solution') {
        curseur++;
        if (curseur >= solution.length) {
          lecture = false;
          lectureTerminee = true;
          surligner(solution.length - 1);
          // Ceinture et bretelles : ne crier victoire que si c'est vrai.
          setStatut(
            isSolved(etat)
              ? `Résolu en ${libelleCoups(solution.length)} ✓`
              : 'Lecture terminée — le cube a bougé entre-temps.',
          );
        } else if (lecture) {
          pomper();
        } else {
          surligner(curseur);
        }
        majControles();
        restaurerFocusPas();
      } else if (meta === 'solution-retour') {
        curseur--;
        surligner(curseur);
        // Si ⏯ a été pressé pendant que ce coup retour était en vol, la
        // lecture est active mais rien n'a pu être pompé (enVol > 0) :
        // on relance ici, sinon elle resterait figée à jamais.
        if (lecture) pomper();
        majControles();
        restaurerFocusPas();
      } else if (meta === 'manuel' || meta === 'melange') {
        // Un coup hors solution rend le panneau obsolète.
        quitterSolution();
      }
    }
  },

  onQueueEmpty() {
    if (mode === 'melange') {
      mode = 'libre';
      vue.setSpeed(vitesse);
      setStatut('Cube mélangé — à vous de jouer !');
    }
    majControles(); // réactive Mélanger/Résoudre une fois la file épuisée
  },
};

// WebGL peut manquer (accélération coupée, VM, pilote sur liste noire) :
// plutôt qu'une exception brute et un « Chargement… » éternel, on informe
// et on neutralise l'interface.
let vue;
try {
  vue = createCubeView(document.getElementById('scene'), callbacksVue);
} catch (erreur) {
  setStatut('Affichage 3D indisponible sur cet appareil (WebGL requis).');
  const controles = [
    btnMelanger,
    btnResoudre,
    btnReinitialiser,
    btnLecture,
    btnPrecedent,
    btnSuivant,
    curseurVitesse,
    ...boutonsCoups,
  ];
  for (const controle of controles) controle.disabled = true;
  throw erreur; // stoppe le reste du module ; la page reste informative
}

vue.setSpeed(vitesse);
// Restaure la position sauvegardée (géométrie remise à l'identité + stickers).
vue.setFacelets(etat);

// --- Solveur (Web Worker) ----------------------------------------------------

const solveur = createSolver();
setStatut('Préparation du solveur…');
solveur.ready
  .then(() => {
    solveurPret = true;
    setStatut('Solveur prêt. À vous de jouer !');
    majControles();
  })
  .catch((erreur) => {
    setStatut(erreur?.message || 'Solveur indisponible.');
  });

// --- Actions -----------------------------------------------------------------

btnMelanger.addEventListener('click', () => {
  if (estVerrouille()) return;
  quitterSolution();
  mode = 'melange';
  majControles();
  setStatut('Mélange en cours…');
  // Lot de mélange accéléré, la vitesse utilisateur revient à la fin.
  vue.setSpeed(Math.min(vitesse, 120));
  vue.enqueue(randomScramble(25), 'melange');
});

btnResoudre.addEventListener('click', () => {
  if (estVerrouille() || !solveurPret || mode === 'solution') return;
  if (vue.estOccupee()) return; // un coup est encore en vol (garde anti-course)
  if (isSolved(etat)) {
    setStatut('Déjà résolu !');
    return;
  }
  rechercheEnCours = true;
  majControles(); // coupe le drag : un recalage en vol se committe ici même
  setStatut('Recherche de la solution…');
  const maSession = session;
  const etatEnvoye = etat; // photographie APRÈS la purge du drag
  solveur
    .solve(etatEnvoye)
    .then((coups) => {
      if (maSession !== session) return; // réinitialisé entre-temps
      rechercheEnCours = false;
      if (etat !== etatEnvoye) {
        // Un coup s'est committé pendant la recherche : solution périmée.
        setStatut('Le cube a bougé pendant la recherche — réessayez.');
        majControles();
        return;
      }
      if (coups.length === 0) {
        setStatut('Déjà résolu !');
        majControles();
        return;
      }
      solution = coups;
      curseur = 0;
      enVol = 0;
      lecture = true;
      lectureTerminee = false;
      mode = 'solution';
      afficherSolution();
      surligner(0);
      vue.setSpeed(vitesse);
      setStatut(`Solution : ${libelleCoups(coups.length)} — lecture…`);
      majControles();
      pomper();
    })
    .catch((erreur) => {
      if (maSession !== session) return;
      rechercheEnCours = false;
      setStatut(erreur?.message || 'Résolution impossible.');
      majControles();
    });
});

// Réinitialiser : toujours actif, interrompt tout proprement.
btnReinitialiser.addEventListener('click', () => {
  session++;
  mode = 'libre';
  lecture = false;
  lectureTerminee = false;
  rechercheEnCours = false;
  solution = [];
  curseur = 0;
  enVol = 0;
  boutonPasActif = null;
  cacherSolution();
  vue.clearQueue(); // termine proprement le coup en cours
  vue.setFacelets(SOLVED);
  etat = SOLVED;
  persister();
  vue.setSpeed(vitesse);
  majControles();
  setStatut('Cube réinitialisé.');
});

// --- Lecture de la solution ---------------------------------------------------

btnLecture.addEventListener('click', () => {
  if (mode !== 'solution') return;
  if (lecture) {
    lecture = false;
    setStatut('Lecture en pause — naviguez coup par coup.');
  } else if (curseur < solution.length) {
    lecture = true;
    // Une relecture (après ⏮ en fin de lecture) redevient une lecture
    // active à part entière : les entrées doivent se reverrouiller.
    lectureTerminee = false;
    setStatut('Lecture de la solution…');
    pomper();
  }
  majControles();
});

btnSuivant.addEventListener('click', () => {
  if (mode !== 'solution' || lecture || enVol > 0) return;
  if (curseur >= solution.length) return;
  boutonPasActif = btnSuivant;
  enVol++;
  vue.enqueue([solution[curseur]], 'solution');
  majControles();
});

// Rejoue le coup précédent à l'envers, géométriquement et logiquement.
btnPrecedent.addEventListener('click', () => {
  if (mode !== 'solution' || lecture || enVol > 0) return;
  if (curseur === 0) return;
  boutonPasActif = btnPrecedent;
  enVol++;
  vue.enqueue([invertMove(solution[curseur - 1])], 'solution-retour');
  majControles();
});

// --- Coups manuels (boutons + clavier) ----------------------------------------

for (const bouton of boutonsCoups) {
  bouton.addEventListener('click', () => {
    if (estVerrouille()) return;
    vue.enqueue([bouton.dataset.move], 'manuel');
    majControles(); // gèle Mélanger/Résoudre le temps de l'animation
  });
}

const FACES_CLAVIER = { u: 'U', d: 'D', l: 'L', r: 'R', f: 'F', b: 'B' };
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const cible = e.target;
  if (
    cible instanceof HTMLElement &&
    (cible.matches('input, textarea, select') || cible.isContentEditable)
  ) {
    return;
  }
  const face = FACES_CLAVIER[e.key.toLowerCase()];
  if (!face) return;
  if (estVerrouille()) return;
  vue.enqueue([face + (e.shiftKey ? "'" : '')], 'manuel');
  majControles(); // gèle Mélanger/Résoudre le temps de l'animation
  e.preventDefault();
});

// --- Curseur de vitesse --------------------------------------------------------

// Le curseur affiche « lent -> rapide » : valeur = 680 - durée (ms).
curseurVitesse.value = String(VITESSE_MIN + VITESSE_MAX - vitesse);
curseurVitesse.addEventListener('input', () => {
  vitesse = VITESSE_MIN + VITESSE_MAX - Number(curseurVitesse.value);
  ecrireStockage(CLE_VITESSE, String(vitesse));
  vue.setSpeed(mode === 'melange' ? Math.min(vitesse, 120) : vitesse);
});

majControles();
