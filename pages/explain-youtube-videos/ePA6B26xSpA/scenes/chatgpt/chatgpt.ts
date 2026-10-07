import './chatgpt.scss';

const icon = (paths: string, strokeWidth = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const icons = {
  chevron: icon('<path d="M6 9l6 6 6-6" />'),
  plus: icon('<path d="M12 5v14M5 12h14" />'),
  microphone: icon('<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />'),
  send: icon('<path d="M12 19V5M5 12l7-7 7 7" />', 2.5),
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /></svg>',
};

const fadeLength = 40;

export interface ChatGPTTimeline {
  question: string;
  answer: string[];
  sendAt: number;
  streamStart: number;
  charactersPerSecond: number;
}

export const createChatGPT = ({ question, answer, sendAt, streamStart, charactersPerSecond }: ChatGPTTimeline) => {
  const element = document.createElement('div');
  element.className = 'chatgpt';
  element.innerHTML = `
    <div class="chatgpt-header">
      <span class="chatgpt-model">ChatGPT ${icons.chevron}</span>
    </div>
    <div class="chatgpt-main">
      <h1 class="chatgpt-greeting">무엇을 도와드릴까요?</h1>
      <div class="chatgpt-thread">
        <div class="chatgpt-question"></div>
        <div class="chatgpt-answer">
          <span class="chatgpt-thinking"></span>
          ${answer.map(() => '<p></p>').join('')}
        </div>
      </div>
      <div class="chatgpt-composer">
        <span class="chatgpt-button">${icons.plus}</span>
        <span class="chatgpt-input"><span class="chatgpt-text"></span><span class="chatgpt-caret"></span><span class="chatgpt-placeholder">무엇이든 물어보세요</span></span>
        <span class="chatgpt-button">${icons.microphone}</span>
        <span class="chatgpt-button chatgpt-send">${icons.send}${icons.stop}</span>
      </div>
    </div>
    <div class="chatgpt-footer">ChatGPT는 실수를 할 수 있습니다. 중요한 정보는 재차 확인하세요.</div>
  `;
  const text = element.querySelector('.chatgpt-text')!;
  const thread = element.querySelector('.chatgpt-thread')!;
  const paragraphs = [...element.querySelectorAll('.chatgpt-answer p')];
  element.querySelector('.chatgpt-question')!.textContent = question;

  const total = answer.reduce((sum, paragraph) => sum + paragraph.length, 0);
  let rendered = -1;

  const render = (streamed: number) => {
    let offset = 0;
    answer.forEach((paragraph, index) => {
      const visible = Math.min(Math.max(streamed - offset, 0), paragraph.length);
      const solid = Math.min(Math.max(streamed - fadeLength - offset, 0), paragraph.length);
      const nodes: Node[] = solid > 0 ? [document.createTextNode(paragraph.slice(0, solid))] : [];
      for (let i = solid; i < visible; i++) {
        const span = document.createElement('span');
        span.textContent = paragraph[i];
        span.style.opacity = String((streamed - offset - i) / fadeLength);
        nodes.push(span);
      }
      paragraphs[index].replaceChildren(...nodes);
      offset += paragraph.length;
    });
  };

  const update = (time: number) => {
    const sent = time >= sendAt;
    const streamed = Math.min(Math.max(Math.round((time - streamStart) * charactersPerSecond), 0), total);
    element.classList.toggle('sent', sent);
    element.classList.toggle('thinking', sent && time < streamStart);
    element.classList.toggle('generating', sent && streamed < total);
    const input = sent ? '' : question;
    if (text.textContent !== input) {
      text.textContent = input;
    }

    if (streamed !== rendered) {
      render(streamed);
      rendered = streamed;
    }
    thread.scrollTop = thread.scrollHeight;
  };

  return { element, update };
};
