// Shared types for Inline Dictionary

export type Language = 'es' | 'en';
export type Source = 'wikcionario' | 'merriam-webster';
export type DefaultLanguage = 'auto' | Language;

export interface Definition {
  partOfSpeech: string;
  text: string;
  examples?: string[];
}

export interface LookupResult {
  word: string;
  language: Language;
  source: Source;
  definitions: Definition[];
  etymology?: string;
  pronunciation?: string;
}

export type ErrorCode =
  | 'OFFLINE'
  | 'MW_KEY_MISSING'
  | 'MW_KEY_INVALID'
  | 'MW_RATE_LIMIT'
  | 'WIKCIONARIO_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export interface LookupError {
  ok: false;
  error: ErrorCode;
  message: string;
}

export interface LookupSuccess {
  ok: true;
  result: LookupResult;
}

export type LookupResponse = LookupSuccess | LookupError;

export interface LookupRequest {
  type: 'LOOKUP_WORD';
  word: string;
  language?: Language; // override; if not provided, detector decides
}
