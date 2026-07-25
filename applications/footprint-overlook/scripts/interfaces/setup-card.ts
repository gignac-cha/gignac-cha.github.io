// The centred setup card shown when no tracker endpoint is stored: it takes a URL, verifies the
// tracker can actually be reached at it, and hands the raw value back for storing.
//
// Verification is a real request, not just a URL parse, because the two ways this input goes wrong
// are both invisible to a syntax check: a typo in the workers.dev subdomain, and an endpoint that
// exists but does not list THIS origin in the worker's VIEWER_ORIGINS allowlist. Saving either one
// produces a dashboard where all six sections fail at once with an opaque network error, which
// reads as "the dashboard is broken" rather than "the address is wrong". Probing here turns that
// into one sentence at the moment the address is entered.
//
// The probe is GET {base}/queries, and it has to be: /health and /help are cheaper but carry no
// CORS headers at all (see the CORS block in footprint-tracker-worker/worker.ts), so a browser
// could never read them cross-origin and the probe would fail even against a healthy tracker.
// A successful /queries call proves all three things at once — the URL resolves, the worker is
// up, and this origin is allowlisted.
//
// A failed probe is a WARNING, not a wall: the tracker may simply be down for a moment, and
// refusing to store a correct address would be worse than a dashboard that starts empty. The
// second submit therefore saves anyway.

import { fetchQueries } from '../tools/tracker-client.ts';
import { isValidTrackerEndpoint } from '../tools/tracker-endpoint.ts';

export interface SetupCardOptions {
  // Receives the raw (un-normalized) URL; storing and normalizing are the caller's job.
  onSave: (rawUrl: string) => void;
  initialValue?: string;
  // Overridable for tests; defaults to the catalog request described above.
  probeEndpoint?: (baseUrl: string) => Promise<unknown>;
}

// Loopback hosts, for which "the tracker is probably on this machine too" holds.
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// The example address, derived from where the page itself was served.
//
// A hardcoded 127.0.0.1 example is actively wrong whenever the dashboard is opened from ANOTHER
// device — a phone, a second machine on the LAN, a tunnelled host. There, 127.0.0.1 names the
// viewer's own machine, so the tracker request goes nowhere and surfaces as a bare "Failed to
// fetch" that looks like the tracker is down rather than like a wrong address. Suggesting the
// host the page came from is right in exactly the cases where the mistake is easy to make, and
// unchanged for plain local development.
function buildHintText(): string {
  try {
    const { hostname, protocol } = window.location;
    if (!LOOPBACK_HOSTNAMES.has(hostname)) {
      return `예: 이 페이지와 같은 호스트라면 ${protocol}//${hostname}:8788 입니다. (localhost·127.0.0.1 은 접속한 기기 자신을 가리키므로 다른 기기에서는 동작하지 않습니다.)`;
    }
  } catch {
    // Fall through to the local example.
  }
  return '예: 로컬 목 서버는 http://127.0.0.1:8788 입니다.';
}

export function createSetupCard(options: SetupCardOptions): HTMLElement {
  const probeEndpoint = options.probeEndpoint ?? ((baseUrl: string) => fetchQueries(baseUrl));

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
    'footprint 계열은 엔드포인트를 하드코딩하지 않습니다. 데이터를 읽어 올 footprint-tracker 워커의 주소를 입력하면 연결을 확인한 뒤 브라우저 저장소에 저장하고 대시보드를 엽니다.';
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

  // Validation and probe feedback. role="alert" so a screen reader announces the outcome of a
  // submit that otherwise changes nothing visible.
  const validationMessage = document.createElement('p');
  validationMessage.className = 'setup-validation';
  validationMessage.setAttribute('role', 'alert');
  card.appendChild(validationMessage);

  const hint = document.createElement('p');
  hint.className = 'setup-hint';
  hint.textContent = buildHintText();
  card.appendChild(hint);

  // Set once a probe has failed for the current URL, which turns the next submit into "save
  // anyway". Reset whenever the URL changes, so the warning always belongs to the value on screen.
  let hasFailedProbe = false;
  let isProbing = false;

  const setState = (state: 'idle' | 'probing' | 'invalid' | 'failed'): void => {
    card.classList.toggle('is-invalid', state === 'invalid' || state === 'failed');
    card.classList.toggle('is-probing', state === 'probing');
    saveButton.disabled = state === 'probing';
    saveButton.textContent = state === 'failed' ? '무시하고 저장' : '저장하고 열기';
  };

  input.addEventListener('input', () => {
    if (hasFailedProbe) {
      hasFailedProbe = false;
      validationMessage.textContent = '';
      setState('idle');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isProbing) {
      return;
    }

    const rawUrl = input.value;
    if (!isValidTrackerEndpoint(rawUrl)) {
      validationMessage.textContent = 'http:// 또는 https:// 로 시작하는 올바른 URL 을 입력하세요.';
      setState('invalid');
      input.focus();
      return;
    }

    // Second submit after a failed probe: the user has seen the warning and chose to proceed.
    if (hasFailedProbe) {
      options.onSave(rawUrl);
      return;
    }

    isProbing = true;
    validationMessage.textContent = '트래커에 연결을 확인하는 중…';
    setState('probing');

    void probeEndpoint(rawUrl)
      .then(() => {
        isProbing = false;
        validationMessage.textContent = '';
        setState('idle');
        options.onSave(rawUrl);
      })
      .catch((error: unknown) => {
        isProbing = false;
        hasFailedProbe = true;
        const reason = error instanceof Error ? error.message : String(error);
        // The allowlist is named explicitly because a browser reports a CORS rejection as a bare
        // network error: without this sentence the most likely cause is also the least guessable.
        validationMessage.textContent =
          `${reason} — 주소가 맞는지, 그리고 이 오리진이 트래커의 VIEWER_ORIGINS 허용 목록에 있는지 확인하세요. 그래도 저장하려면 한 번 더 누르세요.`;
        setState('failed');
        input.focus();
      });
  });

  return card;
}
