import type { Scene } from '../../../shared/scenes';
import { answer } from './answer';
import { createChatGPT } from './chatgpt';

const timeline = {
  question: 'AI는 어떻게 여기까지 왔을까?',
  answer,
  sendAt: 2.4,
  streamStart: 3,
  charactersPerSecond: 80,
};

export const createChatGPTScene = (): Scene => ({
  ...createChatGPT(timeline),
  title: 'ChatGPT에 던진 질문',
  start: 0.267,
  end: 7.433,
  chapters: [
    { time: 0.267, title: '질문 입력' },
    { time: timeline.sendAt, title: '질문 전송' },
    { time: timeline.streamStart, title: '대답 스트리밍' },
  ],
});
