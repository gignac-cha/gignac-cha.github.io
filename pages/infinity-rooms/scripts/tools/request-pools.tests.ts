import { describe, expect, it } from 'vitest';

import { createRequestPool } from './request-pools.ts';

// 수동으로 resolve/reject 할 수 있는 지연 Promise 를 만듭니다. 결정론적 테스트에 사용합니다.
interface Deferred<Result> {
  promise: Promise<Result>;
  resolve: (result: Result) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<Result>(): Deferred<Result> {
  let resolve!: (result: Result) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Result>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// 마이크로태스크 큐를 비워 풀의 then 콜백이 모두 처리되도록 합니다.
function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

describe('createRequestPool', () => {
  it('동시성 한도를 넘는 작업은 큐에서 대기한다', async () => {
    const pool = createRequestPool(2);
    const firstDeferred = createDeferred<string>();
    const secondDeferred = createDeferred<string>();
    const thirdDeferred = createDeferred<string>();

    pool.run(() => firstDeferred.promise);
    pool.run(() => secondDeferred.promise);
    pool.run(() => thirdDeferred.promise);

    await flushMicrotasks();

    // 한도가 2 이므로 두 개만 활성이고 세 번째는 대기한다.
    expect(pool.getActiveCount()).toBe(2);
    expect(pool.getQueuedCount()).toBe(1);
  });

  it('활성 작업이 끝나면 대기 작업을 이어서 실행한다', async () => {
    const pool = createRequestPool(1);
    const firstDeferred = createDeferred<string>();
    const secondDeferred = createDeferred<string>();

    pool.run(() => firstDeferred.promise);
    pool.run(() => secondDeferred.promise);

    await flushMicrotasks();
    expect(pool.getActiveCount()).toBe(1);
    expect(pool.getQueuedCount()).toBe(1);

    firstDeferred.resolve('첫 번째');
    await flushMicrotasks();

    // 첫 작업이 끝나면 두 번째가 활성으로 올라온다.
    expect(pool.getActiveCount()).toBe(1);
    expect(pool.getQueuedCount()).toBe(0);
  });

  it('작업의 성공 결과를 호출자 Promise 로 전달한다', async () => {
    const pool = createRequestPool(1);
    const result = await pool.run(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('작업의 실패를 호출자 Promise 로 전파한다', async () => {
    const pool = createRequestPool(1);
    const failure = new Error('실패함');
    await expect(pool.run(() => Promise.reject(failure))).rejects.toBe(failure);
  });

  it('실패한 작업 이후에도 다음 큐 작업을 실행한다', async () => {
    const pool = createRequestPool(1);
    const firstDeferred = createDeferred<string>();
    const secondDeferred = createDeferred<string>();

    const firstPromise = pool.run(() => firstDeferred.promise);
    pool.run(() => secondDeferred.promise);

    await flushMicrotasks();
    expect(pool.getActiveCount()).toBe(1);
    expect(pool.getQueuedCount()).toBe(1);

    firstDeferred.reject(new Error('첫 작업 실패'));
    await expect(firstPromise).rejects.toThrow('첫 작업 실패');
    await flushMicrotasks();

    expect(pool.getActiveCount()).toBe(1);
    expect(pool.getQueuedCount()).toBe(0);
  });

  it('runPriority 는 큐를 우회해 즉시 실행한다', async () => {
    const pool = createRequestPool(1);
    const blockingDeferred = createDeferred<string>();
    const priorityDeferred = createDeferred<string>();

    // 한도 1 을 채운 상태에서도 우선 작업은 즉시 활성이 된다.
    pool.run(() => blockingDeferred.promise);
    await flushMicrotasks();
    expect(pool.getActiveCount()).toBe(1);

    pool.runPriority(() => priorityDeferred.promise);
    await flushMicrotasks();

    // 한도를 무시하고 즉시 실행되어 활성 수가 2 가 된다.
    expect(pool.getActiveCount()).toBe(2);
    expect(pool.getQueuedCount()).toBe(0);
  });

  it('runPriority 의 결과도 호출자 Promise 로 전달한다', async () => {
    const pool = createRequestPool(0);
    const result = await pool.runPriority(() => Promise.resolve('우선'));
    expect(result).toBe('우선');
  });

  it('subscribe 는 등록 즉시 현재 상태를 1회 통지한다', () => {
    const pool = createRequestPool(2);
    const notifications: { activeCount: number; queuedCount: number }[] = [];
    pool.subscribe((activeCount, queuedCount) => {
      notifications.push({ activeCount, queuedCount });
    });
    expect(notifications).toEqual([{ activeCount: 0, queuedCount: 0 }]);
  });

  it('subscribe 는 상태가 변할 때마다 통지하고 해제 함수가 통지를 멈춘다', async () => {
    const pool = createRequestPool(1);
    const firstDeferred = createDeferred<string>();
    const secondDeferred = createDeferred<string>();
    const notifications: { activeCount: number; queuedCount: number }[] = [];
    const unsubscribe = pool.subscribe((activeCount, queuedCount) => {
      notifications.push({ activeCount, queuedCount });
    });

    // 등록 즉시 1회 통지된 상태로 시작한다.
    expect(notifications).toEqual([{ activeCount: 0, queuedCount: 0 }]);

    pool.run(() => firstDeferred.promise);
    pool.run(() => secondDeferred.promise);
    await flushMicrotasks();

    // 큐 적재/활성 전환 과정의 변화가 통지되어 최종 상태(활성 1, 대기 1)에 도달한다.
    expect(notifications.at(-1)).toEqual({ activeCount: 1, queuedCount: 1 });
    expect(notifications.length).toBeGreaterThan(1);

    const countBeforeUnsubscribe = notifications.length;
    unsubscribe();
    firstDeferred.resolve('첫 번째');
    await flushMicrotasks();

    // 해제 이후에는 통지가 추가되지 않는다.
    expect(notifications.length).toBe(countBeforeUnsubscribe);
  });
});
