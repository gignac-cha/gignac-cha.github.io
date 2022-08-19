enum BuilderType {
  DOT = 'dot',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  LINE = 'line',
  LINES = 'lines',
  TEXT = 'text',
}
enum DrawMethod {
  STROKE = 'stroke',
  FILL = 'fill',
}

interface Point {
  x: number;
  y: number;
}
interface Line {
  start: Point;
  end: Point;
}
interface TextAlign {
  horizontal: CanvasTextAlign;
  vertical: CanvasTextBaseline;
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
  text: string;
  color: string;
  size: number;
  align: TextAlign;
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
    text = '',
    color = 'rgba(0, 0, 0, 0)',
    size = 0,
    align = { horizontal: 'start', vertical: 'alphabetic' }
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
          context.lineWidth = width;
          context.arc(x, y, r, 0, 2 * Math.PI);
          break;
        case BuilderType.LINE:
          context.lineWidth = width;
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          break;
        case BuilderType.LINES:
          context.lineWidth = width;
          for (const line of lines) {
            context.moveTo(line.start.x, line.start.y);
            context.lineTo(line.end.x, line.end.y);
          }
          break;
        case BuilderType.TEXT:
          context.font = `${size}px 'Consolas'`;
          context.textAlign = align.horizontal;
          context.textBaseline = align.vertical;
          break;
      }
    };
    const draw = (method: DrawMethod) => {
      if (type === BuilderType.TEXT) {
        switch (method) {
          case DrawMethod.STROKE:
            context.strokeText(text, x, y);
            return;
          case DrawMethod.FILL:
            context.fillText(text, x, y);
            return;
        }
      } else {
        switch (method) {
          case DrawMethod.STROKE:
            context.stroke();
            return;
          case DrawMethod.FILL:
            context.fill();
            return;
        }
      }
    }
    const clean = () => context.closePath();
    return {
      stroke() {
        context.strokeStyle = color;
        work();
        draw(DrawMethod.STROKE);
        clean();
      },
      fill() {
        context.fillStyle = color;
        work();
        draw(DrawMethod.FILL);
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
  circle(x: number, y: number, r: number, color: string, width: number = 1): Builder {
    return this.getBuilder(BuilderType.CIRCLE, { x, y, r, color, width });
  }
  line(start: Point, end: Point, color: string, width: number = 1): Builder {
    return this.getBuilder(BuilderType.LINE, { start, end, color, width });
  }
  lines(lines: Line[], color: string, width: number = 1): Builder {
    return this.getBuilder(BuilderType.LINES, { lines, color, width });
  }
  text(text: string, x: number, y: number, color: string, size: number, align: TextAlign): Builder {
    return this.getBuilder(BuilderType.TEXT, { text, x, y, color, size, align });
  }
}
