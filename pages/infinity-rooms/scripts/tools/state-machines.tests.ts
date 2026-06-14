import { describe, expect, it } from 'vitest';

import { createStateMachineStore } from './state-machines.ts';

type CounterState = { count: number };
type CounterEvent = { type: 'increase' } | { type: 'reset' } | { type: 'ignored' };

const transition = (state: CounterState, event: CounterEvent): CounterState => {
  switch (event.type) {
    case 'increase':
      return { count: state.count + 1 };
    case 'reset':
      return { count: 0 };
    case 'ignored':
      return state;
  }
};

describe('createStateMachineStore', () => {
  it('초기 상태를 돌려준다', () => {
    const store = createStateMachineStore<CounterState, CounterEvent>({ count: 0 }, transition);
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('dispatch 하면 전이 함수 결과로 상태가 바뀐다', () => {
    const store = createStateMachineStore<CounterState, CounterEvent>({ count: 0 }, transition);
    store.dispatch({ type: 'increase' });
    store.dispatch({ type: 'increase' });
    expect(store.getState()).toEqual({ count: 2 });
  });

  it('구독자는 이전 상태와 다음 상태를 함께 받는다', () => {
    const store = createStateMachineStore<CounterState, CounterEvent>({ count: 0 }, transition);
    const receivedTransitions: { previousState: CounterState; nextState: CounterState }[] = [];
    store.subscribe((previousState, nextState) => {
      receivedTransitions.push({ previousState, nextState });
    });
    store.dispatch({ type: 'increase' });
    store.dispatch({ type: 'reset' });
    expect(receivedTransitions).toEqual([
      { previousState: { count: 0 }, nextState: { count: 1 } },
      { previousState: { count: 1 }, nextState: { count: 0 } },
    ]);
  });

  it('전이 결과가 이전 상태와 동일(참조 동등)하면 구독자를 호출하지 않는다', () => {
    const store = createStateMachineStore<CounterState, CounterEvent>({ count: 0 }, transition);
    const receivedTransitions: { previousState: CounterState; nextState: CounterState }[] = [];
    store.subscribe((previousState, nextState) => {
      receivedTransitions.push({ previousState, nextState });
    });
    store.dispatch({ type: 'ignored' });
    expect(receivedTransitions).toHaveLength(0);
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('구독자가 여러 명이면 모두에게 알린다', () => {
    const store = createStateMachineStore<CounterState, CounterEvent>({ count: 0 }, transition);
    const notifiedCounts: number[] = [];
    store.subscribe((_previousState, nextState) => notifiedCounts.push(nextState.count));
    store.subscribe((_previousState, nextState) => notifiedCounts.push(nextState.count * 10));
    store.dispatch({ type: 'increase' });
    expect(notifiedCounts).toEqual([1, 10]);
  });
});
