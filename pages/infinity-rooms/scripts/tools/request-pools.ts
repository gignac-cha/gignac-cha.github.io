// 생성 요청을 동시성 제한 큐로 직렬화하는 요청 풀입니다.
// DOM/Three.js 의존이 없는 순수 로직 계층이라 vitest 로 단독 검증할 수 있습니다.

export interface RequestPool {
  // 작업을 큐에 넣고 동시성 한도 안에서 실행합니다. 성공/실패를 호출자 Promise 로 그대로 전달합니다.
  run<Result>(task: () => Promise<Result>): Promise<Result>;
  // 큐를 우회해 즉시 실행합니다. 동시성 한도를 무시합니다.
  runPriority<Result>(task: () => Promise<Result>): Promise<Result>;
  // 등록 즉시 현재 상태를 1회 통지하고, 이후 상태가 변할 때마다 통지합니다. 해제 함수를 돌려줍니다.
  subscribe(listener: (activeCount: number, queuedCount: number) => void): () => void;
  getActiveCount(): number;
  getQueuedCount(): number;
}

// 동시성 한도를 받아 요청 풀을 만듭니다.
export function createRequestPool(maxConcurrency: number): RequestPool {
  const queue: (() => void)[] = [];
  let listeners: ((activeCount: number, queuedCount: number) => void)[] = [];
  let activeCount = 0;

  const notify = (): void => {
    for (const listener of listeners) {
      listener(activeCount, queue.length);
    }
  };

  // 동시성 여유가 있고 대기 작업이 있으면 다음 작업을 꺼내 실행합니다.
  const processNext = (): void => {
    if (activeCount >= maxConcurrency || queue.length === 0) {
      return;
    }
    const nextTask = queue.shift();
    if (nextTask === undefined) {
      return;
    }
    notify();
    nextTask();
  };

  // 작업 실행을 활성 수 증감 및 후속 큐 처리로 감싼 함수를 만듭니다.
  const wrapTask = <Result>(
    task: () => Promise<Result>,
    resolve: (result: Result) => void,
    reject: (reason: unknown) => void,
  ): (() => void) => {
    return () => {
      activeCount += 1;
      notify();
      task().then(
        (result) => {
          activeCount -= 1;
          notify();
          processNext();
          resolve(result);
        },
        (reason: unknown) => {
          activeCount -= 1;
          notify();
          processNext();
          reject(reason);
        },
      );
    };
  };

  return {
    run: <Result>(task: () => Promise<Result>): Promise<Result> => {
      return new Promise<Result>((resolve, reject) => {
        queue.push(wrapTask(task, resolve, reject));
        notify();
        processNext();
      });
    },
    runPriority: <Result>(task: () => Promise<Result>): Promise<Result> => {
      return new Promise<Result>((resolve, reject) => {
        wrapTask(task, resolve, reject)();
      });
    },
    subscribe: (listener: (activeCount: number, queuedCount: number) => void): (() => void) => {
      listeners.push(listener);
      listener(activeCount, queue.length);
      return () => {
        listeners = listeners.filter((registeredListener) => registeredListener !== listener);
      };
    },
    getActiveCount: (): number => activeCount,
    getQueuedCount: (): number => queue.length,
  };
}
