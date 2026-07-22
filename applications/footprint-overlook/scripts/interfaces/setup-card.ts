// 트래커 엔드포인트가 저장소에 없을 때 보여 주는 중앙 정렬 설정 카드입니다.
// 입력 + 저장 버튼으로 URL 을 localStorage['footprint:tracker'] 에 심고 대시보드를 로드합니다.

import { isValidTrackerEndpoint } from '../tools/tracker-endpoint.ts';

// 유효한 엔드포인트가 저장되면 onSave 로 정규화 전 원문을 넘깁니다(저장/정규화는 호출측이 담당).
export function createSetupCard(options: { onSave: (rawUrl: string) => void; initialValue?: string }): HTMLElement {
  const card = document.createElement('section');
  card.className = 'setup-card';
  card.setAttribute('aria-label', '트래커 엔드포인트 설정');

  const title = document.createElement('h2');
  title.className = 'setup-title';
  title.textContent = '트래커 엔드포인트를 설정하세요';
  card.appendChild(title);

  const description = document.createElement('p');
  description.className = 'setup-description';
  description.textContent =
    'footprint 계열은 엔드포인트를 하드코딩하지 않습니다. 데이터를 읽어 올 footprint-tracker 워커의 주소를 입력하면 브라우저 저장소에 저장하고 대시보드를 엽니다.';
  card.appendChild(description);

  const form = document.createElement('form');
  form.className = 'setup-form';

  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'setup-input';
  input.placeholder = 'https://footprint-tracker.example.workers.dev';
  input.setAttribute('aria-label', '트래커 엔드포인트 URL');
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (options.initialValue !== undefined) {
    input.value = options.initialValue;
  }
  form.appendChild(input);

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'setup-save-button';
  saveButton.textContent = '저장하고 열기';
  form.appendChild(saveButton);

  card.appendChild(form);

  // 유효성 안내 문구(잘못된 URL 일 때만 노출).
  const validationMessage = document.createElement('p');
  validationMessage.className = 'setup-validation';
  validationMessage.setAttribute('role', 'alert');
  card.appendChild(validationMessage);

  const hint = document.createElement('p');
  hint.className = 'setup-hint';
  hint.textContent = '예: 로컬 목 서버는 http://127.0.0.1:8788 입니다.';
  card.appendChild(hint);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawUrl = input.value;
    if (!isValidTrackerEndpoint(rawUrl)) {
      validationMessage.textContent = 'http:// 또는 https:// 로 시작하는 올바른 URL 을 입력하세요.';
      card.classList.add('is-invalid');
      input.focus();
      return;
    }
    validationMessage.textContent = '';
    card.classList.remove('is-invalid');
    options.onSave(rawUrl);
  });

  return card;
}
