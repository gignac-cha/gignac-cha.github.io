import { forceSimulation, forceLink, forceX, forceY } from './vendor/d3-force.js';

export const THREAD_COUNT = 264;
export const MAX_POLES = 6;
const POINTS = 41;
const DEFAULT_POLES = [
  [0.32, 0.43, 1],
  [0.66, 0.57, -1],
  [0.59, 0.27, 1],
  [0.43, 0.73, -1],
];

export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

export class Loom {
  constructor(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.tension = 42;
    this.strength = 68;
    this.time = 0;
    this.nextPoleId = 0;
    this.threads = [];
    this.nodes = [];
    this.links = [];
    this.poles = [];
    this.buildThreads();
    this.homeX = forceX((node) => node.homeX).strength(() => this.homeStrength());
    this.homeY = forceY((node) => node.homeY).strength(() => this.homeStrength());
    this.spring = forceLink(this.links)
      .distance((link) => link.rest)
      .strength(0.28);
    this.simulation = forceSimulation(this.nodes)
      .stop()
      .alpha(1)
      .alphaDecay(0)
      .velocityDecay(0.48)
      .force('home-x', this.homeX)
      .force('home-y', this.homeY)
      .force('springs', this.spring)
      .force('poles', (alpha) => this.applyField(alpha));
    this.reset();
  }

  homeStrength() {
    return 0.009 + this.tension * 0.00052;
  }

  buildThreads() {
    for (let row = 0; row < THREAD_COUNT; row++) {
      const warp = row < 180;
      const fraction = warp ? row / 179 : (row - 180) / 83;
      const thread = { nodes: [], family: warp ? 0 : 1, color: row % 17 < 9 ? 0 : row % 17 < 13 ? 1 : 2, row };
      for (let point = 0; point < POINTS; point++) {
        const t = point / (POINTS - 1);
        const u = warp ? -0.055 + t * 1.11 : 0.19 + fraction * 0.62 + 0.11 * Math.sin(t * Math.PI * 2 + fraction * 1.8);
        const v = warp ? 0.14 + fraction * 0.72 + 0.052 * Math.sin(t * Math.PI * 2.2 + fraction * 3.1) : -0.075 + t * 1.15;
        const homeX = u * this.width;
        const homeY = v * this.height;
        const pinned = point === 0 || point === POINTS - 1;
        const node = { u, v, homeX, homeY, x: homeX, y: homeY, vx: 0, vy: 0, pinned, family: thread.family };
        if (pinned) {
          node.fx = homeX;
          node.fy = homeY;
        }
        this.nodes.push(node);
        thread.nodes.push(node);
        if (point) {
          const source = thread.nodes[point - 1];
          this.links.push({ source, target: node, rest: Math.hypot(node.x - source.x, node.y - source.y) });
        }
      }
      this.threads.push(thread);
    }
  }

  // An expressive softened attraction/repulsion and curl, not Maxwell's equations.
  // D3 integrates velocities; fixed poles and pinned ends remain in the same simulation.
  applyField(alpha) {
    const scale = Math.min(this.width, this.height);
    const radius = Math.max(1, scale * 0.37);
    const radiusSquared = radius * radius;
    const amplitude = (this.strength / 100) * scale * 0.0095 * alpha;
    const breath = 1 + Math.sin(this.time * 0.42) * 0.055;
    for (const node of this.nodes) {
      if (node.pinned) continue;
      let ax = 0;
      let ay = 0;
      for (const pole of this.poles) {
        const dx = pole.x - node.x;
        const dy = pole.y - node.y;
        const squared = dx * dx + dy * dy;
        if (squared > radiusSquared * 6) continue;
        const falloff = Math.exp((-squared / radiusSquared) * 1.8);
        const distance = Math.sqrt(squared + scale * scale * 0.0016);
        const radial = pole.sign > 0 ? 0.62 : -0.86;
        const curl = pole.sign * (node.family ? -0.74 : 0.9);
        const force = (amplitude * falloff * breath) / distance;
        ax += (dx * radial - dy * curl) * force;
        ay += (dy * radial + dx * curl) * force;
      }
      node.vx += ax;
      node.vy += ay;
    }
  }

  refresh() {
    this.simulation.nodes([...this.nodes, ...this.poles]);
    this.homeX.x((node) => node.homeX).strength(() => this.homeStrength());
    this.homeY.y((node) => node.homeY).strength(() => this.homeStrength());
    this.spring.distance((link) => link.rest);
  }

  setSettings({ tension = this.tension, strength = this.strength }) {
    if (Number.isFinite(tension)) this.tension = clamp(tension, 0, 100);
    if (Number.isFinite(strength)) this.strength = clamp(strength, 0, 100);
    this.homeX.strength(() => this.homeStrength());
    this.homeY.strength(() => this.homeStrength());
  }

  poleBounds() {
    const marginX = Math.min(36, this.width / 2);
    const marginY = Math.min(54, this.height / 2);
    return { left: marginX, right: this.width - marginX, top: marginY, bottom: this.height - marginY };
  }

  movePole(id, x, y) {
    const pole = this.poles.find((item) => item.id === id);
    if (!pole || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const bounds = this.poleBounds();
    pole.x = pole.fx = pole.homeX = clamp(x, bounds.left, bounds.right);
    pole.y = pole.fy = pole.homeY = clamp(y, bounds.top, bounds.bottom);
    pole.vx = pole.vy = 0;
    return true;
  }

  addPole(sign = 1, u, v) {
    if (this.poles.length >= MAX_POLES) return null;
    // Choose the emptiest of a fixed set of sites, so additions do not hide existing poles.
    if (!Number.isFinite(u) || !Number.isFinite(v)) {
      const sites = [
        [0.22, 0.3],
        [0.78, 0.72],
        [0.74, 0.3],
        [0.25, 0.72],
        [0.5, 0.5],
        [0.5, 0.22],
      ];
      sites.sort((a, b) => this.siteDistance(b) - this.siteDistance(a));
      [u, v] = sites[0];
    }
    const pole = { id: ++this.nextPoleId, sign: sign < 0 ? -1 : 1, pinned: true };
    this.poles.push(pole);
    this.movePole(pole.id, u * this.width, v * this.height);
    this.refresh();
    return pole;
  }

  siteDistance([u, v]) {
    return this.poles.reduce((distance, pole) => Math.min(distance, Math.hypot(u - pole.x / this.width, v - pole.y / this.height)), 2);
  }

  removePole(id) {
    const index = this.poles.findIndex((pole) => pole.id === id);
    if (index < 0) return false;
    this.poles.splice(index, 1);
    this.refresh();
    return true;
  }

  setPolarity(id, sign) {
    const pole = this.poles.find((item) => item.id === id);
    if (!pole) return false;
    pole.sign = sign < 0 ? -1 : 1;
    return true;
  }

  resize(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return false;
    const ratioX = width / this.width;
    const ratioY = height / this.height;
    this.width = width;
    this.height = height;
    for (const node of this.nodes) {
      node.x *= ratioX;
      node.y *= ratioY;
      node.vx *= ratioX;
      node.vy *= ratioY;
      node.homeX = node.u * width;
      node.homeY = node.v * height;
      if (node.pinned) {
        node.fx = node.homeX;
        node.fy = node.homeY;
      }
    }
    for (const pole of this.poles) this.movePole(pole.id, pole.x * ratioX, pole.y * ratioY);
    for (const link of this.links) link.rest = Math.hypot(link.source.homeX - link.target.homeX, link.source.homeY - link.target.homeY);
    this.refresh();
    return true;
  }

  tick(iterations = 1, advance = true) {
    for (let step = 0; step < clamp(Math.floor(iterations), 0, 180); step++) {
      if (advance) this.time += 1 / 30;
      this.simulation.tick();
      for (const node of this.nodes) {
        if (node.pinned) continue;
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
          node.x = node.homeX;
          node.y = node.homeY;
          node.vx = node.vy = 0;
        }
        node.x = clamp(node.x, -this.width * 0.12, this.width * 1.12);
        node.y = clamp(node.y, -this.height * 0.12, this.height * 1.12);
        node.vx = clamp(Number.isFinite(node.vx) ? node.vx : 0, -12, 12);
        node.vy = clamp(Number.isFinite(node.vy) ? node.vy : 0, -12, 12);
      }
    }
  }

  reset() {
    this.time = 0;
    this.nextPoleId = 0;
    this.poles.length = 0;
    this.setSettings({ tension: 42, strength: 68 });
    for (const node of this.nodes) {
      node.x = node.homeX;
      node.y = node.homeY;
      node.vx = node.vy = 0;
    }
    for (const [u, v, sign] of DEFAULT_POLES) this.addPole(sign, u, v);
    this.tick(100, false);
  }

  destroy() {
    this.simulation.stop();
  }
}
