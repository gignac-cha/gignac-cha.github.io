// Stale-While-Revalidate (SWR) localStorage caching logic for query results.
// Implements versioning and silent fallback on corrupted data or storage exceptions.

export const CACHE_VERSION = 'v1';

export interface CachedEnvelope<Row> {
  version: string;
  storedAt: number;
  rows: Row[];
}

// Options for writeQueryCache. `storage` defaults to the ambient localStorage when the option (or
// the whole options object) is omitted, and is skipped as a no-op only when explicitly set to
// null. Distinguishing "unspecified" from "explicitly none" here is what lets most call sites omit
// the option entirely while a caller that genuinely has no storage (or wants to opt out, e.g. in a
// non-browser context) can still say so unambiguously with `{ storage: null }`.
export interface CacheWriteOptions {
  storage?: Storage | null;
  timestamp?: number;
}

export function buildCacheKey(queryName: string, rangeKey: string): string {
  return `footprint:cache:${queryName}:${rangeKey}`;
}

export function readQueryCache<Row>(
  queryName: string,
  rangeKey: string,
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
): { storedAt: number; rows: Row[] } | null {
  if (!storage) {
    return null;
  }
  const cacheKey = buildCacheKey(queryName, rangeKey);
  try {
    const rawText = storage.getItem(cacheKey);
    if (!rawText) {
      return null;
    }
    const parsed = JSON.parse(rawText) as Partial<CachedEnvelope<Row>> | null;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      parsed.version === CACHE_VERSION &&
      typeof parsed.storedAt === 'number' &&
      // Number.isFinite (not just typeof === 'number') rejects NaN and also an Infinity that
      // survived JSON round-tripping -- JSON permits an exponent literal like `1e400` that
      // overflows double precision during parsing, which `typeof` alone would accept.
      Number.isFinite(parsed.storedAt) &&
      Array.isArray(parsed.rows)
    ) {
      return { storedAt: parsed.storedAt, rows: parsed.rows };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeQueryCache(
  queryName: string,
  rangeKey: string,
  rows: unknown[],
  options?: CacheWriteOptions,
): void {
  const storageOption = options?.storage;
  const storage =
    storageOption === null
      ? null
      : (storageOption ?? (typeof localStorage !== 'undefined' ? localStorage : null));
  if (!storage) {
    return;
  }
  const cacheKey = buildCacheKey(queryName, rangeKey);
  const envelope: CachedEnvelope<unknown> = {
    version: CACHE_VERSION,
    storedAt: options?.timestamp ?? Date.now(),
    rows,
  };
  try {
    storage.setItem(cacheKey, JSON.stringify(envelope));
  } catch {
    // Silently ignore storage quota or permission failures
  }
}

export function formatCacheTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
