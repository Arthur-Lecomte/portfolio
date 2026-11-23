// Double pendulum physics — fixed parameters chosen for strongly chaotic
// motion, integrated with classic RK4 at a fixed timestep.

export const G = 9.81; // m/s²
export const M1 = 1; // kg
export const M2 = 1; // kg
export const L1 = 1; // m
export const L2 = 1; // m
export const DT = 1 / 240; // integration step (s)

// State vector layout: [th1, w1, th2, w2]. Angles are measured from the
// downward vertical; the y axis points down so th = 0 means hanging.
function derivatives(s, out) {
  const th1 = s[0];
  const w1 = s[1];
  const th2 = s[2];
  const w2 = s[3];
  const d = th1 - th2;
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);
  const denom = 2 * M1 + M2 - M2 * Math.cos(2 * d);
  out[0] = w1;
  out[1] =
    (-G * (2 * M1 + M2) * Math.sin(th1) -
      M2 * G * Math.sin(th1 - 2 * th2) -
      2 * sinD * M2 * (w2 * w2 * L2 + w1 * w1 * L1 * cosD)) /
    (L1 * denom);
  out[2] = w2;
  out[3] =
    (2 *
      sinD *
      (w1 * w1 * L1 * (M1 + M2) + G * (M1 + M2) * Math.cos(th1) + w2 * w2 * L2 * M2 * cosD)) /
    (L2 * denom);
}

// Scratch buffers shared across calls (single-threaded, no reentrancy).
const k1 = new Float64Array(4);
const k2 = new Float64Array(4);
const k3 = new Float64Array(4);
const k4 = new Float64Array(4);
const tmp = new Float64Array(4);

export function rk4Step(s, dt) {
  derivatives(s, k1);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + (k1[i] * dt) / 2;
  derivatives(tmp, k2);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + (k2[i] * dt) / 2;
  derivatives(tmp, k3);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + k3[i] * dt;
  derivatives(tmp, k4);
  for (let i = 0; i < 4; i++) {
    s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
}

// World positions (meters, y down, origin at the pivot) of both joints.
export function jointPositions(s) {
  const x1 = L1 * Math.sin(s[0]);
  const y1 = L1 * Math.cos(s[0]);
  return [x1, y1, x1 + L2 * Math.sin(s[2]), y1 + L2 * Math.cos(s[2])];
}
