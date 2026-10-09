export interface DragHandlers {
  // false 를 돌려주면 이번 끌기를 시작하지 않는다.
  start?: (event: PointerEvent) => boolean | void;
  move: (event: PointerEvent, dx: number, dy: number) => void;
  end?: () => void;
}

// handle 을 눌러 끄는 동안 move 를 부른다. 끄는 동안 body.dragging 을 붙여 iframe 이 포인터를 가로채지 않게 한다.
export const onDrag = (handle: HTMLElement, { start, move, end }: DragHandlers) => {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || (event.target as Element).closest('button')) {
      return;
    }
    if (start?.(event) === false) {
      return;
    }
    event.preventDefault();
    const x = event.clientX;
    const y = event.clientY;
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('dragging');
    const onMove = (next: PointerEvent) => move(next, next.clientX - x, next.clientY - y);
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      document.body.classList.remove('dragging');
      end?.();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  });
};

export const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
