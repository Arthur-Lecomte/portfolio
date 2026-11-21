// Modèle logique du cube : chaîne de 54 facettes, convention Kociemba.
// Ordre des faces : U, R, F, D, L, B — 9 facettes chacune, lues ligne par
// ligne sur le patron ci-dessous (U1 → index 0, …, B9 → index 53) :
//
//              |U1 U2 U3|
//              |U4 U5 U6|
//              |U7 U8 U9|
//  |L1 L2 L3|  |F1 F2 F3|  |R1 R2 R3|  |B1 B2 B3|
//  |L4 L5 L6|  |F4 F5 F6|  |R4 R5 R6|  |B4 B5 B6|
//  |L7 L8 L9|  |F7 F8 F9|  |R7 R8 R9|  |B7 B8 B9|
//              |D1 D2 D3|
//              |D4 D5 D6|
//              |D7 D8 D9|
//
// Repère monde (main droite, identique au rendu three.js) :
// +x = face R, +y = face U, +z = face F (vers le spectateur).

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

export const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

export const MOVES = [
  'U',
  "U'",
  'U2',
  'D',
  "D'",
  'D2',
  'L',
  "L'",
  'L2',
  'R',
  "R'",
  'R2',
  'F',
  "F'",
  'F2',
  'B',
  "B'",
  'B2',
];

// Géométrie de chaque face : normale sortante `n`, position de la facette
// n° 1 (coin haut-gauche vu depuis l'extérieur) `o`, pas « vers la droite »
// `r` et « vers le bas » `d`. pos(k) = o + (k % 3)·r + ⌊k / 3⌋·d.
const FACE_GEOMETRY = {
  U: { n: [0, 1, 0], o: [-1, 1, -1], r: [1, 0, 0], d: [0, 0, 1] },
  R: { n: [1, 0, 0], o: [1, 1, 1], r: [0, 0, -1], d: [0, -1, 0] },
  F: { n: [0, 0, 1], o: [-1, 1, 1], r: [1, 0, 0], d: [0, -1, 0] },
  D: { n: [0, -1, 0], o: [-1, -1, 1], r: [1, 0, 0], d: [0, 0, -1] },
  L: { n: [-1, 0, 0], o: [-1, 1, -1], r: [0, 0, 1], d: [0, -1, 0] },
  B: { n: [0, 0, -1], o: [1, 1, -1], r: [-1, 0, 0], d: [0, -1, 0] },
};

export function faceletPosition(index) {
  const { o, r, d } = FACE_GEOMETRY[FACES[Math.floor(index / 9)]];
  const k = index % 9;
  const col = k % 3;
  const row = Math.floor(k / 3);
  return [
    o[0] + col * r[0] + row * d[0],
    o[1] + col * r[1] + row * d[1],
    o[2] + col * r[2] + row * d[2],
  ];
}

export function faceletNormal(index) {
  return FACE_GEOMETRY[FACES[Math.floor(index / 9)]].n;
}

// Rotation de -90° autour de l'axe unitaire `a` (sens horaire vu depuis
// l'extérieur de la face de normale `a`) : v' = (v × a) + a·(a ⋅ v).
function rotateCW(v, a) {
  const dot = v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
  return [
    v[1] * a[2] - v[2] * a[1] + a[0] * dot,
    v[2] * a[0] - v[0] * a[2] + a[1] * dot,
    v[0] * a[1] - v[1] * a[0] + a[2] * dot,
  ];
}

// perm[move][src] = dst : la facette en `src` part en `dst`.
const PERMUTATIONS = (() => {
  const byKey = new Map();
  for (let i = 0; i < 54; i++) {
    byKey.set(faceletPosition(i).join() + '|' + faceletNormal(i).join(), i);
  }

  const quarter = {};
  for (const face of FACES) {
    const { n } = FACE_GEOMETRY[face];
    const perm = Array.from({ length: 54 }, (_, i) => i);
    for (let i = 0; i < 54; i++) {
      const pos = faceletPosition(i);
      if (pos[0] * n[0] + pos[1] * n[1] + pos[2] * n[2] !== 1) continue;
      const dst = byKey.get(rotateCW(pos, n).join() + '|' + rotateCW(faceletNormal(i), n).join());
      perm[i] = dst;
    }
    quarter[face] = perm;
  }

  const compose = (p, q) => p.map((_, i) => q[p[i]]); // p puis q
  const perms = {};
  for (const face of FACES) {
    const p1 = quarter[face];
    const p2 = compose(p1, p1);
    perms[face] = p1;
    perms[face + '2'] = p2;
    perms[face + "'"] = compose(p2, p1);
  }
  return perms;
})();

export function applyMove(state, move) {
  const perm = PERMUTATIONS[move];
  if (!perm) throw new Error(`Mouvement inconnu : ${move}`);
  const out = new Array(54);
  for (let i = 0; i < 54; i++) out[perm[i]] = state[i];
  return out.join('');
}

export function applyMoves(state, moves) {
  for (const move of moves) state = applyMove(state, move);
  return state;
}

export function invertMove(move) {
  if (move.endsWith('2')) return move;
  if (move.endsWith("'")) return move[0];
  return move + "'";
}

export function invertMoves(moves) {
  return moves.slice().reverse().map(invertMove);
}

export function isSolved(state) {
  return state === SOLVED;
}

// Contrôle structurel (suffisant pour filtrer un localStorage corrompu) :
// 54 caractères, 9 facettes de chaque couleur, centres à leur place.
export function isStructurallyValid(state) {
  if (typeof state !== 'string' || state.length !== 54) return false;
  const counts = {};
  for (const c of state) counts[c] = (counts[c] || 0) + 1;
  return FACES.every((f) => counts[f] === 9) && FACES.every((f, i) => state[9 * i + 4] === f);
}

const AXIS_OF_FACE = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };

// Mélange aléatoire : jamais deux fois la même face de suite, et jamais
// trois coups de suite sur le même axe (évite les séquences type R L R).
export function randomScramble(length = 25, random = Math.random) {
  const moves = [];
  let prevFace = null;
  let prevAxis = null;
  let axisRun = 0;
  while (moves.length < length) {
    const face = FACES[Math.floor(random() * 6)];
    if (face === prevFace) continue;
    const axis = AXIS_OF_FACE[face];
    if (axis === prevAxis && axisRun >= 2) continue;
    axisRun = axis === prevAxis ? axisRun + 1 : 1;
    prevAxis = axis;
    prevFace = face;
    const suffix = ['', "'", '2'][Math.floor(random() * 3)];
    moves.push(face + suffix);
  }
  return moves;
}
