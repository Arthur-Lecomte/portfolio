// Generation runner: a population of cars, each driven by its genome,
// stepped with a fixed timestep. DOM-free so tools/train.js can run it
// headless in Node.

import { CAR, createCar, driveCar } from './car.js';
import { forward, outputBiasIndex, randomGenome } from './nn.js';
import { evolve } from './ga.js';

export const SIM = {
  dt: 1 / 60,
  genTime: 20, // s, hard cap per generation
  stallWindow: 3, // s
  stallMinProgress: 18, // px of forward progress required per window
  rayAngles: [-1.2, -0.6, 0, 0.6, 1.2],
  rayLen: 170,
  layers: [6, 8, 2], // 5 rays + speed -> hidden -> [steer, throttle]
};

export const DEFAULTS = { popSize: 60, sigma: 0.18 };

// What the car perceives: normalized sensor distances + normalized speed.
// Also used by the UI to feed the live network visualization.
export function senseInputs(track, car, out = new Array(SIM.layers[0])) {
  for (let r = 0; r < SIM.rayAngles.length; r++) {
    const d = track.raycast(car.x, car.y, car.heading + SIM.rayAngles[r], SIM.rayLen);
    out[r] = d / SIM.rayLen;
  }
  out[SIM.rayAngles.length] = car.speed / CAR.maxSpeed;
  return out;
}

const scratchInputs = new Array(SIM.layers[0]);

// Shared per-car step: sense -> think -> drive -> collide -> progress.
// Used by both the training population and the champion replay.
export function stepCarWithBrain(track, car, genome, dt) {
  const inputs = senseInputs(track, car, scratchInputs);
  const out = forward(SIM.layers, genome, inputs);
  driveCar(car, out[0], out[1], dt);

  if (track.circleHit(car.x, car.y, CAR.bodyRadius)) {
    car.alive = false;
    return;
  }
  track.updateProgress(car);

  car.stallTimer += dt;
  if (car.stallTimer >= SIM.stallWindow) {
    if (car.progressDist - car.stallRefDist < SIM.stallMinProgress) {
      car.alive = false; // parked or driving in circles: fail the exam
      return;
    }
    car.stallTimer = 0;
    car.stallRefDist = car.progressDist;
  }
}

export function freshGenome(rng) {
  const g = randomGenome(SIM.layers, rng);
  // Mild prior: new students tend to press the throttle, so generation 1
  // visibly moves instead of idling.
  g[outputBiasIndex(SIM.layers, 1)] += 0.6;
  return g;
}

export class Simulation {
  constructor({ track, popSize = DEFAULTS.popSize, sigma = DEFAULTS.sigma, rng }) {
    this.track = track;
    this.popSize = popSize;
    this.sigma = sigma;
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.generation = 1;
    this.genTime = 0;
    this.history = []; // {gen, best, mean} in px of progress
    this.recordDist = 0;
    this.genomes = [];
    for (let i = 0; i < this.popSize; i++) this.genomes.push(freshGenome(this.rng));
    this.spawn();
  }

  setTrack(track) {
    this.track = track;
    this.reset();
  }

  spawn() {
    this.cars = this.genomes.map(() => createCar(this.track.startPose));
    this.genTime = 0;
  }

  aliveCount() {
    let a = 0;
    for (const c of this.cars) if (c.alive) a++;
    return a;
  }

  // Best car of the current generation: leader among the living, or the
  // overall leader if everyone crashed.
  bestCar() {
    let best = null;
    for (const c of this.cars) {
      if (!c.alive) continue;
      if (!best || c.progressDist > best.progressDist) best = c;
    }
    if (!best) {
      for (const c of this.cars) {
        if (!best || c.progressDist > best.progressDist) best = c;
      }
    }
    return best;
  }

  bestGenome() {
    const i = this.cars.indexOf(this.bestCar());
    return i >= 0 ? this.genomes[i] : this.genomes[0];
  }

  // One fixed timestep for the whole population. Returns true when a
  // generation just ended (and the next one is already spawned).
  step() {
    const dt = SIM.dt;
    let anyAlive = false;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car.alive) continue;
      stepCarWithBrain(this.track, car, this.genomes[i], dt);
      if (car.alive) anyAlive = true;
    }
    this.genTime += dt;
    if (!anyAlive || this.genTime >= SIM.genTime) {
      this.endGeneration();
      return true;
    }
    return false;
  }

  endGeneration() {
    const fitnesses = this.cars.map((c) => c.progressDist);
    const best = Math.max(...fitnesses);
    const mean = fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length;
    this.history.push({ gen: this.generation, best, mean });
    if (best > this.recordDist) this.recordDist = best;

    this.genomes = evolve(this.genomes, fitnesses, {
      popSize: this.popSize,
      sigma: this.sigma,
      rng: this.rng,
    });
    this.generation++;
    this.spawn();
  }
}
