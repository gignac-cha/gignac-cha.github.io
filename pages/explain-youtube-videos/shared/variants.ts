import './variants.scss';
import type { Scene } from './scenes';
import { load, save } from './storage';

// 같은 장면을 다른 방식으로 그린 판. element 를 장면 영역에 채우고 update(time) 으로 그린다.
export interface Variant {
  element: HTMLElement;
  update?: (time: number) => void;
}

export interface VariantOption {
  id: string;
  label: string;
  // 처음 고를 때만 불러온다(예: Three.js 는 이 장면에서 고를 때만 받아 온다).
  load: () => Promise<Variant>;
}

// 임시 비교용: 장면 오른쪽 위의 탭으로 기본(SVG) 판과 다른 판을 바꿔 보며 비교한다.
// 장면마다 고른 판을 기억하고, 미리보기에서는 ?variant=three 처럼 주소로 고정할 수 있다.
export const withVariants = (scene: Scene, options: VariantOption[]): Scene => {
  const key = `variant:${scene.start}:${scene.title}`;
  const forced = new URLSearchParams(location.search).get('variant');
  const all = [{ id: 'svg', label: 'SVG' }, ...options];
  let selected = forced && all.some(({ id }) => id === forced) ? forced : load(key, { id: 'svg' }).id;
  let lastTime = scene.start;

  const element = document.createElement('div');
  element.className = 'variant-scene';
  scene.element.classList.add('variant-layer');
  element.append(scene.element);
  const layers = new Map<string, Variant>([['svg', { element: scene.element, update: scene.update }]]);

  const tabs = document.createElement('div');
  tabs.className = 'variant-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '그리기 방식 비교');
  const buttons = all.map(({ id, label }) => {
    const button = document.createElement('button');
    button.className = 'variant-tab';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => select(id));
    tabs.append(button);
    return { id, button };
  });
  element.append(tabs);

  // 고른 판을 아직 불러오지 못했으면 그동안은 기본(SVG) 판을 보여 준다.
  const visible = () => (layers.has(selected) ? selected : 'svg');
  const show = () => {
    for (const [id, layer] of layers) {
      layer.element.hidden = id !== visible();
    }
    for (const { id, button } of buttons) {
      button.setAttribute('aria-selected', String(id === selected));
      button.classList.toggle('loading', id === selected && !layers.has(id));
    }
    layers.get(visible())?.update?.(lastTime);
  };

  // 다른 판은 장면이 실제로 재생될 때(또는 탭을 누를 때) 처음 불러온다. 화면에 없는 장면은 받아 오지 않는다.
  const loading = new Set<string>();
  const ensure = async (id: string) => {
    const option = options.find((candidate) => candidate.id === id);
    if (!option || layers.has(id) || loading.has(id)) {
      return;
    }
    loading.add(id);
    const variant = await option.load();
    variant.element.classList.add('variant-layer');
    element.insertBefore(variant.element, tabs);
    layers.set(id, variant);
    loading.delete(id);
    show();
  };

  const select = (id: string) => {
    selected = id;
    save(key, { id });
    show();
    void ensure(id);
  };
  show();

  return {
    ...scene,
    element,
    update: (time: number) => {
      lastTime = time;
      void ensure(selected);
      layers.get(visible())?.update?.(time);
    },
  };
};
