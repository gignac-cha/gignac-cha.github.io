const BACKGROUND = '#121415';
const PALETTE = ['#c7ceca', '#df927f', '#7db8af'];

export class LoomRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    if (!this.context) throw new Error('Canvas 2D is unavailable');
  }

  resize(width, height, pixelRatio = 1) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.max(1, Math.min(2, pixelRatio || 1));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  trace(nodes, start = 0, end = nodes.length - 1) {
    const context = this.context;
    context.beginPath();
    context.moveTo(nodes[start].x, nodes[start].y);
    for (let i = start + 1; i < end; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    context.lineTo(nodes[end].x, nodes[end].y);
  }

  draw(model) {
    const context = this.context;
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, this.width, this.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Continuous base strands, followed by alternating short overpasses.
    // Tiny opaque under-strokes create a textile crossing instead of additive glow.
    for (const thread of model.threads) {
      this.trace(thread.nodes);
      context.strokeStyle = PALETTE[thread.color];
      context.globalAlpha = thread.family ? 0.27 : 0.39 + (thread.row % 5) * 0.045;
      context.lineWidth = thread.row % 13 === 0 ? 1 : 0.62;
      context.stroke();
    }
    for (const thread of model.threads) {
      if (thread.row % 3 !== 0) continue;
      for (let start = 3 + (thread.row % 7); start < thread.nodes.length - 5; start += 12) {
        this.trace(thread.nodes, start, start + 4);
        context.globalAlpha = 0.8;
        context.strokeStyle = BACKGROUND;
        context.lineWidth = 2.1;
        context.stroke();
        context.globalAlpha = thread.family ? 0.48 : 0.7;
        context.strokeStyle = PALETTE[thread.color];
        context.lineWidth = 0.7;
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  drawPoleMarks(model) {
    const context = this.context;
    for (const pole of model.poles) {
      context.beginPath();
      context.arc(pole.x, pole.y, 11, 0, Math.PI * 2);
      context.fillStyle = BACKGROUND;
      context.fill();
      context.strokeStyle = PALETTE[pole.sign > 0 ? 1 : 2];
      context.lineWidth = 1;
      context.stroke();
      context.beginPath();
      context.moveTo(pole.x - 4, pole.y);
      context.lineTo(pole.x + 4, pole.y);
      if (pole.sign > 0) {
        context.moveTo(pole.x, pole.y - 4);
        context.lineTo(pole.x, pole.y + 4);
      }
      context.stroke();
    }
  }
}
