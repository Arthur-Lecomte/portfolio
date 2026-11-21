// Enveloppe Web Worker du solveur : protocole minimal au-dessus du module
// pur twophase.js. Messages :
//   worker -> client : { type: 'ready' } une fois les tables construites ;
//   client -> worker : { id, facelets, opts } ;
//   worker -> client : { id, ok: true, moves } | { id, ok: false, error }.

import { initTables, solve } from './twophase.js';

self.onmessage = (event) => {
  const { id, facelets, opts } = event.data ?? {};
  try {
    const moves = solve(facelets, opts ?? {});
    self.postMessage({ id, ok: true, moves });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// Construction synchrone des tables au démarrage, puis signal de prêt.
initTables();
self.postMessage({ type: 'ready' });
