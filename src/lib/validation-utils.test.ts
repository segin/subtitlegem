/**
 * validation-utils.test.ts - Tests for input validation utilities
 */

import { 
  validateSubtitleArraySize, 
  validateSubtitleTextSize, 
  validateSubtitles,
  MAX_SUBTITLES,
  MAX_TOTAL_TEXT_LENGTH 
} from './validation-utils';

describe('validation-utils', () => {
  describe('validateSubtitleArraySize', () => {
    describe('unit tests', () => {
      it('should accept valid arrays', () => {
        expect(() => validateSubtitleArraySize([])).not.toThrow();
        expect(() => validateSubtitleArraySize([{ text: 'hello' }])).not.toThrow();
        expect(() => validateSubtitleArraySize(new Array(1000).fill({ text: 'test' }))).not.toThrow();
      });

      it('should reject non-arrays', () => {
        expect(() => validateSubtitleArraySize('not an array' as any)).toThrow('must be an array');
        expect(() => validateSubtitleArraySize({ length: 5 } as any)).toThrow('must be an array');
      });

      it('should reject oversized arrays', () => {
        const oversized = new Array(MAX_SUBTITLES + 1).fill({ text: 'test' });
        expect(() => validateSubtitleArraySize(oversized)).toThrow('Too many subtitles');
        expect(() => validateSubtitleArraySize(oversized)).toThrow(`${MAX_SUBTITLES + 1}`);
      });

      it('should accept exactly MAX_SUBTITLES', () => {
        const maxSized = new Array(MAX_SUBTITLES).fill({ text: 'test' });
        expect(() => validateSubtitleArraySize(maxSized)).not.toThrow();
      });
    });

    describe('boundary tests', () => {
      it('should handle boundary values correctly', () => {
        expect(() => validateSubtitleArraySize(new Array(MAX_SUBTITLES - 1))).not.toThrow();
        expect(() => validateSubtitleArraySize(new Array(MAX_SUBTITLES))).not.toThrow();
        expect(() => validateSubtitleArraySize(new Array(MAX_SUBTITLES + 1))).toThrow();
      });
    });
  });

  describe('validateSubtitleTextSize', () => {
    it('should accept normal text sizes', () => {
      expect(() => validateSubtitleTextSize([
        { text: 'Hello world' },
        { text: 'Another line', secondaryText: '另一行' }
      ])).not.toThrow();
    });

    it('should reject oversized text', () => {
      const hugeText = 'a'.repeat(MAX_TOTAL_TEXT_LENGTH + 1);
      expect(() => validateSubtitleTextSize([{ text: hugeText }])).toThrow('too large');
    });

    it('should accumulate text across multiple subtitles', () => {
      const mediumText = 'a'.repeat(MAX_TOTAL_TEXT_LENGTH / 2 + 1);
      expect(() => validateSubtitleTextSize([
        { text: mediumText },
        { text: mediumText }
      ])).toThrow('too large');
    });
  });

  describe('validateSubtitles (combined)', () => {
    it('should validate both array size and text size', () => {
      // Valid
      expect(() => validateSubtitles([{ text: 'hello' }])).not.toThrow();
      
      // Invalid type
      expect(() => validateSubtitles('not array')).toThrow('must be an array');
      
      // Too many
      expect(() => validateSubtitles(new Array(MAX_SUBTITLES + 1).fill({}))).toThrow();
    });
  });

  describe('constants', () => {
    it('should export correct limits', () => {
      expect(MAX_SUBTITLES).toBe(10000);
      expect(MAX_TOTAL_TEXT_LENGTH).toBe(1_000_000);
    });
  });
});
