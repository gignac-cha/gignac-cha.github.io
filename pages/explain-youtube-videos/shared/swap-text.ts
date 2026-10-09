import { clamp, ease, setAttributes, svg, text } from './diagram.ts';

type Attributes = Record<string, string | number>;

// 이름표가 바뀌는 순간: 이전 글자가 먼저 위로 빠지며 사라지고, 이어서 새 글자가 아래에서 올라온 뒤 노란 빛이 한 번 번진다.
// 두 글자가 겹치지 않도록 나가는 것과 들어오는 것을 나눈다.
const leave = .22;
const enter = { from: .18, duration: .32 };
const glow = { from: .3, duration: .8 };
const shift = 14;
const step = 1 / 30;

const update = (element: Element, content: string, attributes: Attributes) => {
  if (element.textContent !== content) {
    element.textContent = content;
  }
  setAttributes(element, attributes);
};

// 같은 그림 위에서 글자만 바뀌는 이름표. textAt(time) 이 그 시점의 글자를 돌려주면,
// 직전에 바뀐 시점을 거꾸로 찾아 전환을 그린다. 재생 위치만으로 정해지므로 탐색해도 어긋나지 않는다.
export const createSwapText = (parent: Element, x: number, y: number, attributes: Attributes = {}) => {
  const group = svg('g', {}, parent);
  const halo = text(group, x, y, '', { ...attributes, class: `${attributes.class ?? ''} swap-glow`, opacity: 0 });
  const outgoing = text(group, x, y, '', { ...attributes, opacity: 0 });
  const incoming = text(group, x, y, '', attributes);
  const texts = [halo, outgoing, incoming];

  return {
    group,
    toggleClass: (name: string, on: boolean) => {
      for (const element of texts) {
        element.classList.toggle(name, on);
      }
    },
    update: (time: number, textAt: (time: number) => string) => {
      const current = textAt(time);
      let ago = Infinity;
      let previous = current;
      for (let back = step; back <= glow.from + glow.duration; back += step) {
        const before = textAt(time - back);
        if (before !== current) {
          ago = back;
          previous = before;
          break;
        }
      }
      const out = ease(clamp(ago / leave));
      const into = ease(clamp((ago - enter.from) / enter.duration));
      const flashing = clamp((ago - glow.from) / glow.duration);
      const flash = current && flashing > 0 && flashing < 1 ? Math.sin(Math.PI * flashing) * .8 : 0;
      update(outgoing, out < 1 ? previous : '', { y: (y - out * shift).toFixed(1), opacity: (1 - out).toFixed(3) });
      update(incoming, current, { y: (y + (1 - into) * shift).toFixed(1), opacity: into.toFixed(3) });
      update(halo, current, { y: (y + (1 - into) * shift).toFixed(1), opacity: flash.toFixed(3) });
    },
  };
};
