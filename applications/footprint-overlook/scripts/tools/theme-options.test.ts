import { describe, expect, it } from 'vitest';

import {
  getEffectiveTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
} from './theme-options.ts';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe('theme-options', () => {
  it('defaults to auto when storage is empty or invalid', () => {
    const storage = new MemoryStorage();
    expect(readStoredTheme(storage)).toBe('auto');

    storage.setItem(THEME_STORAGE_KEY, 'invalid');
    expect(readStoredTheme(storage)).toBe('auto');
  });

  it('reads and writes valid themes to storage', () => {
    const storage = new MemoryStorage();
    writeStoredTheme('dark', storage);
    expect(readStoredTheme(storage)).toBe('dark');

    writeStoredTheme('light', storage);
    expect(readStoredTheme(storage)).toBe('light');
  });

  it('resolves effective theme according to OS preference in auto mode', () => {
    expect(getEffectiveTheme('auto', true)).toBe('dark');
    expect(getEffectiveTheme('auto', false)).toBe('light');
    expect(getEffectiveTheme('light', true)).toBe('light');
    expect(getEffectiveTheme('dark', false)).toBe('dark');
  });
});
