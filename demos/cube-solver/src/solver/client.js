// API côté interface du solveur : createSolver() lance le Web Worker et
// expose { ready, solve }. Les appels solve concurrents sont sérialisés
// (un seul calcul à la fois dans le worker, réponses appariées par id).

export function createSolver() {
  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  });

  const pending = new Map(); // id -> { resolve, reject }
  let nextId = 1;

  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Évite un « unhandled rejection » si personne n'attend ready directement
  // (le rejet reste observable par les appelants de ready/solve).
  ready.catch(() => {});

  worker.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'ready') {
      resolveReady();
      return;
    }
    const entry = pending.get(data && data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.moves);
    else entry.reject(new Error(data.error || 'Erreur inconnue du solveur.'));
  });

  // Erreur fatale du worker : rejette ready et toutes les promesses en attente.
  worker.addEventListener('error', (event) => {
    const err = new Error(`Erreur du worker du solveur : ${event.message || 'erreur inconnue'}.`);
    rejectReady(err);
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  });

  // File de sérialisation : chaque solve attend la fin du précédent.
  let chain = Promise.resolve();

  function solve(facelets, opts = {}) {
    const run = chain.then(async () => {
      await ready;
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, facelets, opts });
      });
    });
    // L'échec d'un appel ne doit pas bloquer les suivants.
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return { ready, solve };
}
