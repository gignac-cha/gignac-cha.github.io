// Pure theme selection and persistence logic (auto / light / dark).
// Manages localStorage['footprint:theme'] and resolves effective theme attribute.

export type AppTheme = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'footprint:theme';

export function readStoredTheme(
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
): AppTheme {
  if (!storage) {
    return 'auto';
  }
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'auto') {
      return raw;
    }
    return 'auto';
  } catch {
    return 'auto';
  }
}

export function writeStoredTheme(
  theme: AppTheme,
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write failures
  }
}

export function getEffectiveTheme(theme: AppTheme, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'light') {
    return 'light';
  }
  if (theme === 'dark') {
    return 'dark';
  }
  return prefersDark ? 'dark' : 'light';
}
