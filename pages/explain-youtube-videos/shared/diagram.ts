import './diagram.scss';

// 모든 다이어그램 장면은 1600×900 좌표계의 SVG 위에 그린다. 장면 영역 크기에 맞춰 그대로 확대·축소된다.
export const WIDTH = 1600;
export const HEIGHT = 900;

type Attributes = Record<string, string | number>;

export const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Attributes = {}, parent?: Element) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  setAttributes(element, attributes);
  parent?.append(element);
  return element;
};

export const text = (parent: Element, x: number, y: number, content: string, attributes: Attributes = {}) => {
  const element = svg('text', { x, y, ...attributes }, parent);
  element.textContent = content;
  return element;
};

// 매 프레임 호출되므로 값이 바뀔 때만 DOM을 건드린다.
export const setAttributes = (element: Element, attributes: Attributes) => {
  for (const [key, value] of Object.entries(attributes)) {
    const next = String(value);
    if (element.getAttribute(key) !== next) {
      element.setAttribute(key, next);
    }
  }
};

export const createDiagram = (className: string, title: string) => {
  const element = document.createElement('div');
  element.className = `diagram ${className}`;
  const root = svg('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}` }, element);
  text(root, 56, 76, title, { class: 'diagram-title' });
  return { element, root };
};

export const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

// time이 start부터 duration 동안 0에서 1로 변하는 값.
export const progress = (time: number, start: number, duration: number) => clamp((time - start) / duration);

export const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

// at 시점부터 duration 동안 부드럽게 0에서 1로. 등장 연출에 쓴다.
export const appear = (time: number, at: number, duration = .5) => ease(progress(time, at, duration));

export const between = (time: number, start: number, end: number) => start <= time && time < end;
