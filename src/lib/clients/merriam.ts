// Merriam-Webster Collegiate API client (English).
// Requires an API key from https://dictionaryapi.com/

import type { LookupResult, Definition } from '../types.js';

const API_URL = 'https://www.dictionaryapi.com/api/v3/references/collegiate/json';

interface MWEntry {
  meta?: {
    id?: string;
    uuid?: string;
    stems?: string[];
    offensive?: boolean;
  };
  fl?: string;          // functional label = part of speech
  shortdef?: string[];  // short definitions array
  et?: string[];        // etymology (array of strings, may contain formatting)
  prs?: Array<{
    mw?: string;        // pronunciation in Merriam-Webster format
    sound?: { audio?: string };
  }>;
  def?: Array<{
    sseq?: Array<Array<Array<{ dt?: Array<[string, string] | string> }>>>;
  }>;
}

function stripFormatting(s: string): string {
  // Remove Merriam-Webster inline formatting markers like {bc}, {it}, {wi}, etc.
  return s.replace(/\{[^}]+\}/g, '').replace(/\\:/g, '').trim();
}

export async function lookupMerriam(word: string, apiKey: string): Promise<LookupResult | null> {
  if (!apiKey) {
    const err = new Error('MW_KEY_MISSING');
    err.name = 'MW_KEY_MISSING';
    throw err;
  }

  const url = `${API_URL}/${encodeURIComponent(word)}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error('MW_KEY_INVALID');
    err.name = 'MW_KEY_INVALID';
    throw err;
  }
  if (response.status === 429) {
    const err = new Error('MW_RATE_LIMIT');
    err.name = 'MW_RATE_LIMIT';
    throw err;
  }
  if (!response.ok) {
    throw new Error(`Merriam-Webster HTTP ${response.status}`);
  }

  const data: MWEntry[] = await response.json();

  // MW returns ["word", "suggestion1", "suggestion2"] when the word is not found
  if (data.length === 0) return null;
  if (typeof (data[0] as unknown) === 'string') return null;

  return parseEntries(word, data);
}

function parseEntries(word: string, entries: MWEntry[]): LookupResult | null {
  const definitions: Definition[] = [];
  let etymology: string | undefined;
  let pronunciation: string | undefined;

  for (const entry of entries) {
    if (entry.fl && entry.shortdef && entry.shortdef.length > 0) {
      // Extract IPA from prs (Merriam-Webster format may have "ˈwɜːrd" or similar)
      if (!pronunciation && entry.prs && entry.prs.length > 0) {
        const firstPron = entry.prs[0];
        if (firstPron?.mw) pronunciation = firstPron.mw;
      }

      for (const def of entry.shortdef) {
        definitions.push({
          partOfSpeech: entry.fl,
          text: stripFormatting(def),
        });
      }
    }

    // Etymology
    if (!etymology && entry.et && entry.et.length > 0) {
      etymology = entry.et.map(stripFormatting).join(' ').slice(0, 500);
    }
  }

  if (definitions.length === 0) return null;

  return {
    word,
    language: 'en',
    source: 'merriam-webster',
    definitions,
    ...(etymology !== undefined ? { etymology } : {}),
    ...(pronunciation !== undefined ? { pronunciation } : {}),
  };
}
