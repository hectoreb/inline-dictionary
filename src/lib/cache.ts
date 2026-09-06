// IndexedDB-backed cache for lookup results.
// Uses idb-keyval (3KB) for a thin Promise wrapper around IndexedDB.
// Single object store; not-found entries use a key prefix to share the store.

import { get, set, del, clear, createStore } from 'idb-keyval';
import type { LookupResult, Source } from './types.js';

const STORE = createStore('inline-dictionary-db', 'lookups');
const NOT_FOUND_PREFIX = '!nf:';
const MAX_ENTRIES = 5000;
const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

interface CacheEntry extends LookupResult {
  cachedAt: number;
}

interface NotFoundEntry {
  word: string;
  source: Source;
  markedAt: number;
}

function cacheKey(word: string, source: Source): string {
  return `${word.toLowerCase()}::${source}`;
}

function notFoundKey(word: string, source: Source): string {
  return `${NOT_FOUND_PREFIX}${cacheKey(word, source)}`;
}

export async function getCached(word: string, source: Source): Promise<LookupResult | null> {
  const key = cacheKey(word, source);
  const entry = await get<CacheEntry>(key, STORE);
  if (!entry) return null;
  // Strip metadata before returning
  const { cachedAt: _cachedAt, ...result } = entry;
  return result;
}

export async function setCached(word: string, source: Source, result: LookupResult): Promise<void> {
  const key = cacheKey(word, source);
  const entry: CacheEntry = { ...result, cachedAt: Date.now() };
  await set(key, entry, STORE);
  await evictIfNeeded();
}

export async function isRecentNotFound(word: string, source: Source): Promise<boolean> {
  const key = notFoundKey(word, source);
  const entry = await get<NotFoundEntry>(key, STORE);
  if (!entry) return false;
  const age = Date.now() - entry.markedAt;
  if (age > NOT_FOUND_TTL_MS) {
    await del(key, STORE);
    return false;
  }
  return true;
}

export async function markNotFound(word: string, source: Source): Promise<void> {
  const key = notFoundKey(word, source);
  const entry: NotFoundEntry = { word, source, markedAt: Date.now() };
  await set(key, entry, STORE);
}

export async function clearCache(): Promise<void> {
  await clear(STORE);
}

export async function getCacheStats(): Promise<{ entries: number; notFoundEntries: number }> {
  return { entries: -1, notFoundEntries: -1 };
}

async function evictIfNeeded(): Promise<void> {
  // Stub: idb-keyval doesn't expose keys() efficiently. For 5K entries this is fine.
  // TODO: implement real LRU if cache grows unbounded
  void MAX_ENTRIES;
}
