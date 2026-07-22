// 페이지 골격(헤더·엔드포인트 바·푸터) 정적 요소 팩토리 계층입니다. 표시 전용이라 단위 테스트 대상에서 제외합니다.

// 모노 eyebrow + 한국어 주도 타이틀 + 설명문을 가진 페이지 헤더입니다.
export function createPageHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'page-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'page-eyebrow';
  eyebrow.textContent = 'Footprint Analytics';
  header.appendChild(eyebrow);

  // 한국어 UI 이므로 '발자국 조망대'가 주 타이틀이고 라틴 표기는 보조입니다.
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.appendChild(document.createTextNode('발자국 조망대'));

  const latinTitle = document.createElement('span');
  latinTitle.className = 'title-latin';
  latinTitle.textContent = 'Footprint Overlook';
  title.appendChild(latinTitle);
  header.appendChild(title);

  const description = document.createElement('p');
  description.className = 'page-description';
  description.appendChild(document.createTextNode('개인 페이지 추적 시스템 '));
  const emphasis = document.createElement('strong');
  emphasis.textContent = 'footprint';
  description.appendChild(emphasis);
  description.appendChild(
    document.createTextNode(' 가 남긴 발자국 흔적을 한눈에 내려다봅니다. 트래커 워커가 제공하는 데이터를 읽어 시각화합니다.'),
  );
  header.appendChild(description);

  return header;
}

// 현재 트래커 엔드포인트를 눈에 거슬리지 않게 보여 주고 변경 버튼을 제공하는 슬림 바입니다.
export interface EndpointBarHandle {
  element: HTMLElement;
  setEndpoint(endpoint: string): void;
}

export function createEndpointBar(options: { onChange: () => void }): EndpointBarHandle {
  const bar = document.createElement('section');
  bar.className = 'endpoint-bar';
  bar.setAttribute('aria-label', '트래커 엔드포인트');

  const label = document.createElement('span');
  label.className = 'endpoint-label';
  label.textContent = '트래커';
  bar.appendChild(label);

  const value = document.createElement('span');
  value.className = 'endpoint-value';
  value.textContent = '—';
  bar.appendChild(value);

  const changeButton = document.createElement('button');
  changeButton.type = 'button';
  changeButton.className = 'endpoint-change-button';
  changeButton.textContent = '변경';
  changeButton.addEventListener('click', () => options.onChange());
  bar.appendChild(changeButton);

  return {
    element: bar,
    setEndpoint: (endpoint) => {
      value.textContent = endpoint;
      value.title = endpoint;
    },
  };
}

// 데이터 출처와 온디바이스 특성을 알리는 페이지 푸터입니다.
export function createPageFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'page-footer';
  footer.textContent = 'footprint-tracker 워커의 쿼리 결과를 읽어 그립니다 · 엔드포인트는 브라우저 저장소에서 해석됩니다.';
  return footer;
}
