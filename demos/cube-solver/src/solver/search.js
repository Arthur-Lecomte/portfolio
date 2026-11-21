// Recherche IDA* two-phase (algorithme de Kociemba).
//
// Phase 1 : amener le cube dans le sous-groupe H = <U, D, R2, L2, F2, B2>
// (twist = flip = 0, arêtes de tranche dans la tranche), 18 coups possibles,
// profondeur <= 12. Phase 2 : finir dans H avec les 10 coups du sous-groupe.
// On continue d'énumérer des solutions de phase 1 de plus en plus profondes
// en gardant la meilleure solution totale, jusqu'à épuisement du budget de
// temps ou objectif atteint (longueur <= 21).
//
// Les boucles internes ne manipulent QUE des coordonnées via les tables ;
// le modèle cubie n'est utilisé qu'au passage phase 1 -> phase 2 (une fois
// par solution de phase 1, hors boucle interne).
//
// Module ESM pur : aucune référence au DOM ni au worker, importable sous Node.

import { MOVES } from '../cube/facelets.js';
import { MOVE_DELTAS, multiplyCubie } from './cubie.js';
import {
  getTwist,
  getFlip,
  getSlice,
  getCornerPerm,
  getEdgePerm8,
  getSlicePerm,
  SLICE_SOLVED,
  N_SLICE,
  N_SPERM,
  N_MOVES1,
  N_MOVES2,
  PHASE2_GLOBAL,
  IS_PHASE2_GLOBAL,
} from './coords.js';

// MOVES groupe les coups par face (indices 3f..3f+2) ; les faces opposées
// partagent un axe : U/D -> 0, L/R -> 1, F/B -> 2.
const faceOf = (m) => (m / 3) | 0;
const axisOf = (f) => f >> 1;

// Coup redondant : même face que le coup précédent, ou faces opposées
// consécutives dans le « mauvais » ordre (ordre fixe pour casser la symétrie
// des coups qui commutent).
function isRedundant(prevFace, face) {
  return (
    prevFace >= 0 && (face === prevFace || (axisOf(face) === axisOf(prevFace) && face > prevFace))
  );
}

// Lance la recherche two-phase. `tables` = tables de mouvements + pruning,
// `cubieStart` = état cubie à résoudre. Renvoie un tableau de jetons.
export function search(tables, cubieStart, { timeoutMs = 1200, goal = 21 } = {}) {
  const {
    twistMove,
    flipMove,
    sliceMove,
    cpMove,
    ep8Move,
    spMove,
    prune1a,
    prune1b,
    prune2a,
    prune2b,
  } = tables;

  const deadline = Date.now() + Math.max(0, timeoutMs);
  const path1 = new Int32Array(13); // coups de phase 1 (indices MOVES)
  const path2 = new Int32Array(19); // coups de phase 2 (indices MOVES)
  let best = null;
  let bestLen = Infinity;
  let stop = false;
  let timeUp = false;
  let nodes = 0;

  // Le budget est un budget d'AMÉLIORATION : on ne s'arrête sur le temps
  // qu'une fois une première solution trouvée.
  const tick = () => {
    if ((++nodes & 2047) === 0 && Date.now() >= deadline) timeUp = true;
    if (timeUp && best !== null) stop = true;
  };

  // Phase 2 : IDA* sur (cornerPerm, edgePerm8, slicePerm), renvoie true dès
  // qu'une solution de longueur exacte `depth` restante est trouvée.
  function dfs2(cp, e8, sp, depth, prevFace, d2) {
    if (stop) return false;
    tick();
    const h = Math.max(prune2a[cp * N_SPERM + sp], prune2b[e8 * N_SPERM + sp]);
    if (h > depth) return false;
    if (depth === 0) return cp === 0 && e8 === 0 && sp === 0;
    for (let i = 0; i < N_MOVES2; i++) {
      const gm = PHASE2_GLOBAL[i];
      const face = faceOf(gm);
      if (isRedundant(prevFace, face)) continue;
      path2[d2 - depth] = gm;
      if (
        dfs2(
          cpMove[cp * N_MOVES2 + i],
          ep8Move[e8 * N_MOVES2 + i],
          spMove[sp * N_MOVES2 + i],
          depth - 1,
          face,
          d2,
        )
      ) {
        return true;
      }
      if (stop) return false;
    }
    return false;
  }

  // Appelé pour chaque solution de phase 1 de longueur d1 : calcule les
  // coordonnées de phase 2 (via le modèle cubie, une seule fois) puis tente
  // de compléter en gardant la meilleure solution totale.
  function onPhase1Solution(d1) {
    const last = d1 > 0 ? path1[d1 - 1] : -1;
    // Un dernier coup déjà dans la phase 2 donnerait une solution retrouvée
    // plus courte via une phase 1 plus courte : on la rejette.
    if (last >= 0 && IS_PHASE2_GLOBAL[last]) return;

    let c = cubieStart;
    for (let i = 0; i < d1; i++) c = multiplyCubie(c, MOVE_DELTAS[MOVES[path1[i]]]);
    const cp = getCornerPerm(c);
    const e8 = getEdgePerm8(c);
    const sp = getSlicePerm(c);

    const maxD2 = Math.min(18, bestLen - d1 - 1);
    const h0 = Math.max(prune2a[cp * N_SPERM + sp], prune2b[e8 * N_SPERM + sp]);
    const prevFace = last >= 0 ? faceOf(last) : -1;
    for (let d2 = h0; d2 <= maxD2 && !stop; d2++) {
      if (dfs2(cp, e8, sp, d2, prevFace, d2)) {
        bestLen = d1 + d2;
        best = [];
        for (let i = 0; i < d1; i++) best.push(path1[i]);
        for (let i = 0; i < d2; i++) best.push(path2[i]);
        if (bestLen <= goal) stop = true;
        break; // d2 croissant : la première solution est la plus courte
      }
    }
  }

  // Phase 1 : IDA* sur (twist, flip, slice). Énumère TOUTES les solutions de
  // longueur exacte d1 (on ne s'arrête pas à la première).
  function dfs1(twist, flip, slice, depth, prevFace, d1) {
    if (stop) return;
    tick();
    const h = Math.max(prune1a[twist * N_SLICE + slice], prune1b[flip * N_SLICE + slice]);
    if (h > depth) return;
    if (depth === 0) {
      if (twist === 0 && flip === 0 && slice === SLICE_SOLVED) onPhase1Solution(d1);
      return;
    }
    for (let m = 0; m < N_MOVES1; m++) {
      const face = faceOf(m);
      if (isRedundant(prevFace, face)) continue;
      path1[d1 - depth] = m;
      dfs1(
        twistMove[twist * N_MOVES1 + m],
        flipMove[flip * N_MOVES1 + m],
        sliceMove[slice * N_MOVES1 + m],
        depth - 1,
        face,
        d1,
      );
      if (stop) return;
    }
  }

  const twist0 = getTwist(cubieStart);
  const flip0 = getFlip(cubieStart);
  const slice0 = getSlice(cubieStart);

  for (let d1 = 0; d1 <= 12 && !stop; d1++) {
    if (d1 >= bestLen) break; // impossible de faire mieux à cette profondeur
    dfs1(twist0, flip0, slice0, d1, -1, d1);
    if (best !== null && (bestLen <= goal || timeUp || Date.now() >= deadline)) break;
  }

  if (best === null) {
    throw new Error('Aucune solution trouvée : état du cube insoluble.');
  }
  return best.map((m) => MOVES[m]);
}
