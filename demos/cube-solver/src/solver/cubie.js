// Modèle « cubie » du Rubik's Cube : 8 coins (permutation + orientation
// 0..2) et 12 arêtes (permutation + orientation 0..1).
//
// Tout le modèle est DÉRIVÉ de la vérité terrain src/cube/facelets.js :
// - les cubies sont identifiés en regroupant les 54 facettes par position
//   géométrique (faceletPosition) ;
// - les deltas de permutation/orientation des 18 mouvements sont obtenus en
//   appliquant applyMove sur un état étiqueté puis en relisant le résultat
//   au niveau cubie. Le modèle est donc cohérent par construction.
//
// Conventions d'orientation (classiques, type Kociemba) :
// - Les facettes d'un coin sont listées en partant de la facette U/D puis
//   dans le sens horaire vu depuis l'extérieur du coin. L'orientation d'un
//   coin logé dans un emplacement est l'indice de la facette du cubie qui
//   occupe la facette de référence (U/D) de l'emplacement.
// - La facette de référence d'une arête est sa facette U/D si elle existe,
//   sinon sa facette F/B (arêtes de la tranche E). Orientation 0 ou 1.
// - Numérotation des arêtes : 0..7 = arêtes des couches U/D,
//   8..11 = arêtes de la tranche E (ordre fixe dérivé de la géométrie).
//
// Module ESM pur : aucune référence au DOM ni au worker, importable sous Node.

import {
  SOLVED,
  FACES,
  MOVES,
  applyMove,
  faceletPosition,
  faceletNormal,
} from '../cube/facelets.js';

const cross = (u, v) => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

// --- Identification des cubies à partir de la géométrie des facettes ------

function groupFaceletsByCubie() {
  const byPos = new Map();
  for (let i = 0; i < 54; i++) {
    const pos = faceletPosition(i);
    const nz = (pos[0] !== 0) + (pos[1] !== 0) + (pos[2] !== 0);
    if (nz < 2) continue; // facette de centre : position fixe
    const key = pos.join(',');
    if (!byPos.has(key)) byPos.set(key, { pos, facelets: [] });
    byPos.get(key).facelets.push(i);
  }
  const corners = [];
  const edgesUD = [];
  const edgesE = [];
  for (const group of byPos.values()) {
    if (group.facelets.length === 3) corners.push(group);
    else if (group.pos[1] !== 0) edgesUD.push(group);
    else edgesE.push(group);
  }
  if (corners.length !== 8 || edgesUD.length !== 8 || edgesE.length !== 4) {
    throw new Error('Incohérence interne : regroupement des cubies impossible.');
  }
  const byKey = (a, b) => (a.pos.join(',') < b.pos.join(',') ? -1 : 1);
  corners.sort(byKey);
  edgesUD.sort(byKey);
  edgesE.sort(byKey);
  return { corners, edges: [...edgesUD, ...edgesE] };
}

// Ordonne les 3 facettes d'un coin : U/D d'abord, puis sens horaire vu de
// l'extérieur du coin (règle : (n0 × n1) · pos < 0, vérifiée sur URF).
function orderCornerFacelets({ pos, facelets }) {
  const ref = facelets.find((i) => faceletNormal(i)[1] !== 0);
  const [a, b] = facelets.filter((i) => i !== ref);
  const clockwise = dot(cross(faceletNormal(ref), faceletNormal(a)), pos) < 0;
  return clockwise ? [ref, a, b] : [ref, b, a];
}

// Ordonne les 2 facettes d'une arête : U/D (sinon F/B) d'abord.
function orderEdgeFacelets({ facelets }) {
  const ref =
    facelets.find((i) => faceletNormal(i)[1] !== 0) ??
    facelets.find((i) => faceletNormal(i)[2] !== 0);
  return [ref, facelets.find((i) => i !== ref)];
}

const GROUPS = groupFaceletsByCubie();

// CORNER_FACELETS[c] = les 3 indices de facettes de l'emplacement de coin c.
export const CORNER_FACELETS = GROUPS.corners.map(orderCornerFacelets);
// EDGE_FACELETS[e] = les 2 indices de facettes de l'emplacement d'arête e.
export const EDGE_FACELETS = GROUPS.edges.map(orderEdgeFacelets);

// Couleurs (lettres de face) du cubie logé en c/e à l'état résolu.
const CORNER_COLORS = CORNER_FACELETS.map((f) => f.map((i) => SOLVED[i]));
const EDGE_COLORS = EDGE_FACELETS.map((f) => f.map((i) => SOLVED[i]));

// facette -> { cubie, idx } (indice de la facette dans son cubie).
const CORNER_OF_FACELET = new Array(54).fill(null);
CORNER_FACELETS.forEach((f, c) =>
  f.forEach((i, k) => {
    CORNER_OF_FACELET[i] = { cubie: c, idx: k };
  }),
);
const EDGE_OF_FACELET = new Array(54).fill(null);
EDGE_FACELETS.forEach((f, e) =>
  f.forEach((i, k) => {
    EDGE_OF_FACELET[i] = { cubie: e, idx: k };
  }),
);

// --- Deltas cubie des 18 mouvements, dérivés d'applyMove ------------------

// État étiqueté : 54 caractères distincts, pour relire la permutation
// complète des facettes produite par applyMove.
const LABELS = Array.from({ length: 54 }, (_, i) => String.fromCharCode(33 + i)).join('');

function cubieDeltaOf(move) {
  const moved = applyMove(LABELS, move);
  const src = new Array(54); // src[j] = origine de la facette arrivée en j
  for (let j = 0; j < 54; j++) src[j] = LABELS.indexOf(moved[j]);

  const cp = new Array(8);
  const co = new Array(8);
  for (let slot = 0; slot < 8; slot++) {
    const { cubie, idx } = CORNER_OF_FACELET[src[CORNER_FACELETS[slot][0]]];
    cp[slot] = cubie;
    co[slot] = idx;
    // Auto-contrôle : le déplacement doit être rigide et respecter l'ordre
    // horaire des facettes (sinon la convention d'orientation est fausse).
    for (let t = 0; t < 3; t++) {
      if (src[CORNER_FACELETS[slot][t]] !== CORNER_FACELETS[cubie][(idx + t) % 3]) {
        throw new Error('Incohérence interne du modèle cubie (coins).');
      }
    }
  }

  const ep = new Array(12);
  const eo = new Array(12);
  for (let slot = 0; slot < 12; slot++) {
    const { cubie, idx } = EDGE_OF_FACELET[src[EDGE_FACELETS[slot][0]]];
    ep[slot] = cubie;
    eo[slot] = idx;
    for (let t = 0; t < 2; t++) {
      if (src[EDGE_FACELETS[slot][t]] !== EDGE_FACELETS[cubie][(idx + t) % 2]) {
        throw new Error('Incohérence interne du modèle cubie (arêtes).');
      }
    }
  }

  return { cp, co, ep, eo };
}

// MOVE_DELTAS[jeton] = état cubie obtenu en appliquant le coup au cube résolu.
export const MOVE_DELTAS = Object.fromEntries(MOVES.map((m) => [m, cubieDeltaOf(m)]));

// --- Opérations sur les états cubie ---------------------------------------

export function identityCubie() {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

// Produit a · b : état obtenu en appliquant le delta b APRÈS l'état a.
export function multiplyCubie(a, b) {
  const cp = new Array(8);
  const co = new Array(8);
  const ep = new Array(12);
  const eo = new Array(12);
  for (let i = 0; i < 8; i++) {
    const j = b.cp[i];
    cp[i] = a.cp[j];
    co[i] = (a.co[j] + b.co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    const j = b.ep[i];
    ep[i] = a.ep[j];
    eo[i] = (a.eo[j] + b.eo[i]) % 2;
  }
  return { cp, co, ep, eo };
}

// --- Conversion facelets <-> cubie ----------------------------------------

// « couleurs vues dans l'emplacement » -> { cubie, ori } (unicité garantie
// car les couleurs d'un même cubie sont distinctes).
const CORNER_BY_COLORS = new Map();
CORNER_COLORS.forEach((colors, c) => {
  for (let o = 0; o < 3; o++) {
    const key = colors[o] + colors[(o + 1) % 3] + colors[(o + 2) % 3];
    CORNER_BY_COLORS.set(key, { cubie: c, ori: o });
  }
});
const EDGE_BY_COLORS = new Map();
EDGE_COLORS.forEach((colors, e) => {
  for (let o = 0; o < 2; o++) {
    const key = colors[o] + colors[(o + 1) % 2];
    EDGE_BY_COLORS.set(key, { cubie: e, ori: o });
  }
});

// Convertit une chaîne de 54 facettes en état cubie. Lève une erreur si une
// combinaison de facettes ne correspond à aucun cubie ou si un cubie
// apparaît deux fois. (Les contrôles d'orientation/parité sont dans
// validateCubie.)
export function faceletsToCubie(state) {
  const cp = new Array(8);
  const co = new Array(8);
  const ep = new Array(12);
  const eo = new Array(12);

  const seenCorner = new Array(8).fill(false);
  for (let slot = 0; slot < 8; slot++) {
    const [i0, i1, i2] = CORNER_FACELETS[slot];
    const key = state[i0] + state[i1] + state[i2];
    const hit = CORNER_BY_COLORS.get(key);
    if (!hit) {
      throw new Error(`État insoluble : les facettes « ${key} » ne forment aucun coin valide.`);
    }
    if (seenCorner[hit.cubie]) {
      throw new Error('État insoluble : un même coin apparaît deux fois.');
    }
    seenCorner[hit.cubie] = true;
    cp[slot] = hit.cubie;
    co[slot] = hit.ori;
  }

  const seenEdge = new Array(12).fill(false);
  for (let slot = 0; slot < 12; slot++) {
    const [i0, i1] = EDGE_FACELETS[slot];
    const key = state[i0] + state[i1];
    const hit = EDGE_BY_COLORS.get(key);
    if (!hit) {
      throw new Error(`État insoluble : les facettes « ${key} » ne forment aucune arête valide.`);
    }
    if (seenEdge[hit.cubie]) {
      throw new Error('État insoluble : une même arête apparaît deux fois.');
    }
    seenEdge[hit.cubie] = true;
    ep[slot] = hit.cubie;
    eo[slot] = hit.ori;
  }

  return { cp, co, ep, eo };
}

// Reconvertit un état cubie en chaîne de 54 facettes (sans validation :
// utile pour fabriquer des états volontairement insolubles dans les tests).
export function cubieToFacelets(cubie) {
  const out = new Array(54);
  for (let f = 0; f < 6; f++) out[9 * f + 4] = FACES[f];
  for (let slot = 0; slot < 8; slot++) {
    const colors = CORNER_COLORS[cubie.cp[slot]];
    for (let t = 0; t < 3; t++) {
      out[CORNER_FACELETS[slot][t]] = colors[(cubie.co[slot] + t) % 3];
    }
  }
  for (let slot = 0; slot < 12; slot++) {
    const colors = EDGE_COLORS[cubie.ep[slot]];
    for (let t = 0; t < 2; t++) {
      out[EDGE_FACELETS[slot][t]] = colors[(cubie.eo[slot] + t) % 2];
    }
  }
  return out.join('');
}

// --- Validation d'un état cubie -------------------------------------------

export function permutationParity(perm) {
  let parity = 0;
  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) {
      if (perm[j] < perm[i]) parity ^= 1;
    }
  }
  return parity;
}

// Lève une erreur (message en français) si l'état n'est pas atteignable par
// des mouvements légaux depuis l'état résolu.
export function validateCubie(cubie) {
  const twistSum = cubie.co.reduce((s, v) => s + v, 0);
  if (twistSum % 3 !== 0) {
    throw new Error(
      'État insoluble : coin vrillé (somme des orientations des coins non multiple de 3).',
    );
  }
  const flipSum = cubie.eo.reduce((s, v) => s + v, 0);
  if (flipSum % 2 !== 0) {
    throw new Error("État insoluble : arête retournée (nombre impair d'arêtes retournées).");
  }
  if (permutationParity(cubie.cp) !== permutationParity(cubie.ep)) {
    throw new Error(
      'État insoluble : parités des permutations de coins et d’arêtes incompatibles (deux cubies échangés).',
    );
  }
}
