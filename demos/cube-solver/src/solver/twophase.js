// Façade du solveur two-phase de Kociemba.
//
//   initTables()            : construit (une seule fois) les tables de
//                             mouvements et de pruning (~1 à 2 s).
//   solve(facelets, opts)   : renvoie un tableau de jetons (sous-ensemble de
//                             MOVES) amenant l'état à SOLVED. Cube déjà
//                             résolu -> []. État invalide/insoluble -> Error
//                             au message français explicite.
//                             opts.timeoutMs (défaut 1200) est un budget
//                             d'amélioration : la meilleure solution trouvée
//                             dans le budget est renvoyée (longueur typique
//                             <= 23, jamais de rejet pour cause de temps).
//
// Module ESM pur : aucune référence au DOM ni au worker, importable sous Node.

import { SOLVED, MOVES, applyMove, isStructurallyValid } from '../cube/facelets.js';
import { faceletsToCubie, validateCubie } from './cubie.js';
import { buildMoveTables } from './coords.js';
import { buildPruneTables } from './prune.js';
import { search } from './search.js';

let tables = null;

// Construit les tables (idempotent) et les renvoie.
export function initTables() {
  if (tables === null) {
    const moveTables = buildMoveTables();
    const pruneTables = buildPruneTables(moveTables);
    tables = { ...moveTables, ...pruneTables };
  }
  return tables;
}

// Les états à un ou deux coups de la solution méritent la réponse évidente :
// la two-phase, elle, s'arrête dès que son objectif (<= 21 coups) est atteint
// et peut donc renvoyer ~8 coups pour un cube à un quart de tour de SOLVED.
function solutionTriviale(facelets) {
  for (const m1 of MOVES) {
    const e1 = applyMove(facelets, m1);
    if (e1 === SOLVED) return [m1];
    for (const m2 of MOVES) {
      if (m2[0] === m1[0]) continue; // même face : se réduit à un seul coup
      if (applyMove(e1, m2) === SOLVED) return [m1, m2];
    }
  }
  return null;
}

// Résout l'état `facelets` (chaîne de 54 caractères, faces U,R,F,D,L,B).
export function solve(facelets, opts = {}) {
  if (typeof facelets !== 'string' || facelets.length !== 54) {
    throw new Error('État invalide : une chaîne de 54 facettes est attendue.');
  }
  if (!isStructurallyValid(facelets)) {
    throw new Error('État invalide : répartition des couleurs ou centres incorrects.');
  }
  if (facelets === SOLVED) return [];

  const cubie = faceletsToCubie(facelets); // lève si cubie inconnu/en double
  validateCubie(cubie); // lève si orientation ou parité insoluble

  const triviale = solutionTriviale(facelets);
  if (triviale) return triviale;

  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 1200;
  return search(initTables(), cubie, { timeoutMs });
}
