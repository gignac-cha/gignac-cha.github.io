import { describe, expect, it, vi } from 'vitest';
import { readDatabase, writeDatabase } from './indexedDB.ts';

const requestFiring = (type: string, properties: Record<string, unknown> = {}) => {
  const listeners = new Map<string, () => void>();
  queueMicrotask(() => listeners.get(type)?.());
  return {
    ...properties,
    addEventListener: (name: string, listener: () => void) => void listeners.set(name, listener),
  };
};

describe('indexedDB', () => {
  it('writes and reads a value back', async () => {
    await writeDatabase('footprint-rw', 'abc');
    expect(await readDatabase('footprint-rw')).toBe('abc');
  });

  it('overwrites an existing value', async () => {
    await writeDatabase('footprint-ow', 'first');
    await writeDatabase('footprint-ow', 'second');
    expect(await readDatabase('footprint-ow')).toBe('second');
  });

  it('keeps different keys in fully separate databases', async () => {
    await writeDatabase('footprint-a', 'A');
    await writeDatabase('footprint-b', 'B');
    expect(await readDatabase('footprint-a')).toBe('A');
    expect(await readDatabase('footprint-b')).toBe('B');
  });

  it('returns undefined for an empty store', async () => {
    expect(await readDatabase('footprint-empty')).toBeUndefined();
  });

  it('rejects when the database cannot be opened', async () => {
    const error = new DOMException('open failed', 'UnknownError');
    vi.stubGlobal('indexedDB', { open: () => requestFiring('error', { error }) });
    await expect(readDatabase('broken')).rejects.toBe(error);
  });

  it('resolves undefined when the read request errors', async () => {
    const database = {
      createObjectStore: () => ({}),
      transaction: () => ({
        objectStore: () => ({ get: () => requestFiring('error') }),
        addEventListener: () => {},
      }),
    };
    vi.stubGlobal('indexedDB', { open: () => requestFiring('success', { result: database }) });
    expect(await readDatabase('flaky')).toBeUndefined();
  });

  it('resolves instead of hanging when the write transaction errors', async () => {
    const database = {
      createObjectStore: () => ({}),
      transaction: () => {
        const listeners = new Map<string, () => void>();
        queueMicrotask(() => listeners.get('error')?.());
        return {
          objectStore: () => ({ put: () => requestFiring('success') }),
          addEventListener: (name: string, listener: () => void) => void listeners.set(name, listener),
        };
      },
    };
    vi.stubGlobal('indexedDB', { open: () => requestFiring('success', { result: database }) });
    await expect(writeDatabase('flaky', 'x')).resolves.toBeUndefined();
  });
});
