/**
 * time-utils.test.ts - Tests for timestamp utilities
 * 
 * Unit tests and property-based tests for:
 * - formatTimestamp: Seconds to timestamp format (fixed-point)
 * - parseTimestamp: Timestamp string to seconds
 * - generateSrtContent: Subtitles to SRT string (for export)
 */

import * as fc from 'fast-check';
import { formatTimestamp, parseTimestamp, generateSrtContent } from './time-utils';
import { SubtitleLine } from '@/types/subtitle';

// ============================================================================
// formatTimestamp Tests
// ============================================================================

describe('formatTimestamp', () => {
  describe('unit tests', () => {
    test('formats zero correctly', () => {
      expect(formatTimestamp(0)).toBe('00:00:00,000');
    });

    test('formats whole seconds', () => {
      expect(formatTimestamp(1)).toBe('00:00:01,000');
      expect(formatTimestamp(59)).toBe('00:00:59,000');
      expect(formatTimestamp(60)).toBe('00:01:00,000');
      expect(formatTimestamp(3600)).toBe('01:00:00,000');
    });

    test('formats fractional seconds (milliseconds) with fixed-point precision', () => {
      expect(formatTimestamp(1.5)).toBe('00:00:01,500');
      expect(formatTimestamp(1.001)).toBe('00:00:01,001'); // Fixed-point: now precise!
      expect(formatTimestamp(1.999)).toBe('00:00:01,999');
    });

    test('handles very small fractions', () => {
      expect(formatTimestamp(0.001)).toBe('00:00:00,001');
      expect(formatTimestamp(0.0001)).toBe('00:00:00,000'); // Below ms, rounds to 0
    });

    test('handles large values beyond 24h', () => {
      // Fixed-point handles arbitrarily large values
      expect(formatTimestamp(86400)).toBe('24:00:00,000'); // Exactly 24 hours
      expect(formatTimestamp(90061.5)).toBe('25:01:01,500');
    });

    test('handles negative values', () => {
      // Rounds to 0 for negative
      expect(formatTimestamp(-1)).toBe('00:00:00,000');
    });
  });

  describe('property tests', () => {
    test('output format is always HH:MM:SS,mmm', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 360000, noNaN: true }), (seconds) => {
          const result = formatTimestamp(seconds);
          return /^\d{2,}:\d{2}:\d{2},\d{3}$/.test(result);
        })
      );
    });

    test('milliseconds are always in range 0-999', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 86399, noNaN: true }), (seconds) => {
          const result = formatTimestamp(seconds);
          const ms = parseInt(result.split(',')[1]);
          return ms >= 0 && ms <= 999;
        })
      );
    });

    test('minutes and seconds are always in range 0-59', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 86399, noNaN: true }), (seconds) => {
          const result = formatTimestamp(seconds);
          const [time] = result.split(',');
          const [, mm, ss] = time.split(':').map(Number);
          return mm >= 0 && mm <= 59 && ss >= 0 && ss <= 59;
        })
      );
    });
  });
});

// ============================================================================
// parseTimestamp Tests
// ============================================================================

describe('parseTimestamp', () => {
  describe('unit tests', () => {
    test('parses standard SRT format', () => {
      expect(parseTimestamp('00:00:01,000')).toBe(1);
      expect(parseTimestamp('00:01:00,000')).toBe(60);
      expect(parseTimestamp('01:00:00,000')).toBe(3600);
    });

    test('parses milliseconds', () => {
      expect(parseTimestamp('00:00:01,500')).toBe(1.5);
      expect(parseTimestamp('00:00:00,001')).toBe(0.001);
    });

    test('parses dot separator (VTT format)', () => {
      expect(parseTimestamp('00:00:01.500')).toBe(1.5);
    });

    test('parses MM:SS,mmm format (no hours)', () => {
      expect(parseTimestamp('01:30,500')).toBe(90.5);
    });

    test('returns 0 for empty string', () => {
      expect(parseTimestamp('')).toBe(0);
    });

    test('returns 0 for invalid format', () => {
      expect(parseTimestamp('invalid')).toBe(0);
      expect(parseTimestamp('1:2')).toBe(0);
    });
  });

  describe('property tests - roundtrip', () => {
    test('format then parse returns approximately original value', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 86399, noNaN: true }), (seconds) => {
          const formatted = formatTimestamp(seconds);
          const parsed = parseTimestamp(formatted);
          // Allow 1ms tolerance due to rounding
          return Math.abs(parsed - seconds) < 0.002;
        })
      );
    });
  });
});

// ============================================================================
// generateSrtContent Tests
// ============================================================================

describe('generateSrtContent', () => {
  const createSubtitle = (overrides: Partial<SubtitleLine> = {}): SubtitleLine => ({
    id: 'test-1',
    startTime: 0,
    endTime: 5,
    text: 'Test subtitle',
    ...overrides,
  });

  describe('unit tests', () => {
    test('generates correct SRT format for primary', () => {
      const subtitles = [
        createSubtitle({ startTime: 0, endTime: 5, text: 'First' }),
        createSubtitle({ id: '2', startTime: 5, endTime: 10, text: 'Second' }),
      ];
      const result = generateSrtContent(subtitles, 'primary');
      
      expect(result).toContain('1\n00:00:00,000 --> 00:00:05,000\nFirst');
      expect(result).toContain('2\n00:00:05,000 --> 00:00:10,000\nSecond');
    });

    test('generates correct SRT format for secondary', () => {
      const subtitles = [
        createSubtitle({ secondaryText: 'Secondary 1' }),
        createSubtitle({ id: '2', startTime: 5, endTime: 10, secondaryText: 'Secondary 2' }),
      ];
      const result = generateSrtContent(subtitles, 'secondary');
      
      expect(result).toContain('Secondary 1');
      expect(result).toContain('Secondary 2');
    });

    test('filters out subtitles without requested text type', () => {
      const subtitles = [
        createSubtitle({ text: 'Has primary', secondaryText: undefined }),
      ];
      
      const primary = generateSrtContent(subtitles, 'primary');
      const secondary = generateSrtContent(subtitles, 'secondary');
      
      expect(primary).toContain('Has primary');
      expect(secondary).toBe('');
    });

    test('handles empty subtitle list', () => {
      expect(generateSrtContent([], 'primary')).toBe('');
    });

    test('handles multiline text', () => {
      const subtitles = [
        createSubtitle({ text: 'Line 1\nLine 2' }),
      ];
      const result = generateSrtContent(subtitles, 'primary');
      expect(result).toContain('Line 1\nLine 2');
    });
  });
});
