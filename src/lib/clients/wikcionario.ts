// Wikcionario client (Spanish).
// Uses MediaWiki API; no key required.

import type { LookupResult, Definition } from '../types.js';

const API_URL = 'https://es.wiktionary.org/w/api.php';

interface MWResponse {
  query?: {
    pages?: Record<string, {
      pageid?: number;
      title?: string;
      extract?: string;
      missing?: string;
    }>;
  };
}

export async function lookupWikcionario(word: string): Promise<LookupResult | null> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    exsectionformat: 'plain',
    titles: word,
    format: 'json',
    redirects: '1',
  });

  const url = `${API_URL}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Wikcionario HTTP ${response.status}`);
  }

  const data: MWResponse = await response.json();
  const pages = data.query?.pages ?? {};
  const pageValues = Object.values(pages);

  if (pageValues.length === 0) return null;
  const page = pageValues[0]!;

  if (page.missing !== undefined || !page.extract) return null;

  return parseExtract(word, page.extract);
}

function parseExtract(word: string, extract: string): LookupResult | null {
  // The extract is plain text from MediaWiki. Spanish Wiktionary entries have
  // sections like:
  //   == {{lengua|es}} ==
  //   === {{sustantivo masculino|es}} ===
  //   # Definición 1.
  //   ## Ejemplo
  //   # Definición 2.
  //   === Etimología ===
  //   ...
  //
  // We extract definitions (lines starting with "#") and group them by part-of-speech section.

  const lines = extract.split('\n');
  const definitions: Definition[] = [];
  let etymology: string | undefined;
  let currentPos: string | undefined;
  let currentDef: { pos: string; text: string[]; examples: string[] } | null = null;

  const flush = () => {
    if (currentDef && currentDef.text.length > 0) {
      const def: Definition = { partOfSpeech: currentDef.pos, text: currentDef.text.join(' ').trim() };
      if (currentDef.examples.length > 0) def.examples = currentDef.examples;
      definitions.push(def);
    }
    currentDef = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Any section header: == or === with content
    const sectionMatch = line.match(/^={2,4}\s*(.+?)\s*={2,4}$/);
    if (sectionMatch) {
      flush();
      const name = sectionMatch[1]!.trim();

      // POS section: {{sustantivo masculino|es}} or {{adjetivo}}
      const posInline = name.match(/^\{\{([^|}]+)(?:\|[^}]*)?\}\}$/);
      if (posInline) {
        currentPos = posInline[1]!.trim();
        currentDef = { pos: currentPos, text: [], examples: [] };
        continue;
      }

      // Etymology section: == Etimología == or === Etimología ===
      if (name.toLowerCase().includes('etimolog')) {
        const idx = lines.indexOf(raw);
        const etyLines: string[] = [];
        for (let i = idx + 1; i < lines.length; i++) {
          const l = lines[i]!.trim();
          if (l.startsWith('=')) break;
          if (l) etyLines.push(l);
        }
        if (etyLines.length > 0) etymology = etyLines.join(' ').replace(/^\[\[|\]\]$/g, '').slice(0, 500);
        currentDef = null;
        continue;
      }

      // Other section: ignore for now (we don't add as POS to avoid polluting definitions)
      currentDef = null;
      continue;
    }

    // Example line: #: text or ## text (must come BEFORE def line because ## also matches #)
    const exMatch = line.match(/^:#\s*(.+)$/) || line.match(/^##\s*(.+)$/);
    if (exMatch && currentDef) {
      let example = exMatch[1]!
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1');
      example = example.replace(/^Ejemplo:\s*/i, '').trim();
      if (example) currentDef.examples.push(example);
      continue;
    }

    // Definition line: # text (with mandatory space after # to avoid matching ##)
    const defMatch = line.match(/^#\s+(.+)$/);
    if (defMatch && currentDef) {
      currentDef.text.push(defMatch[1]!.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1'));
      continue;
    }
  }

  flush();

  if (definitions.length === 0) return null;

  return {
    word,
    language: 'es',
    source: 'wikcionario',
    definitions,
    ...(etymology !== undefined ? { etymology } : {}),
  };
}
