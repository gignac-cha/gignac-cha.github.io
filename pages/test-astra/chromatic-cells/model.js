import WFCModel from './wfc.js';

export const COLORS = [
  { name: 'Ivory', hex: '#f0eee3' },
  { name: 'Coral', hex: '#ed806f' },
  { name: 'Mint', hex: '#a8d9bb' },
  { name: 'Jade', hex: '#318c79' },
  { name: 'Iris', hex: '#a59bcf' },
  { name: 'Saffron', hex: '#dcb963' },
];

// Ivory bridges every color. The other colors form a symmetric adjacency cycle.
export const ALLOWED = [
  [0, 1, 2, 3, 4, 5],
  [0, 1, 4, 5],
  [0, 2, 3, 4],
  [0, 2, 3, 5],
  [0, 1, 2, 4],
  [0, 1, 3, 5],
];

export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

class CellSolver extends WFCModel {
  constructor(width, height) {
    super();
    this.FMX = width;
    this.FMY = height;
    this.FMXxFMY = width * height;
    this.T = COLORS.length;
    this.weights = [0.65, 1.3, 1.1, 1.05, 0.8, 0.45];
    this.propagator = Array.from({ length: 4 }, () => ALLOWED);
    this.initialize();
    this.clear();
  }

  onBoundary(x, y) {
    return x < 0 || y < 0 || x >= this.FMX || y >= this.FMY;
  }

  pin(index, color) {
    if (!this.wave[index][color]) return false;
    for (let t = 0; t < this.T; t++) {
      if (t !== color && this.wave[index][t]) this.ban(index, t);
    }
    this.propagate();
    return this.sumsOfOnes.every((count) => count > 0);
  }
}

export class ChromaticModel {
  constructor(width, height, seed = 8) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > 4096) {
      throw new RangeError('Grid must contain 2 to 4096 cells with at least two rows and columns.');
    }
    this.width = width;
    this.height = height;
    this.seed = seed >>> 0;
    this.rng = makeRandom(this.seed);
    this.pins = new Map();
    this.solver = new CellSolver(width, height);
    this.cells = new Int8Array(width * height).fill(-1);
    this.revision = 0;
    this.filled = 0;
    this.recovered = false;
  }

  neighbors(index) {
    const x = index % this.width;
    const y = Math.floor(index / this.width);
    const result = [];
    if (x > 0) result.push(index - 1);
    if (x + 1 < this.width) result.push(index + 1);
    if (y > 0) result.push(index - this.width);
    if (y + 1 < this.height) result.push(index + this.width);
    return result;
  }

  sync() {
    this.filled = 0;
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = this.solver.sumsOfOnes[i] === 1 ? this.solver.wave[i].indexOf(true) : -1;
      if (this.cells[i] >= 0) this.filled++;
    }
    this.revision++;
  }

  rebuild(pins) {
    const candidate = new CellSolver(this.width, this.height);
    for (const [index, color] of pins) {
      if (!candidate.pin(index, color)) return false;
    }
    this.solver = candidate;
    this.pins = new Map(pins);
    this.sync();
    return true;
  }

  setSeed(x, y, color) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(color) || x < 0 || y < 0 || x >= this.width || y >= this.height || color < 0 || color >= COLORS.length) return false;
    const index = x + y * this.width;
    const pins = new Map(this.pins);
    pins.set(index, color);
    // A seed edit is transactional: an impossible proposal leaves the artwork intact.
    if (!this.rebuild(pins)) return false;
    this.rng = makeRandom(this.seed + index * 31 + color * 127 + pins.size);
    return true;
  }

  clear() {
    this.rebuild(new Map());
    this.recovered = false;
  }

  compose() {
    this.clear();
    this.rng = makeRandom(this.seed);
    const mirror = this.seed % 2 ? -1 : 1;
    const anchors = [
      [0.29, 0.34, 1], [0.35, 0.42, 1], [0.4, 0.51, 5],
      [0.49, 0.53, 3], [0.57, 0.57, 3], [0.65, 0.65, 2],
      [0.7, 0.54, 2], [0.59, 0.3, 4], [0.64, 0.23, 4],
      [0.25, 0.69, 0], [0.77, 0.34, 0],
    ];
    for (const [u, v, color] of anchors) {
      const x = Math.min(this.width - 1, Math.max(0, Math.floor((0.5 + (u - 0.5) * mirror) * this.width)));
      const y = Math.min(this.height - 1, Math.floor(v * this.height));
      this.setSeed(x, y, color);
    }
    this.step(Math.floor(this.cells.length * 0.36));
  }

  step(count = 1) {
    const limit = Math.max(0, Math.min(512, Math.floor(Number(count) || 0)));
    this.recovered = false;
    if (!this.pins.size) return 0;
    let changed = 0;
    for (let n = 0; n < limit && this.filled < this.cells.length; n++) {
      let selected = -1;
      let best = Infinity;
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i] >= 0) continue;
        const neighbors = this.neighbors(i);
        const touching = neighbors.filter((j) => this.cells[j] >= 0).length;
        if (!touching) continue;
        const score = this.solver.entropies[i] - touching * 0.24 + this.rng() * 0.7;
        if (score < best) { best = score; selected = i; }
      }
      if (selected < 0) break;
      const neighbors = this.neighbors(selected);
      const weights = this.solver.wave[selected].map((possible, color) => possible
        ? this.solver.weights[color] * (1 + neighbors.filter((i) => this.cells[i] === color).length * 4)
        : 0);
      let choice = this.rng() * weights.reduce((sum, weight) => sum + weight, 0);
      let color = weights.findIndex((weight) => weight > 0 && (choice -= weight) < 0);
      if (color < 0) color = this.solver.wave[selected].indexOf(true);
      if (color < 0 || !this.solver.pin(selected, color)) {
        // Bounded recovery, never an unbounded solve/retry loop.
        this.rebuild(this.pins);
        this.recovered = true;
        break;
      }
      this.sync();
      changed++;
    }
    return changed;
  }
}
