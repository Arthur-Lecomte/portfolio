// localStorage persistence. RÈGLE PORTFOLIO — all keys are prefixed with
// the project slug because every demo shares the same origin.

const PREFIX = 'prisma:';
const SCENE_KEY = `${PREFIX}scene`;
const HELP_KEY = `${PREFIX}help-seen`;

const num = Number.isFinite;

// Per-type sanity checks: corrupted or hand-edited storage must not be
// able to poison the tracer with NaN (e.g. lens aperture >= R).
const VALID = {
  laser: (o) => o.lambda == null || num(o.lambda),
  mirror: (o) => num(o.length) && o.length > 0,
  filter: (o) => num(o.length) && o.length > 0 && num(o.lambda),
  prism: (o) => num(o.size) && o.size > 0,
  lens: (o) =>
    (o.kind === 'convex' || o.kind === 'concave') &&
    num(o.aperture) &&
    num(o.R) &&
    o.aperture > 0 &&
    o.aperture < o.R,
  wall: (o) => num(o.w) && num(o.h) && o.w > 0 && o.h > 0,
};

export function saveScene(objects) {
  try {
    localStorage.setItem(SCENE_KEY, JSON.stringify({ version: 1, objects }));
  } catch {
    // Storage unavailable (private mode, quota): the demo still works.
  }
}

export function loadScene() {
  try {
    const raw = localStorage.getItem(SCENE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.objects)) return null;
    const ok = data.objects.every(
      (o) =>
        o && VALID[o.type] && num(o.x) && num(o.y) && num(o.angle) && num(o.id) && VALID[o.type](o),
    );
    return ok ? data.objects : null;
  } catch {
    return null;
  }
}

export function helpSeen() {
  try {
    return localStorage.getItem(HELP_KEY) === '1';
  } catch {
    return true; // no storage: do not force the dialog on every load
  }
}

export function markHelpSeen() {
  try {
    localStorage.setItem(HELP_KEY, '1');
  } catch {
    // ignore
  }
}
