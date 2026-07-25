import { describe, expect, it } from 'vitest';
import { createRequestTokenGuard } from './request-tokens.ts';

describe('createRequestTokenGuard', () => {
  it('treats only the most recently issued token as current', () => {
    const guard = createRequestTokenGuard();
    const first = guard.issue();
    const second = guard.issue();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('drops a late response from an earlier load so it cannot overwrite the screen', async () => {
    // The race the guard exists for, made deterministic: the first load resolves LAST.
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

    const firstLoad = load('7-day', slow);
    const secondLoad = load('30-day', Promise.resolve());
    await secondLoad;
    releaseSlow();
    await firstLoad;

    expect(applied).toEqual(['30-day']);
  });
});
