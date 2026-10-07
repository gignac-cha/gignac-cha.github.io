import { renderPreview } from '../shared/preview';
import type { Scene } from '../shared/scenes';

// scenes/*/scene.ts 의 create*Scene 을 전부 모아, main.ts 에 등록하기 전인 장면도 미리볼 수 있게 한다.
const modules = import.meta.glob<Record<string, unknown>>('./scenes/*/scene.ts', { eager: true });
const factories = Object.values(modules).flatMap((module) =>
  Object.entries(module)
    .filter(([name, value]) => /^create\w+Scene$/.test(name) && typeof value === 'function')
    .map(([, value]) => value as () => Scene),
);

renderPreview(document.getElementById('scenes')!, factories.map((create) => create()));
