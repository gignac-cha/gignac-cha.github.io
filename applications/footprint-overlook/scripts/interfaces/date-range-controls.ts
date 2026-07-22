// 날짜 범위 프리셋(7일 / 30일 / 90일) 버튼 그룹입니다. 선택 상태를 스타일로 표시하고 선택 시 콜백을 부릅니다.

// 프리셋 정의: 라벨과 일수.
export interface RangePreset {
  label: string;
  days: number;
}

export const RANGE_PRESETS: RangePreset[] = [
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
];

export interface RangeControlsHandle {
  element: HTMLElement;
  setActiveDays(days: number): void;
}

// 프리셋 버튼 그룹을 만듭니다. onSelect 는 선택된 일수를 넘깁니다.
export function createRangeControls(options: { onSelect: (days: number) => void }): RangeControlsHandle {
  const group = document.createElement('section');
  group.className = 'range-controls';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '기간 선택');

  const buttonByDays = new Map<number, HTMLButtonElement>();

  for (const preset of RANGE_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'range-button';
    button.textContent = preset.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => options.onSelect(preset.days));
    group.appendChild(button);
    buttonByDays.set(preset.days, button);
  }

  const setActiveDays = (days: number): void => {
    for (const [presetDays, button] of buttonByDays) {
      const isActive = presetDays === days;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  };

  return { element: group, setActiveDays };
}
