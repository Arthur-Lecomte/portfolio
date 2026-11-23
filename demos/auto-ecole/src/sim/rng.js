// Seeded RNG (mulberry32) so headless training in tools/train.js is
// reproducible and champions can be re-generated identically.

export function makeRng(seed) {
  let s = seed >>> 0;
  let spare = null; // cached second value of the Box-Muller pair

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(maxExclusive) {
    return Math.floor(next() * maxExclusive);
  }

  function gaussian() {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    v = next();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  }

  return { next, int, gaussian };
}
