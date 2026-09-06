// Language detection heuristic for ES vs EN.
// Order of checks matters: strongest signals first, default to Spanish
// because (a) the user reads Spanish, (b) Wikcionario is free and always works,
// (c) Merriam-Webster requires a configured API key.

import type { Language } from './types.js';

// Common English function/content words (no diacritics, very high precision for EN)
// Note: "a" and "i" are intentionally NOT here — they are 1-letter words that
// exist in both languages (English "a/an" article, Spanish "a" preposition).
// We let them fall through to the length-based default below.
const COMMON_EN_WORDS = new Set([
  // Articles, demonstratives, quantifiers
  'the', 'an', 'this', 'that', 'these', 'those', 'some', 'any', 'all',
  'each', 'every', 'none', 'both', 'either', 'neither', 'one', 'ones',
  // Pronouns
  'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his',
  'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours',
  'they', 'them', 'their', 'theirs', 'who', 'whom', 'whose', 'what', 'which',
  // Auxiliary & modal verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'done',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'ought',
  // Common prepositions
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'as', 'into',
  'about', 'between', 'through', 'during', 'before', 'after', 'above', 'below',
  'up', 'down', 'out', 'off', 'over', 'under', 'than', 'until', 'while',
  // Common conjunctions & adverbs
  'and', 'or', 'but', 'if', 'then', 'so', 'because', 'although', 'though',
  'when', 'where', 'why', 'how', 'not', 'only', 'also', 'just', 'very',
  'more', 'most', 'less', 'least', 'much', 'many', 'few', 'several',
  'too', 'quite', 'still', 'already', 'yet', 'ever', 'never', 'always', 'often',
  'here', 'there', 'now', 'today', 'tomorrow', 'yesterday',
  'hello', 'hi', 'hey',
  // Common adjectives (basic)
  'good', 'bad', 'big', 'small', 'long', 'short', 'high', 'low',
  'old', 'young', 'new', 'great', 'little', 'large', 'next', 'last', 'first', 'second',
  // Common verbs (basic)
  'get', 'got', 'make', 'made', 'take', 'took', 'come', 'came', 'see', 'saw',
  'know', 'knew', 'go', 'goes', 'went', 'say', 'said', 'give', 'gave', 'find', 'found',
  'think', 'thought', 'tell', 'told', 'ask', 'work', 'seem', 'feel', 'try', 'left',
  'call', 'use', 'want', 'need', 'help', 'put', 'play', 'run', 'move', 'live',
  'show', 'keep', 'turn', 'start', 'open', 'close', 'read', 'write', 'pay', 'buy',
  'walk', 'talk', 'sit', 'stand', 'lose', 'win', 'send', 'fall', 'cut', 'let',
  // Common nouns (basic)
  'time', 'year', 'day', 'man', 'woman', 'child', 'people', 'way', 'thing', 'world',
  'life', 'hand', 'part', 'place', 'case', 'week', 'company', 'system', 'program',
  'number', 'night', 'point', 'home', 'water', 'room', 'mother', 'area', 'money',
  'story', 'fact', 'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word',
  'algorithm', 'function', 'philosophy', 'theory', 'history', 'culture', 'music',
  'science', 'computer', 'software', 'hardware', 'network', 'database', 'server',
]);

// Common Spanish function/content words (no diacritics, basic vocabulary)
const COMMON_ES_WORDS = new Set([
  // Articles, demonstratives, quantifiers
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'aquel', 'aquella', 'aquellos', 'aquellas',
  // Pronouns
  'yo', 'tu', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
  'mi', 'mis', 'tus', 'su', 'sus', 'mio', 'tuyo', 'suyo',
  // Prepositions
  'de', 'del', 'al', 'a', 'en', 'por', 'para', 'con', 'sin', 'sobre', 'bajo',
  'entre', 'hasta', 'desde', 'hacia', 'contra', 'durante', 'mediante',
  // Conjunctions & adverbs
  'y', 'o', 'u', 'e', 'que', 'si', 'no', 'pero', 'sino', 'aunque', 'mientras', 'porque',
  'muy', 'mas', 'menos', 'tambien', 'tampoco', 'solo', 'bien', 'mal',
  'siempre', 'nunca', 'ahora', 'antes', 'despues', 'luego', 'aqui', 'alli',
  'donde', 'como', 'cuando', 'cuanto', 'cual',
  // Common verbs (infinitive, no accent needed)
  'ser', 'estar', 'tener', 'haber', 'hacer', 'ir', 'ver', 'dar', 'saber', 'poder',
  'querer', 'decir', 'llegar', 'pasar', 'quedar', 'creer', 'hablar', 'llevar',
  'dejar', 'encontrar', 'seguir', 'poner', 'parecer', 'vivir', 'sentir', 'mirar',
  'comenzar', 'tomar', 'conocer', 'pensar', 'salir', 'volver', 'traer', 'caer',
  'abrir', 'cerrar', 'partir', 'morir', 'escribir', 'leer', 'perder', 'ganar',
  'producir', 'ocurrir', 'entender', 'pedir', 'recibir', 'servir', 'mantener',
  'existir', 'aparecer', 'considerar', 'presentar', 'realizar', 'suponer', 'obtener',
  // Common nouns (no accent)
  'casa', 'mundo', 'tiempo', 'dia', 'agua', 'fuego', 'tierra', 'aire', 'sol', 'luna',
  'hombre', 'mujer', 'nino', 'nina', 'persona', 'gente', 'amigo', 'amiga',
  'familia', 'padre', 'madre', 'hijo', 'hija', 'hermano', 'hermana',
  'perro', 'gato', 'libro', 'mesa', 'silla', 'puerta', 'ventana',
  'ciudad', 'pais', 'estado', 'parte', 'forma', 'manera', 'lado', 'fin', 'principio',
  'trabajo', 'escuela', 'coche', 'comida', 'noche', 'manana', 'tarde',
  'amor', 'odio', 'vida', 'muerte', 'guerra', 'paz', 'dios', 'rey', 'reina',
  'problema', 'tema', 'idea', 'razon', 'camino', 'calle', 'plaza', 'juego',
  'historia', 'numero', 'color', 'sonido', 'silencio',
  // Common adjectives (no accent)
  'grande', 'pequeno', 'bueno', 'malo', 'nuevo', 'viejo', 'alto', 'bajo',
  'primero', 'segundo', 'tercero', 'ultimo', 'mejor', 'peor', 'mayor', 'menor',
  'blanco', 'negro', 'rojo', 'azul', 'verde', 'amarillo', 'largo', 'corto',
  'fuerte', 'debil', 'rapido', 'lento', 'facil', 'dificil', 'caliente', 'frio',
  'joven', 'feliz', 'triste', 'enorme', 'vacio', 'lleno',
]);

// English-only suffixes (NOT also valid in Spanish)
const EN_SUFFIXES = /(?:tion|sion|ment|ness|ity|ous|ive|able|ible|ful|less|ize|ise|hood|ship|dom|ism|ally)$/;

export function detectLanguage(word: string): Language {
  const w = word.toLowerCase().trim();

  // 1. Spanish-specific diacritics
  if (/[ñü]/.test(w)) return 'es';
  if (w.length >= 4 && /[áéíóú]/.test(w)) return 'es';

  // 2. English function/content words (very high precision for EN)
  if (COMMON_EN_WORDS.has(w)) return 'en';

  // 3. Spanish function/content words
  if (COMMON_ES_WORDS.has(w)) return 'es';

  // 4. Suffixes (English-only suffixes flip to English)
  if (EN_SUFFIXES.test(w)) return 'en';
  if (/(?:ación|ión|idad|mente|ado|ido|ando|iendo)$/.test(w)) return 'es';

  // 5. Length-based default:
  //    - Short words (≤4 chars) without clear markers → Spanish (articles, common short words)
  //    - Longer words (5+ chars) without clear markers and not in ES list → English
  //      (jargon, compound words, technical terms skew English; Spanish long words
  //      without accents are rare and the user is more likely reading English content)
  if (w.length <= 4) return 'es';
  return 'en';
}
