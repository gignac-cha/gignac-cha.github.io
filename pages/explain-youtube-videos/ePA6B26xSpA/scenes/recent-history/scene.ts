import './recent-history.scss';
import { appear, createDiagram, lerp, setAttributes, svg } from '../../../shared/diagram.ts';
import type { Scene } from '../../../shared/scenes.ts';
import { fullView, zoomView } from './events.ts';
import { createTimeline } from './timeline.ts';

// 57:44 "이때 ChatGPT를 매주 쓰는 사람이 7억 명" ~ 59:41.6 "GPT-6 아스트라를 공개했어요" (그다음은 100만 토큰 장면).
const first = { start: 3464.4, end: 3581.6 };
// 59:52.6 "다만 사이버 보안과 관련된 요청은" ~ 1:00:46.6 "오늘의 풍경입니다" (그다음은 세 바퀴 돌아보기).
const second = { start: 3592.6, end: 3646.6 };
// 둘째 장면은 2026년 7~9월로 확대했다가, 마지막 "오늘의 풍경"에서 다시 전체를 본다.
const zoomIn = { at: second.start, duration: 1.2 };
const zoomOut = { at: 3639.6, duration: 1.4 };

export const createRecentHistoryScene = (): Scene => {
  const { element, root } = createDiagram('recent-history', '최근의 흐름(2025–2026)');
  const group = svg('g', {}, root);
  const timeline = createTimeline(group, () => fullView, () => 0);

  const update = (time: number) => {
    setAttributes(group, { opacity: appear(time, first.start, .5).toFixed(3) });
    timeline(time);
  };

  return {
    element,
    update,
    title: '최근의 흐름(2025–2026)',
    start: first.start,
    end: first.end,
    chapters: [
      { time: first.start, title: 'GPT-5 · 주간 사용자 7억 명' },
      { time: 3471.5, title: '가만있지 않은 경쟁자들' },
      { time: 3479.5, title: '오픈AI의 코드 레드' },
      { time: 3487.9, title: '2026년, 바로 지금' },
      { time: 3499.3, title: '거의 매달 새 모델' },
      { time: 3517.4, title: '접은 것: Sora 앱' },
      { time: 3529.6, title: '여름의 에이전트 탈출 사건' },
      { time: 3553.0, title: 'GPT-5.6과 등급' },
      { time: 3578.3, title: 'GPT-6 아스트라' },
    ],
  };
};

export const createRecentHistoryTodayScene = (): Scene => {
  const { element, root } = createDiagram('recent-history', '2026년 9월, 오늘의 풍경');
  const group = svg('g', {}, root);
  const zoom = (time: number) => appear(time, zoomIn.at, zoomIn.duration) * (1 - appear(time, zoomOut.at, zoomOut.duration));
  const view = (time: number) => {
    const z = zoom(time);
    return { from: lerp(fullView.from, zoomView.from, z), to: lerp(fullView.to, zoomView.to, z) };
  };
  const timeline = createTimeline(group, view, zoom);

  const update = (time: number) => {
    setAttributes(group, { opacity: appear(time, second.start, .4).toFixed(3) });
    timeline(time);
  };

  return {
    element,
    update,
    title: '2026년 9월, 오늘의 풍경',
    start: second.start,
    end: second.end,
    chapters: [
      { time: second.start, title: '아스트라에 드리운 여름의 그림자' },
      { time: 3598.2, title: 'GPT-6 솔 · 루나' },
      { time: 3602.9, title: '어제의 개발자 행사' },
      { time: 3613.6, title: '나오지 못한 6.1 아스트라' },
      { time: 3627.8, title: '주간 사용자 12억 명' },
      { time: 3632.2, title: '바짝 붙은 경쟁자들' },
      { time: 3642.8, title: '오늘의 풍경' },
    ],
  };
};
