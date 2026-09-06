import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupMerriam } from '../clients/merriam.js';

describe('lookupMerriam', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a standard entry with definitions and pronunciation', async () => {
    const mockResponse = [
      {
        meta: { id: 'word:1', uuid: 'abc-123' },
        fl: 'noun',
        shortdef: ['a word meaning something', 'another meaning'],
        prs: [{ mw: 'wɜrd' }],
        et: ['from Old English'],
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await lookupMerriam('word', 'test-key');
    expect(result).not.toBeNull();
    expect(result?.word).toBe('word');
    expect(result?.language).toBe('en');
    expect(result?.source).toBe('merriam-webster');
    expect(result?.definitions).toHaveLength(2);
    expect(result?.definitions[0]?.text).toBe('a word meaning something');
    expect(result?.pronunciation).toBe('wɜrd');
    expect(result?.etymology).toBe('from Old English');
  });

  it('returns null when the API suggests similar words', async () => {
    // MW returns ["word", "suggestion1", ...] when the word is not found
    const mockResponse = ['word', 'sword', 'words'];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await lookupMerriam('word', 'test-key');
    expect(result).toBeNull();
  });

  it('throws MW_KEY_MISSING when no API key provided', async () => {
    await expect(lookupMerriam('word', '')).rejects.toMatchObject({ name: 'MW_KEY_MISSING' });
  });

  it('throws MW_KEY_INVALID on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );

    await expect(lookupMerriam('word', 'bad-key')).rejects.toMatchObject({ name: 'MW_KEY_INVALID' });
  });

  it('throws MW_RATE_LIMIT on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Too Many Requests', { status: 429 })
    );

    await expect(lookupMerriam('word', 'test-key')).rejects.toMatchObject({ name: 'MW_RATE_LIMIT' });
  });

  it('strips formatting markers from definitions and etymology', async () => {
    const mockResponse = [
      {
        fl: 'verb',
        shortdef: ['to {bc}test{/bc} something'],
        et: ['{it}from{/it} Latin {wi}testa{/wi}'],
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await lookupMerriam('test', 'test-key');
    expect(result?.definitions[0]?.text).toBe('to test something');
    expect(result?.etymology).toBe('from Latin testa');
  });
});
