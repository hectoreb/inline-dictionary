// Service worker: receives LOOKUP_WORD messages, dispatches to API clients,
// checks/writes cache, returns result or error.

import { lookupWikcionario } from '../lib/clients/wikcionario.js';
import { lookupMerriam } from '../lib/clients/merriam.js';
import { detectLanguage } from '../lib/detector.js';
import { getCached, setCached, isRecentNotFound, markNotFound } from '../lib/cache.js';
import { getApiKey, getDefaultLanguage } from '../lib/storage.js';
import type { LookupRequest, LookupResponse, Language, Source } from '../lib/types.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Inline Dictionary] installed');
});

// Warm up: keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('[Inline Dictionary] startup');
});

chrome.runtime.onMessage.addListener(
  (message: LookupRequest, _sender, sendResponse) => {
    handleLookup(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        console.error('[Inline Dictionary] lookup error', err);
        sendResponse({
          ok: false,
          error: 'UNKNOWN',
          message: err instanceof Error ? err.message : 'Unknown error',
        } satisfies LookupResponse);
      });
    return true; // async response
  }
);

async function handleLookup(request: LookupRequest): Promise<LookupResponse> {
  const word = request.word.trim();
  if (!word) {
    return { ok: false, error: 'NOT_FOUND', message: 'Empty word' };
  }

  // 1. Determine language
  let language: Language;
  if (request.language) {
    language = request.language;
  } else {
    const defaultLang = await getDefaultLanguage();
    language = defaultLang === 'auto' ? detectLanguage(word) : defaultLang;
  }

  // 2. Determine source
  const source: Source = language === 'es' ? 'wikcionario' : 'merriam-webster';

  // 3. Check cache
  const cached = await getCached(word, source);
  if (cached) {
    return { ok: true, result: cached };
  }

  // 4. Check recent not-found (avoid hammering APIs)
  if (await isRecentNotFound(word, source)) {
    return { ok: false, error: 'NOT_FOUND', message: `No se encontró definición para "${word}"` };
  }

  // 5. Fetch from API
  try {
    const result = language === 'es'
      ? await lookupWikcionario(word)
      : await lookupMerriam(word, (await getApiKey()) ?? '');

    if (!result) {
      await markNotFound(word, source);
      return { ok: false, error: 'NOT_FOUND', message: `No se encontró definición para "${word}"` };
    }

    await setCached(word, source, result);
    return { ok: true, result };
  } catch (err: unknown) {
    return errorToResponse(err, language);
  }
}

function errorToResponse(err: unknown, language: Language): LookupResponse {
  if (err instanceof Error) {
    const code = err.name;
    if (code === 'MW_KEY_MISSING') {
      return { ok: false, error: 'MW_KEY_MISSING', message: 'Falta configurar API key de Merriam-Webster en opciones.' };
    }
    if (code === 'MW_KEY_INVALID') {
      return { ok: false, error: 'MW_KEY_INVALID', message: 'API key de Merriam-Webster inválida. Revisa opciones.' };
    }
    if (code === 'MW_RATE_LIMIT') {
      return { ok: false, error: 'MW_RATE_LIMIT', message: 'Límite diario de Merriam-Webster alcanzado. Intenta mañana.' };
    }
    if (language === 'es') {
      return { ok: false, error: 'WIKCIONARIO_UNAVAILABLE', message: 'Wikcionario no disponible. Intenta en un momento.' };
    }
  }
  // Generic / network error
  const message = err instanceof Error ? err.message : 'Error desconocido';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return { ok: false, error: 'OFFLINE', message: 'Sin conexión. Verifica tu red.' };
  }
  return { ok: false, error: 'UNKNOWN', message };
}
