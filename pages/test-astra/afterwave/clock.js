export class FixedClock {
  constructor() {
    this.pending = 0;
  }
  reset() {
    this.pending = 0;
  }
  advance(seconds, step) {
    const interval = 1 / 120;
    this.pending += Math.min(0.1, Math.max(0, seconds));
    let count = 0;
    while (this.pending + 1e-10 >= interval && count < 12) {
      this.pending -= interval;
      step(interval);
      count++;
    }
    this.pending = Math.max(0, this.pending);
    return count;
  }
}
