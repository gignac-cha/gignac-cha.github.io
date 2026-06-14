// 페이지 골격(헤더·조작법 안내·푸터) 정적 요소를 만드는 팩토리 계층입니다.
// 모두 상태가 없는 표시 전용 요소이며, 스타일 계약은 styles/_global.scss 가 담당합니다.

// 모노 eyebrow + 한국어 주도 타이틀 + 단색 액센트로 강조한 설명문을 가진 페이지 헤더입니다.
export function createPageHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'page-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'page-eyebrow';
  eyebrow.textContent = 'Chrome Built-in AI × WebGPU';
  header.appendChild(eyebrow);

  // 한국어 UI 이므로 '무한의 방'이 주 타이틀이고 라틴 표기는 보조입니다.
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.appendChild(document.createTextNode('무한의 방'));

  const latinTitle = document.createElement('span');
  latinTitle.className = 'title-latin';
  latinTitle.textContent = 'Infinity Rooms';
  title.appendChild(latinTitle);
  header.appendChild(title);

  const description = document.createElement('p');
  description.className = 'page-description';

  const aiEmphasis = document.createElement('strong');
  aiEmphasis.textContent = 'Gemini Nano';
  description.appendChild(aiEmphasis);
  description.appendChild(
    document.createTextNode('가 즉석에서 방 테마를 만들고, Three.js WebGPU가 끝없이 이어지는 3D 공간을 그립니다. 문을 통과할 때마다 새로운 방이 생성됩니다.'),
  );
  header.appendChild(description);

  return header;
}

// 키캡 한 개를 만듭니다.
function createKeycap(labelText: string): HTMLSpanElement {
  const keycap = document.createElement('span');
  keycap.className = 'keycap';
  keycap.textContent = labelText;
  return keycap;
}

// 조작법 그룹 한 개(키캡들 + 설명 텍스트)를 만듭니다.
function createControlsGroup(keycapLabels: string[], descriptionText: string, isPointerDevice: boolean): HTMLSpanElement {
  const group = document.createElement('span');
  group.className = isPointerDevice ? 'controls-group is-pointer-device' : 'controls-group';

  for (const keycapLabel of keycapLabels) {
    group.appendChild(createKeycap(keycapLabel));
  }
  group.appendChild(document.createTextNode(descriptionText));

  return group;
}

// 키캡 조작법 + 핵심 가치 한 줄을 보여주는 안내 행입니다.
// 키보드/마우스 그룹은 터치 전용 기기에서 CSS 로 숨겨집니다.
export function createControlsHintRow(): HTMLElement {
  const controlsHint = document.createElement('section');
  controlsHint.className = 'controls-hint';
  controlsHint.setAttribute('aria-label', '조작법');

  controlsHint.appendChild(createControlsGroup(['W', 'A', 'S', 'D'], ' 이동', true));
  controlsHint.appendChild(createControlsGroup(['마우스 드래그'], ' 시점 회전', true));
  controlsHint.appendChild(createControlsGroup([], '문을 통과하면 AI가 새 방을 생성합니다', false));

  return controlsHint;
}

// 기술 스택과 온디바이스 특성을 알리는 페이지 푸터입니다.
export function createPageFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'page-footer';
  footer.textContent = 'Chrome Built-in AI (Gemini Nano) · Three.js WebGPU · D3 — 온디바이스에서만 동작하는 데모입니다.';
  return footer;
}
