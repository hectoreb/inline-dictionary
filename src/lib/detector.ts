// Language detection heuristic for ES vs EN
// Returns 'es' if the word looks Spanish, 'en' otherwise.

import type { Language } from './types.js';

// Common Spanish words that don't have diacritics (would be mis-detected without this list)
const COMMON_ES_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'por', 'para', 'con', 'sin',
  'y', 'o', 'u', 'e', 'que', 'qué', 'cual', 'cuál',
  'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
  'mi', 'tu', 'su', 'mis', 'tus', 'sus',
  'ser', 'estar', 'tener', 'haber', 'hacer', 'ir', 'ver', 'dar',
  'es', 'son', 'está', 'están', 'fue', 'fueron',
  'no', 'sí', 'si', 'muy', 'más', 'menos', 'también', 'tampoco',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'aquel', 'aquella', 'aquellos', 'aquellas',
  'como', 'cómo', 'cuando', 'cuándo', 'donde', 'dónde',
  'porque', 'por qué', 'aunque', 'si', 'mientras',
  'casa', 'mundo', 'tiempo', 'día', 'noche', 'agua', 'fuego', 'tierra',
  'hombre', 'mujer', 'niño', 'niña', 'persona', 'gente',
  'trabajo', 'familia', 'amigo', 'amiga', 'amor', 'vida', 'muerte',
  'grande', 'pequeño', 'bueno', 'malo', 'nuevo', 'viejo',
  'primero', 'segundo', 'tercero', 'último',
  'sobre', 'bajo', 'entre', 'hasta', 'desde', 'hacia',
  'pero', 'sino', 'aunque', 'mientras', 'porque',
]);

export function detectLanguage(word: string): Language {
  const w = word.toLowerCase().trim();

  // 1. Diacritics that are rare in English but common in Spanish
  if (/[ñü]/.test(w)) return 'es';
  // Acute accents on Spanish vowels (á, é, í, ó, ú) — present in both langs but heavily skewed to ES
  // Weight: any accent on a word of 4+ chars = ES
  if (w.length >= 4) {
    const diacriticCount = (w.match(/[áéíóú]/g) || []).length;
    if (diacriticCount >= 1) return 'es';
  }

  // 2. Common Spanish function words
  if (COMMON_ES_WORDS.has(w)) return 'es';

  // 3. Suffixes that are very common in Spanish
  if (/(?:ación|ión|idad|mente|ado|ido|ando|iendo)$/.test(w)) return 'es';

  // 4. Default: English
  return 'en';
}
