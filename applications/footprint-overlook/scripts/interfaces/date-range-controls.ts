import {
  type AppTheme,
  getEffectiveTheme,
  readStoredTheme,
  writeStoredTheme,
} from '../tools/theme-options.ts';

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
  setActiveDays(days: number | null): void;
  setCustomDates(from: string, to: string): void;
}

export function createRangeControls(options: {
  onSelectPreset: (days: number) => void;
  onSelectCustom: (from: string, to: string) => void;
}): RangeControlsHandle {
  const container = document.createElement('section');
  container.className = 'range-controls';
  container.setAttribute('aria-label', '기간 및 테마 설정');

  // 1. Preset Buttons Group
  const buttonsGroup = document.createElement('div');
  buttonsGroup.className = 'range-buttons-group';
  buttonsGroup.setAttribute('role', 'group');
  buttonsGroup.setAttribute('aria-label', '기간 선택');

  const buttonByDays = new Map<number, HTMLButtonElement>();

  for (const preset of RANGE_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'range-button';
    button.textContent = preset.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => options.onSelectPreset(preset.days));
    buttonsGroup.appendChild(button);
    buttonByDays.set(preset.days, button);
  }
  container.appendChild(buttonsGroup);

  // 2. Custom Date Range Group
  const customGroup = document.createElement('div');
  customGroup.className = 'custom-range-group';

  const fromInput = document.createElement('input');
  fromInput.type = 'date';
  fromInput.setAttribute('aria-label', '시작 날짜 (from)');

  const toInput = document.createElement('input');
  toInput.type = 'date';
  toInput.setAttribute('aria-label', '종료 날짜 (to)');

  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.className = 'range-apply-button';
  applyButton.textContent = '적용';
  applyButton.addEventListener('click', () => {
    if (fromInput.value && toInput.value) {
      options.onSelectCustom(fromInput.value, toInput.value);
    }
  });

  const utcLabel = document.createElement('span');
  utcLabel.className = 'utc-label';
  utcLabel.textContent = '(UTC 기준 [from, to))';

  customGroup.appendChild(fromInput);
  customGroup.appendChild(document.createTextNode(' ~ '));
  customGroup.appendChild(toInput);
  customGroup.appendChild(applyButton);
  customGroup.appendChild(utcLabel);
  container.appendChild(customGroup);

  // 3. Theme Toggle Group (auto / light / dark)
  const themeGroup = document.createElement('div');
  themeGroup.className = 'theme-toggle-group';

  const currentTheme = readStoredTheme();
  applyThemeToDocument(currentTheme);

  const themeButtons: Array<{ theme: AppTheme; label: string; element: HTMLButtonElement }> = [
    { theme: 'auto', label: '자동', element: document.createElement('button') },
    { theme: 'light', label: '라이트', element: document.createElement('button') },
    { theme: 'dark', label: '다크', element: document.createElement('button') },
  ];

  function updateThemeButtons(activeTheme: AppTheme): void {
    for (const item of themeButtons) {
      const isActive = item.theme === activeTheme;
      item.element.classList.toggle('is-active', isActive);
      item.element.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  for (const item of themeButtons) {
    item.element.type = 'button';
    item.element.className = 'theme-button';
    item.element.textContent = item.label;
    item.element.addEventListener('click', () => {
      writeStoredTheme(item.theme);
      applyThemeToDocument(item.theme);
      updateThemeButtons(item.theme);
    });
    themeGroup.appendChild(item.element);
  }
  updateThemeButtons(currentTheme);
  container.appendChild(themeGroup);

  function applyThemeToDocument(theme: AppTheme): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = getEffectiveTheme(theme, prefersDark);
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', effective);
    }
  }

  const setActiveDays = (days: number | null): void => {
    for (const [presetDays, button] of buttonByDays) {
      const isActive = days !== null && presetDays === days;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  };

  const setCustomDates = (from: string, to: string): void => {
    fromInput.value = from;
    toInput.value = to;
  };

  return { element: container, setActiveDays, setCustomDates };
}
