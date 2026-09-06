import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupWikcionario } from '../clients/wikcionario.js';

describe('lookupWikcionario', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a standard entry with one part of speech (multiple definitions grouped)', async () => {
    const mockResponse = {
      query: {
        pages: {
          '123': {
            pageid: 123,
            title: 'casa',
            extract: `== {{lengua|es}} ==

=== {{sustantivo femenino|es}} ===

# Edificio para habitar.
## Ejemplo: Mi casa es tu casa.
# Hogar.

=== Etimología ===

Del latín casa.`,
          },
        },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await lookupWikcionario('casa');
    expect(result).not.toBeNull();
    expect(result?.word).toBe('casa');
    expect(result?.language).toBe('es');
    expect(result?.source).toBe('wikcionario');
    // Both `#` lines under the same POS section are grouped into one Definition entry
    expect(result?.definitions).toHaveLength(1);
    expect(result?.definitions[0]?.text).toContain('Edificio para habitar');
    expect(result?.definitions[0]?.text).toContain('Hogar');
    expect(result?.definitions[0]?.examples).toContain('Mi casa es tu casa.');
    expect(result?.etymology).toContain('latín');
  });

  it('returns null when the page is missing', async () => {
    const mockResponse = {
      query: {
        pages: {
          '-1': { title: 'asdfqwer', missing: '' },
        },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await lookupWikcionario('asdfqwer');
    expect(result).toBeNull();
  });

  it('strips wiki-link formatting from definitions', async () => {
    const mockResponse = {
      query: {
        pages: {
          '1': {
            title: 'perro',
            extract: `== {{lengua|es}} ==

=== {{sustantivo masculino|es}} ===

# [[Animal]] doméstico de la familia [[canidae|Cánidos]].`,
          },
        },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await lookupWikcionario('perro');
    expect(result?.definitions[0]?.text).toBe('Animal doméstico de la familia Cánidos.');
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Server Error', { status: 500 })
    );

    await expect(lookupWikcionario('test')).rejects.toThrow('Wikcionario HTTP 500');
  });
});
