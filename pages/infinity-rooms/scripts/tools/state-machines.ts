// 제네릭 상태 머신 스토어입니다. DOM/Three.js 의존이 없는 순수 로직 계층입니다.

export interface StateMachineStore<State, MachineEvent> {
  getState(): State;
  dispatch(event: MachineEvent): void;
  subscribe(listener: (previousState: State, nextState: State) => void): void;
}

// 초기 상태와 전이 함수로 상태 머신 스토어를 만듭니다.
// 전이 결과가 이전 상태와 동일(참조 동등)하면 구독자에게 알리지 않습니다.
export function createStateMachineStore<State, MachineEvent>(
  initialState: State,
  transition: (state: State, event: MachineEvent) => State,
): StateMachineStore<State, MachineEvent> {
  let currentState = initialState;
  const listeners: ((previousState: State, nextState: State) => void)[] = [];

  return {
    getState: () => currentState,
    dispatch: (event: MachineEvent) => {
      const previousState = currentState;
      const nextState = transition(previousState, event);
      if (nextState === previousState) {
        return;
      }
      currentState = nextState;
      for (const listener of listeners) {
        listener(previousState, nextState);
      }
    },
    subscribe: (listener: (previousState: State, nextState: State) => void) => {
      listeners.push(listener);
    },
  };
}
