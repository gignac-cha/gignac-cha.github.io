var BuilderType = /* @__PURE__ */ ((BuilderType2) => {
  BuilderType2["DOT"] = "dot";
  BuilderType2["RECTANGLE"] = "rectangle";
  BuilderType2["CIRCLE"] = "circle";
  BuilderType2["LINE"] = "line";
  BuilderType2["LINES"] = "lines";
  BuilderType2["TEXT"] = "text";
  return BuilderType2;
})(BuilderType || {});
var DrawMethod = /* @__PURE__ */ ((DrawMethod2) => {
  DrawMethod2["STROKE"] = "stroke";
  DrawMethod2["FILL"] = "fill";
  return DrawMethod2;
})(DrawMethod || {});
export default class Canvas {
  constructor(element) {
    this.element = element;
  }
  addEventListener(...args) {
    this.element.addEventListener(...args);
  }
  createLinearGradient(...args) {
    return this._context.createLinearGradient(...args);
  }
  createRadialGradient(...args) {
    return this._context.createRadialGradient(...args);
  }
  get context() {
    return this._context ?? (this._context = this.element.getContext("2d"));
  }
  get width() {
    return this.element.width;
  }
  set width(value) {
    this.element.setAttribute("width", `${value}`);
  }
  get height() {
    return this.element.height;
  }
  set height(value) {
    this.element.setAttribute("height", `${value}`);
  }
  getBuilder(type, {
    x = 0,
    y = 0,
    r = 0,
    width = 0,
    height = 0,
    start = { x: 0, y: 0 },
    end = { x: 0, y: 0 },
    lines = [],
    text = "",
    color = "rgba(0, 0, 0, 0)",
    size = 0,
    align = { horizontal: "start", vertical: "alphabetic" }
  }) {
    const { context } = this;
    context.beginPath();
    const work = () => {
      switch (type) {
        case "dot" /* DOT */:
          context.rect(x, y, 1, 1);
          break;
        case "rectangle" /* RECTANGLE */:
          context.rect(x, y, width, height);
          break;
        case "circle" /* CIRCLE */:
          context.lineWidth = width;
          context.arc(x, y, r, 0, 2 * Math.PI);
          break;
        case "line" /* LINE */:
          context.lineWidth = width;
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          break;
        case "lines" /* LINES */:
          context.lineWidth = width;
          for (const line of lines) {
            context.moveTo(line.start.x, line.start.y);
            context.lineTo(line.end.x, line.end.y);
          }
          break;
        case "text" /* TEXT */:
          context.font = `${size}px 'Consolas'`;
          context.textAlign = align.horizontal;
          context.textBaseline = align.vertical;
          break;
      }
    };
    const draw = (method) => {
      if (type === "text" /* TEXT */) {
        switch (method) {
          case "stroke" /* STROKE */:
            context.strokeText(text, x, y);
            return;
          case "fill" /* FILL */:
            context.fillText(text, x, y);
            return;
        }
      } else {
        switch (method) {
          case "stroke" /* STROKE */:
            context.stroke();
            return;
          case "fill" /* FILL */:
            context.fill();
            return;
        }
      }
    };
    const clean = () => context.closePath();
    return {
      stroke() {
        context.strokeStyle = color;
        work();
        draw("stroke" /* STROKE */);
        clean();
      },
      fill() {
        context.fillStyle = color;
        work();
        draw("fill" /* FILL */);
        clean();
      }
    };
  }
  clear(x = 0, y = 0, width = this.width, height = this.height) {
    this.context.clearRect(x, y, width, height);
  }
  dot(x, y, color) {
    return this.getBuilder("dot" /* DOT */, { x, y, color });
  }
  rectangle(x, y, width, height, color) {
    return this.getBuilder("rectangle" /* RECTANGLE */, { x, y, width, height, color });
  }
  circle(x, y, r, color, width = 1) {
    return this.getBuilder("circle" /* CIRCLE */, { x, y, r, color, width });
  }
  line(start, end, color, width = 1) {
    return this.getBuilder("line" /* LINE */, { start, end, color, width });
  }
  lines(lines, color, width = 1) {
    return this.getBuilder("lines" /* LINES */, { lines, color, width });
  }
  text(text, x, y, color, size, align) {
    return this.getBuilder("text" /* TEXT */, { text, x, y, color, size, align });
  }
}
