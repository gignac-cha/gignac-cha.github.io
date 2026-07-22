import { describe, expect, it } from 'vitest';
import { createRequestTokenGuard } from './request-tokens.ts';

describe('createRequestTokenGuard', () => {
  it('마지막으로 발급된 토큰만 최신이다', () => {
    const guard = createRequestTokenGuard();
    const first = guard.issue();
    const second = guard.issue();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('늦게 도착한 이전 요청은 최신 판정에서 탈락해 화면을 덮어쓰지 못한다', async () => {
    const guard = createRequestTokenGuard();
    const applied: string[] = [];

    async function load(label: string, wait: Promise<void>): Promise<void> {
      const token = guard.issue();
      await wait;
      if (!guard.isCurrent(token)) {
        return;
      }
      applied.push(label);
    }

    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    const firstLoad = load('7일', slow);
    const secondLoad = load('30일', Promise.resolve());
    await secondLoad;
    releaseSlow();
    await firstLoad;

    expect(applied).toEqual(['30일']);
  });
});
