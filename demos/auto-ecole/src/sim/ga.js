// Genetic algorithm: elitism + tournament selection + uniform crossover +
// gaussian mutation. Genomes are flat weight arrays (see nn.js).

const ELITE_COUNT = 2;
const TOURNAMENT = 3;
const MUTATION_PROB = 0.12; // per-gene
const WEIGHT_CLAMP = 4;

function tournamentPick(fitnesses, rng) {
  let best = rng.int(fitnesses.length);
  for (let k = 1; k < TOURNAMENT; k++) {
    const c = rng.int(fitnesses.length);
    if (fitnesses[c] > fitnesses[best]) best = c;
  }
  return best;
}

// Returns a brand new population of `popSize` genomes. `sigma` is the
// gaussian mutation strength (the "audace" slider).
export function evolve(genomes, fitnesses, { popSize, sigma, rng }) {
  const order = fitnesses.map((f, i) => i).sort((a, b) => fitnesses[b] - fitnesses[a]);

  const next = [];
  for (let e = 0; e < Math.min(ELITE_COUNT, genomes.length) && next.length < popSize; e++) {
    next.push(genomes[order[e]].slice());
  }

  while (next.length < popSize) {
    const pa = genomes[tournamentPick(fitnesses, rng)];
    const pb = genomes[tournamentPick(fitnesses, rng)];
    const child = new Array(pa.length);
    for (let i = 0; i < pa.length; i++) {
      let g = rng.next() < 0.5 ? pa[i] : pb[i];
      if (rng.next() < MUTATION_PROB) {
        g += rng.gaussian() * sigma;
        if (g > WEIGHT_CLAMP) g = WEIGHT_CLAMP;
        else if (g < -WEIGHT_CLAMP) g = -WEIGHT_CLAMP;
      }
      child[i] = g;
    }
    next.push(child);
  }
  return next;
}
