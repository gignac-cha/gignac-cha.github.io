enum BuilderType {
  DOT = 'dot',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  LINE = 'line',
  LINES = 'lines',
  TEXT = 'text',
}

interface Point {
  x: number;
  y: number;
}
interface Line {
  start: Point;
  end: Point;
}
interface BuilderProperties {
  x: number;
  y: number;
  r: number;
  width: number;
  height: number;
  start: Point;
  end: Point;
  lines: Line[];
  color: string;
}
interface Builder {
  stroke(): void;
  fill(): void;
}

export default class Canvas {
  private _context: CanvasRenderingContext2D;

  constructor(private element: HTMLCanvasElement) {

  }

  addEventListener(...args: Parameters<typeof this.element.addEventListener>) {
    this.element.addEventListener(...args);
  }
  createLinearGradient(...args: Parameters<typeof this._context.createLinearGradient>) {
    return this._context.createLinearGradient(...args);
  }
  createRadialGradient(...args: Parameters<typeof this._context.createRadialGradient>) {
    return this._context.createRadialGradient(...args);
  }

  private get context(): CanvasRenderingContext2D {
    return this._context ?? (this._context = this.element.getContext('2d')!);
  }

  get width(): number {
    return this.element.width;
  }
  set width(value: number) {
    this.element.setAttribute('width', `${value}`);
  }
  get height(): number {
    return this.element.height;
  }
  set height(value: number) {
    this.element.setAttribute('height', `${value}`);
  }

  private getBuilder(type: BuilderType, {
    x = 0, y = 0, r = 0, width = 0, height = 0,
    start = { x: 0, y: 0 }, end = { x: 0, y: 0},
    lines = [],
    color = 'rgba(0, 0, 0, 0)',
  }: Partial<BuilderProperties>): Builder {
    const { context }: Canvas = this;
    context.beginPath();
    const work = () => {
      switch (type) {
        case BuilderType.DOT:
          context.rect(x, y, 1, 1);
          break;
        case BuilderType.RECTANGLE:
          context.rect(x, y, width, height);
          break;
        case BuilderType.CIRCLE:
          context.arc(x, y, r, 0, 2 * Math.PI);
          break;
        case BuilderType.LINE:
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          break;
        case BuilderType.LINES:
          for (const line of lines) {
            context.moveTo(line.start.x, line.start.y);
            context.lineTo(line.end.x, line.end.y);
          }
          break;
      }
    };
    const clean = () => context.closePath();
    return {
      stroke() {
        context.strokeStyle = color;
        work();
        context.stroke();
        clean();
      },
      fill() {
        context.fillStyle = color;
        work();
        context.fill();
        clean();
      },
    };
  }

  clear(x: number = 0, y: number = 0, width: number = this.width, height: number = this.height): void {
    this.context.clearRect(x, y, width, height);
  }
  dot(x: number, y: number, color: string): Builder {
    return this.getBuilder(BuilderType.DOT, { x, y, color });
  }
  rectangle(x: number, y: number, width: number, height: number, color: string): Builder {
    return this.getBuilder(BuilderType.RECTANGLE, { x, y, width, height, color });
  }
  circle(x: number, y: number, r: number, color: string): Builder {
    return this.getBuilder(BuilderType.CIRCLE, { x, y, r, color });
  }
}
