// Tiny fixed-topology MLP. A genome is a flat array of weights laid out
// layer by layer: for each layer, the (nIn x nOut) weight matrix
// (input-major) followed by the nOut biases. tanh everywhere.

export function weightCount(layers) {
  let n = 0;
  for (let l = 0; l < layers.length - 1; l++) {
    n += layers[l] * layers[l + 1] + layers[l + 1];
  }
  return n;
}

export function randomGenome(layers, rng) {
  const n = weightCount(layers);
  const w = new Array(n);
  for (let i = 0; i < n; i++) w[i] = rng.gaussian() * 0.8;
  return w;
}

// Flat index of the bias of output neuron k in the last layer, so callers
// can nudge a prior (e.g. "press the throttle by default") without knowing
// the full layout.
export function outputBiasIndex(layers, k) {
  const last = layers.length - 2;
  let off = 0;
  for (let l = 0; l < last; l++) off += layers[l] * layers[l + 1] + layers[l + 1];
  return off + layers[last] * layers[last + 1] + k;
}

export function forward(layers, w, inputs) {
  let acts = inputs;
  let off = 0;
  for (let l = 0; l < layers.length - 1; l++) {
    const nIn = layers[l];
    const nOut = layers[l + 1];
    const next = new Array(nOut);
    for (let j = 0; j < nOut; j++) {
      let sum = w[off + nIn * nOut + j]; // bias
      for (let i = 0; i < nIn; i++) sum += acts[i] * w[off + i * nOut + j];
      next[j] = Math.tanh(sum);
    }
    acts = next;
    off += nIn * nOut + nOut;
  }
  return acts;
}

// Same pass but keeps every layer's activations, for the live network
// visualization (only called for the single highlighted car).
export function forwardTrace(layers, w, inputs) {
  const trace = [inputs.slice()];
  let acts = inputs;
  let off = 0;
  for (let l = 0; l < layers.length - 1; l++) {
    const nIn = layers[l];
    const nOut = layers[l + 1];
    const next = new Array(nOut);
    for (let j = 0; j < nOut; j++) {
      let sum = w[off + nIn * nOut + j];
      for (let i = 0; i < nIn; i++) sum += acts[i] * w[off + i * nOut + j];
      next[j] = Math.tanh(sum);
    }
    trace.push(next);
    acts = next;
    off += nIn * nOut + nOut;
  }
  return trace;
}

// Weight between neuron i of layer l and neuron j of layer l+1, for
// drawing connection strengths.
export function weightAt(layers, w, l, i, j) {
  let off = 0;
  for (let k = 0; k < l; k++) off += layers[k] * layers[k + 1] + layers[k + 1];
  return w[off + i * layers[l + 1] + j];
}
