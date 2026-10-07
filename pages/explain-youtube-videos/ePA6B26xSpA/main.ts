import { renderSceneIndex } from '../shared/scene-index';
import { syncScenes, type Scene } from '../shared/scenes';
import { loadPlayer } from '../shared/youtube';
import { answer } from './scenes/chatgpt/answer';
import { createChatGPT } from './scenes/chatgpt/chatgpt';

const chatgpt = {
  question: 'AI는 어떻게 여기까지 왔을까?',
  answer,
  sendAt: 2.4,
  streamStart: 3,
  charactersPerSecond: 80,
};

const scenes: Scene[] = [
  {
    ...createChatGPT(chatgpt),
    title: 'ChatGPT',
    start: 0.267,
    end: 7.433,
    chapters: [
      { time: 0.267, title: '질문 입력' },
      { time: chatgpt.sendAt, title: '질문 전송' },
      { time: chatgpt.streamStart, title: '대답 스트리밍' },
    ],
  },
];

const player = await loadPlayer('video');
syncScenes(player, document.getElementById('scenes')!, scenes);
renderSceneIndex(player, document.getElementById('scene-index')!, scenes);
