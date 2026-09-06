import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../detector.js';

describe('detectLanguage', () => {
  describe('Spanish indicators', () => {
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
      // 'a' is the Spanish preposition — correctly classified as ES via the common-words list
      expect(detectLanguage('a')).toBe('es');
      expect(detectLanguage('y')).toBe('es');
    });

    it('detects common Spanish function words', () => {
      expect(detectLanguage('el')).toBe('es');
      expect(detectLanguage('la')).toBe('es');
      expect(detectLanguage('casa')).toBe('es');
      expect(detectLanguage('tiempo')).toBe('es');
      expect(detectLanguage('porque')).toBe('es');
    });

    it('detects Spanish suffixes', () => {
      expect(detectLanguage('nación')).toBe('es');
      expect(detectLanguage('actividad')).toBe('es');
      expect(detectLanguage('rápidamente')).toBe('es');
      expect(detectLanguage('terminado')).toBe('es');
      expect(detectLanguage('comiendo')).toBe('es');
    });
  });

  describe('English default', () => {
    it('defaults to English for unknown words', () => {
      expect(detectLanguage('serendipity')).toBe('en');
      expect(detectLanguage('algorithm')).toBe('en');
      expect(detectLanguage('philosophy')).toBe('en');
      expect(detectLanguage('beautiful')).toBe('en');
    });
  });

  describe('edge cases', () => {
    it('is case-insensitive', () => {
      expect(detectLanguage('NIÑO')).toBe('es');
      expect(detectLanguage('Niño')).toBe('es');
      expect(detectLanguage('SERENDIPITY')).toBe('en');
    });

    it('trims whitespace', () => {
      expect(detectLanguage('  casa  ')).toBe('es');
      expect(detectLanguage('  hello  ')).toBe('en');
    });
  });
});
