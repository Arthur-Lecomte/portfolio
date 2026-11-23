// Preset scenes. World is 1600 x 900, y down, angles in radians.

import { createObject } from './objects.js';

export const WORLD = { w: 1600, h: 900 };

function arcEnCiel() {
  // Laser aimed upward at ~18 degrees so it meets the prism's left face
  // near minimum deviation (~48 degrees of incidence): the beam crosses
  // the glass parallel to the base and exits as a wide rainbow fan.
  return [
    createObject('laser', 300, 560, { angle: -0.314 }),
    createObject('prism', 800, 460, { size: 120 }),
    createObject('wall', 1290, 580, { angle: 1.9, w: 430 }),
  ];
}

function miroirs() {
  const q = Math.PI / 4;
  return [
    createObject('laser', 240, 200, { angle: 0, lambda: 650 }),
    createObject('mirror', 1180, 200, { angle: q }),
    createObject('mirror', 1180, 620, { angle: -q }),
    createObject('mirror', 420, 620, { angle: q }),
    createObject('mirror', 420, 330, { angle: -q }),
    createObject('wall', 880, 330, { angle: Math.PI / 2, w: 200 }),
  ];
}

function focale() {
  const out = [];
  for (let i = 0; i < 5; i++) {
    // Stay well inside the lens aperture so spherical aberration stays mild.
    out.push(createObject('laser', 260, 450 + (i - 2) * 25, { angle: 0, lambda: 520 }));
  }
  out.push(createObject('lens', 820, 450, { kind: 'convex' }));
  out.push(createObject('wall', 1340, 450, { angle: Math.PI / 2, w: 340 }));
  return out;
}

function melange() {
  const aim = (x, y, tx, ty) => Math.atan2(ty - y, tx - x);
  return [
    createObject('laser', 280, 280, { angle: aim(280, 280, 1290, 455), lambda: 650 }),
    createObject('laser', 280, 450, { angle: aim(280, 450, 1290, 455), lambda: 532 }),
    createObject('laser', 280, 620, { angle: aim(280, 620, 1290, 455), lambda: 460 }),
    createObject('laser', 280, 790, { angle: 0 }),
    createObject('filter', 760, 790, { lambda: 500 }),
    createObject('wall', 1300, 520, { angle: Math.PI / 2, w: 560 }),
  ];
}

export const SCENES = [
  { id: 'arc', name: 'Arc-en-ciel', build: arcEnCiel },
  { id: 'miroirs', name: 'Miroirs', build: miroirs },
  { id: 'focale', name: 'Focale', build: focale },
  { id: 'melange', name: 'Mélange', build: melange },
];

export const DEFAULT_SCENE = 'arc';
