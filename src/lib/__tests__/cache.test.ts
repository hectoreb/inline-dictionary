import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getCached, setCached, isRecentNotFound, markNotFound, clearCache } from '../cache.js';
import type { LookupResult } from '../types.js';

const sampleResult: LookupResult = {
  word: 'casa',
  language: 'es',
  source: 'wikcionario',
  definitions: [{ partOfSpeech: 'sustantivo', text: 'Edificio para habitar.' }],
};

describe('cache', () => {
  beforeEach(async () => {
    await clearCache();
  });

  it('returns null on cache miss', async () => {
    const result = await getCached('unknown', 'wikcionario');
    expect(result).toBeNull();
  });

  it('stores and retrieves a result', async () => {
    await setCached('casa', 'wikcionario', sampleResult);
    const result = await getCached('casa', 'wikcionario');
    expect(result).toEqual(sampleResult);
  });

  it('is case-insensitive on the word', async () => {
    await setCached('Casa', 'wikcionario', sampleResult);
    const result = await getCached('casa', 'wikcionario');
    expect(result).toEqual(sampleResult);
  });

  it('separates results by source', async () => {
    await setCached('casa', 'wikcionario', sampleResult);
    const result = await getCached('casa', 'merriam-webster');
    expect(result).toBeNull();
  });

  it('tracks recent not-found markers', async () => {
    expect(await isRecentNotFound('ghost', 'wikcionario')).toBe(false);
    await markNotFound('ghost', 'wikcionario');
    expect(await isRecentNotFound('ghost', 'wikcionario')).toBe(true);
  });

  it('clears all cache', async () => {
    await setCached('casa', 'wikcionario', sampleResult);
    await markNotFound('ghost', 'wikcionario');
    await clearCache();
    expect(await getCached('casa', 'wikcionario')).toBeNull();
    expect(await isRecentNotFound('ghost', 'wikcionario')).toBe(false);
  });
});
