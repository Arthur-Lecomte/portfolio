// Tables de pruning du two-phase : BFS en largeur depuis l'état résolu dans
// l'espace produit de deux coordonnées. Chaque table donne la distance
// exacte au couple résolu dans cet espace — un minorant admissible de la
// distance réelle (toute solution réelle se projette sur un chemin de même
// longueur dans l'espace des coordonnées).
//
// Module ESM pur : aucune référence au DOM ni au worker, importable sous Node.

import {
  N_TWIST,
  N_FLIP,
  N_SLICE,
  N_PERM8,
  N_SPERM,
  N_MOVES1,
  N_MOVES2,
  SLICE_SOLVED,
} from './coords.js';

// BFS sur l'espace produit (a, b) : dist[a * bSize + b] = distance au départ.
// Les cases jamais atteintes (combinaisons impossibles) restent à 255.
function bfsPair(aMove, aSize, bMove, bSize, numMoves, aStart, bStart) {
  const dist = new Uint8Array(aSize * bSize).fill(255);
  const start = aStart * bSize + bStart;
  dist[start] = 0;
  let frontier = [start];
  let d = 0;
  while (frontier.length > 0) {
    const next = [];
    for (let fi = 0; fi < frontier.length; fi++) {
      const s = frontier[fi];
      const a = (s / bSize) | 0;
      const b = s - a * bSize;
      const ra = a * numMoves;
      const rb = b * numMoves;
      for (let m = 0; m < numMoves; m++) {
        const t = aMove[ra + m] * bSize + bMove[rb + m];
        if (dist[t] === 255) {
          dist[t] = d + 1;
          next.push(t);
        }
      }
    }
    frontier = next;
    d++;
  }
  return dist;
}

// Construit les 4 tables de pruning à partir des tables de mouvements.
export function buildPruneTables(moveTables) {
  const { twistMove, flipMove, sliceMove, cpMove, ep8Move, spMove } = moveTables;
  return {
    // Phase 1 : distance de (twist, slice) / (flip, slice) à l'état résolu.
    prune1a: bfsPair(twistMove, N_TWIST, sliceMove, N_SLICE, N_MOVES1, 0, SLICE_SOLVED),
    prune1b: bfsPair(flipMove, N_FLIP, sliceMove, N_SLICE, N_MOVES1, 0, SLICE_SOLVED),
    // Phase 2 : distance de (cornerPerm, slicePerm) / (edgePerm8, slicePerm).
    prune2a: bfsPair(cpMove, N_PERM8, spMove, N_SPERM, N_MOVES2, 0, 0),
    prune2b: bfsPair(ep8Move, N_PERM8, spMove, N_SPERM, N_MOVES2, 0, 0),
  };
}
