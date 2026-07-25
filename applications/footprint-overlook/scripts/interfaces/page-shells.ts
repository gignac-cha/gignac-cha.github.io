// Static page furniture: header, endpoint bar and footer. Presentation only — no logic to test,
// which is why this layer is deliberately excluded from the unit tests.

// Page header: a monospace eyebrow, the product name as the title, and a description.
export function createPageHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'page-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'page-eyebrow';
  eyebrow.textContent = 'Footprint Analytics';
  header.appendChild(eyebrow);

  // The product name IS the title. It used to be a Korean themed name with the Latin one as a
  // subtitle, but the themed vocabulary described a metaphor ("footprints", "an overlook") rather
  // than the thing on screen, which is a page-view dashboard. Everything a reader has to match
  // this screen against — the worker names, the storage key, the query names, the repository
  // directory — is spelled 'footprint', so the untranslated product name is also the only title
  // that is greppable against the rest of the system. The Korean copy below states what it does.
  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = 'Footprint Overlook';
  header.appendChild(title);

  const description = document.createElement('p');
  description.className = 'page-description';
  const emphasis = document.createElement('strong');
  emphasis.textContent = 'footprint';
  description.appendChild(emphasis);
  description.appendChild(
    document.createTextNode(' 가 수집한 페이지 접근 데이터를 분석하는 대시보드입니다.'),
  );
  header.appendChild(description);

  return header;
}

// Slim bar showing the tracker address currently in use, with a button back to the setup card.
// Keeping the resolved endpoint visible matters because it lives in browser storage rather than
// in the code: without it there is no way to tell which tracker a given screen is reading.
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

// Footer naming the data source and where the endpoint comes from.
export function createPageFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'page-footer';
  footer.textContent = 'footprint-tracker 워커의 쿼리 결과를 읽어 그립니다 · 엔드포인트는 브라우저 저장소에서 해석됩니다.';
  return footer;
}
