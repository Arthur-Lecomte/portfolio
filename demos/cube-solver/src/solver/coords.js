// Coordonnées du two-phase de Kociemba et tables de mouvements associées.
//
// Phase 1 (18 mouvements) :
//   - twist : orientations des coins, 3^7 = 2187 valeurs ;
//   - flip  : orientations des arêtes, 2^11 = 2048 valeurs ;
//   - slice : combinaison des positions des 4 arêtes de la tranche E
//             (FR, FL, BL, BR) parmi 12, C(12,4) = 495 valeurs (ordre ignoré).
// Phase 2 (10 mouvements : U U' U2 D D' D2 R2 L2 F2 B2) :
//   - cornerPerm : permutation des 8 coins, code de Lehmer, 8! = 40320 ;
//   - edgePerm8  : permutation des 8 arêtes U/D, 40320 ;
//   - slicePerm  : permutation des 4 arêtes de tranche, 4! = 24.
//
// Module ESM pur : aucune référence au DOM ni au worker, importable sous Node.

import { MOVES } from '../cube/facelets.js';
import { MOVE_DELTAS, identityCubie, multiplyCubie } from './cubie.js';

export const N_TWIST = 2187;
export const N_FLIP = 2048;
export const N_SLICE = 495;
export const N_PERM8 = 40320;
export const N_SPERM = 24;
export const N_MOVES1 = 18;
export const N_MOVES2 = 10;

// Les 10 coups de la phase 2 et leurs indices dans MOVES (pour partager la
// logique d'élagage des redondances entre les deux phases).
export const PHASE2_TOKENS = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R2', 'L2', 'F2', 'B2'];
export const PHASE2_GLOBAL = PHASE2_TOKENS.map((t) => MOVES.indexOf(t));
export const IS_PHASE2_GLOBAL = MOVES.map((t) => PHASE2_TOKENS.includes(t));

// Coefficients binomiaux C[n][k] pour n, k <= 12 (C[n][k] = 0 si k > n).
const C = (() => {
  const t = Array.from({ length: 13 }, () => new Array(13).fill(0));
  for (let n = 0; n <= 12; n++) {
    t[n][0] = 1;
    for (let k = 1; k <= n; k++) t[n][k] = t[n - 1][k - 1] + t[n - 1][k];
  }
  return t;
})();

// --- Lecture des coordonnées sur un état cubie ----------------------------

export function getTwist(cubie) {
  let v = 0;
  for (let i = 0; i < 7; i++) v = v * 3 + cubie.co[i];
  return v;
}

export function getFlip(cubie) {
  let v = 0;
  for (let i = 0; i < 11; i++) v = v * 2 + cubie.eo[i];
  return v;
}

// Rang de la combinaison des positions occupées par les arêtes de tranche
// (indices de cubie >= 8) : système combinatoire classique.
export function getSlice(cubie) {
  let r = 0;
  let k = 0;
  for (let j = 0; j < 12; j++) {
    if (cubie.ep[j] >= 8) {
      k++;
      r += C[j][k];
    }
  }
  return r;
}

// Code de Lehmer d'une permutation de n <= 8 éléments (identité -> 0).
export function permToIndex(perm) {
  let idx = 0;
  const n = perm.length;
  for (let i = 0; i < n - 1; i++) {
    let c = 0;
    for (let j = i + 1; j < n; j++) if (perm[j] < perm[i]) c++;
    idx = idx * (n - i) + c;
  }
  return idx;
}

export function indexToPerm(idx, n) {
  const digits = new Array(n).fill(0);
  for (let i = n - 2; i >= 0; i--) {
    digits[i] = idx % (n - i);
    idx = (idx - digits[i]) / (n - i);
  }
  const pool = Array.from({ length: n }, (_, i) => i);
  return digits.map((d) => pool.splice(d, 1)[0]);
}

export function getCornerPerm(cubie) {
  return permToIndex(cubie.cp);
}

// Permutation des 8 arêtes U/D (positions 0..7) — valable uniquement quand
// les arêtes de tranche sont dans la tranche (sous-groupe de la phase 2).
export function getEdgePerm8(cubie) {
  return permToIndex(cubie.ep.slice(0, 8));
}

export function getSlicePerm(cubie) {
  return permToIndex(cubie.ep.slice(8, 12).map((v) => v - 8));
}

// Valeur « résolue » de la coordonnée slice (les autres valent 0).
export const SLICE_SOLVED = getSlice(identityCubie());

// --- Écriture des coordonnées (états représentatifs) ----------------------

function setTwist(cubie, v) {
  let s = 0;
  for (let i = 6; i >= 0; i--) {
    cubie.co[i] = v % 3;
    s += cubie.co[i];
    v = (v - cubie.co[i]) / 3;
  }
  cubie.co[7] = (3 - (s % 3)) % 3;
}

function setFlip(cubie, v) {
  let s = 0;
  for (let i = 10; i >= 0; i--) {
    cubie.eo[i] = v % 2;
    s += cubie.eo[i];
    v = (v - cubie.eo[i]) / 2;
  }
  cubie.eo[11] = s % 2;
}

function setSlice(cubie, r) {
  const pos = new Array(4);
  let j = 11;
  for (let k = 4; k >= 1; k--) {
    while (C[j][k] > r) j--;
    pos[k - 1] = j;
    r -= C[j][k];
    j--;
  }
  const isSlice = new Array(12).fill(false);
  for (const p of pos) isSlice[p] = true;
  let ud = 0;
  let sl = 8;
  for (let i = 0; i < 12; i++) cubie.ep[i] = isSlice[i] ? sl++ : ud++;
}

// --- Tables de mouvements --------------------------------------------------

// table[v * nbCoups + m] = coordonnée après application du coup m à un état
// représentatif de coordonnée v. Les coordonnées sont indépendantes : un
// représentatif quelconque suffit.
export function buildMoveTables() {
  const deltas1 = MOVES.map((t) => MOVE_DELTAS[t]);
  const deltas2 = PHASE2_TOKENS.map((t) => MOVE_DELTAS[t]);

  const twistMove = new Uint16Array(N_TWIST * N_MOVES1);
  for (let v = 0; v < N_TWIST; v++) {
    const c = identityCubie();
    setTwist(c, v);
    for (let m = 0; m < N_MOVES1; m++) {
      twistMove[v * N_MOVES1 + m] = getTwist(multiplyCubie(c, deltas1[m]));
    }
  }

  const flipMove = new Uint16Array(N_FLIP * N_MOVES1);
  for (let v = 0; v < N_FLIP; v++) {
    const c = identityCubie();
    setFlip(c, v);
    for (let m = 0; m < N_MOVES1; m++) {
      flipMove[v * N_MOVES1 + m] = getFlip(multiplyCubie(c, deltas1[m]));
    }
  }

  const sliceMove = new Uint16Array(N_SLICE * N_MOVES1);
  for (let v = 0; v < N_SLICE; v++) {
    const c = identityCubie();
    setSlice(c, v);
    for (let m = 0; m < N_MOVES1; m++) {
      sliceMove[v * N_MOVES1 + m] = getSlice(multiplyCubie(c, deltas1[m]));
    }
  }

  const cpMove = new Uint16Array(N_PERM8 * N_MOVES2);
  const ep8Move = new Uint16Array(N_PERM8 * N_MOVES2);
  for (let v = 0; v < N_PERM8; v++) {
    const perm = indexToPerm(v, 8);
    const cc = identityCubie();
    cc.cp = perm.slice();
    const ce = identityCubie();
    for (let i = 0; i < 8; i++) ce.ep[i] = perm[i];
    for (let m = 0; m < N_MOVES2; m++) {
      cpMove[v * N_MOVES2 + m] = permToIndex(multiplyCubie(cc, deltas2[m]).cp);
      ep8Move[v * N_MOVES2 + m] = permToIndex(multiplyCubie(ce, deltas2[m]).ep.slice(0, 8));
    }
  }

  const spMove = new Uint8Array(N_SPERM * N_MOVES2);
  for (let v = 0; v < N_SPERM; v++) {
    const c = identityCubie();
    const p4 = indexToPerm(v, 4);
    for (let i = 0; i < 4; i++) c.ep[8 + i] = 8 + p4[i];
    for (let m = 0; m < N_MOVES2; m++) {
      spMove[v * N_MOVES2 + m] = permToIndex(
        multiplyCubie(c, deltas2[m])
          .ep.slice(8, 12)
          .map((x) => x - 8),
      );
    }
  }

  return { twistMove, flipMove, sliceMove, cpMove, ep8Move, spMove };
}
