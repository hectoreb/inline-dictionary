import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../detector.js';

describe('detectLanguage', () => {
  describe('Spanish indicators (high precision)', () => {
    it('detects ñ as Spanish', () => {
      expect(detectLanguage('niño')).toBe('es');
      expect(detectLanguage('mañana')).toBe('es');
      expect(detectLanguage('señor')).toBe('es');
    });

    it('detects ü as Spanish', () => {
      expect(detectLanguage('güenza')).toBe('es');
      expect(detectLanguage('bilingüe')).toBe('es');
    });

    it('detects a single acute accent (4+ chars) as Spanish', () => {
      expect(detectLanguage('práctica')).toBe('es');
      expect(detectLanguage('teléfono')).toBe('es');
      expect(detectLanguage('música')).toBe('es');
    });

    it('still classifies very common 1-letter Spanish words as Spanish', () => {
      // 'a' is a Spanish preposition (and "y" is a Spanish conjunction)
      expect(detectLanguage('a')).toBe('es');
      expect(detectLanguage('y')).toBe('es');
    });
  });

  describe('Spanish content words (previously misclassified as English)', () => {
    // These are the critical regression cases: common Spanish words without diacritics
    // that the previous default-to-English heuristic misclassified.
    it('detects common Spanish nouns as Spanish', () => {
      expect(detectLanguage('perro')).toBe('es');
      expect(detectLanguage('casa')).toBe('es');
      expect(detectLanguage('tiempo')).toBe('es');
      expect(detectLanguage('agua')).toBe('es');
      expect(detectLanguage('mundo')).toBe('es');
      expect(detectLanguage('noche')).toBe('es');
      expect(detectLanguage('libro')).toBe('es');
      expect(detectLanguage('gente')).toBe('es');
      expect(detectLanguage('familia')).toBe('es');
      expect(detectLanguage('amigo')).toBe('es');
    });

    it('detects common Spanish verbs as Spanish', () => {
      expect(detectLanguage('hacer')).toBe('es');
      expect(detectLanguage('tener')).toBe('es');
      expect(detectLanguage('estar')).toBe('es');
      expect(detectLanguage('poder')).toBe('es');
      expect(detectLanguage('querer')).toBe('es');
      expect(detectLanguage('decir')).toBe('es');
    });
  });

  describe('English indicators', () => {
    it('detects common English function words as English', () => {
      expect(detectLanguage('the')).toBe('en');
      expect(detectLanguage('and')).toBe('en');
      expect(detectLanguage('you')).toBe('en');
      expect(detectLanguage('that')).toBe('en');
      expect(detectLanguage('this')).toBe('en');
      expect(detectLanguage('have')).toBe('en');
      expect(detectLanguage('would')).toBe('en');
    });

    it('detects English-only suffixes as English', () => {
      expect(detectLanguage('function')).toBe('en');
      expect(detectLanguage('algorithm')).toBe('en');
      expect(detectLanguage('happiness')).toBe('en');
      expect(detectLanguage('movement')).toBe('en');
      expect(detectLanguage('philosophy')).toBe('en');
    });

    it('detects common English content words', () => {
      expect(detectLanguage('time')).toBe('en');
      expect(detectLanguage('world')).toBe('en');
      expect(detectLanguage('book')).toBe('en');
      expect(detectLanguage('water')).toBe('en');
    });
  });

  describe('Spanish suffixes (Spanish-specific only)', () => {
    it('detects Spanish suffixes as Spanish', () => {
      expect(detectLanguage('nación')).toBe('es');
      expect(detectLanguage('actividad')).toBe('es');
      expect(detectLanguage('rápidamente')).toBe('es');
      expect(detectLanguage('terminado')).toBe('es');
      expect(detectLanguage('comiendo')).toBe('es');
    });
  });

  describe('Edge cases', () => {
    it('is case-insensitive', () => {
      expect(detectLanguage('NIÑO')).toBe('es');
      expect(detectLanguage('Niño')).toBe('es');
      expect(detectLanguage('THE')).toBe('en');
    });

    it('trims whitespace', () => {
      expect(detectLanguage('  casa  ')).toBe('es');
      expect(detectLanguage('  hello  ')).toBe('en');
    });

    it('defaults short words (≤4 chars) to Spanish, longer ones to English', () => {
      // Short words without markers: likely Spanish (articles, common nouns)
      expect(detectLanguage('gato')).toBe('es');
      expect(detectLanguage('luna')).toBe('es');
      // Long words without markers and not in ES list: more likely English jargon
      expect(detectLanguage('xyzzy')).toBe('en');
    });
  });
});
