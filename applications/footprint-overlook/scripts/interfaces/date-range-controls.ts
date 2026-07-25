// Range preset buttons (7 / 30 / 90 days): they carry the selected state in both a class and
// aria-pressed, and hand the chosen day count to the dashboard.

// One preset: its label and its day count.
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

// Builds the button group. onSelect receives the selected day count.
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
