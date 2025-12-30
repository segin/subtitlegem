/**
 * srt-utils.test.ts - Comprehensive tests for SRT subtitle utilities
 * 
 * Unit tests and property-based tests for:
 * - formatSRTTime: Seconds to SRT timestamp format (fixed-point)
 * - parseSRTTime: SRT timestamp to seconds
 * - stringifySRT: Subtitles to SRT string
 * - parseSRT: SRT string to subtitles
 */

import * as fc from 'fast-check';
import { formatSRTTime, parseSRTTime, stringifySRT, parseSRT } from './srt-utils';
import { SubtitleLine } from '@/types/subtitle';

// ============================================================================
// formatSRTTime Tests
// ============================================================================

describe('formatSRTTime', () => {
  describe('unit tests', () => {
    test('formats zero correctly', () => {
      expect(formatSRTTime(0)).toBe('00:00:00,000');
    });

    test('formats whole seconds', () => {
      expect(formatSRTTime(1)).toBe('00:00:01,000');
      expect(formatSRTTime(59)).toBe('00:00:59,000');
      expect(formatSRTTime(60)).toBe('00:01:00,000');
      expect(formatSRTTime(3600)).toBe('01:00:00,000');
    });

    test('formats fractional seconds (milliseconds) with fixed-point precision', () => {
      expect(formatSRTTime(1.5)).toBe('00:00:01,500');
      expect(formatSRTTime(1.001)).toBe('00:00:01,001'); // Fixed-point: now precise!
      expect(formatSRTTime(1.999)).toBe('00:00:01,999');
    });

    test('handles very small fractions', () => {
      expect(formatSRTTime(0.001)).toBe('00:00:00,001');
      expect(formatSRTTime(0.0001)).toBe('00:00:00,000'); // Below ms, rounds to 0
    });

    test('handles large values beyond 24h', () => {
      // Fixed-point handles arbitrarily large values
      expect(formatSRTTime(86400)).toBe('24:00:00,000'); // Exactly 24 hours
      expect(formatSRTTime(90061.5)).toBe('25:01:01,500');
    });

    test('handles negative values', () => {
      // Rounds to 0 for negative
      expect(formatSRTTime(-1)).toBe('00:00:00,000');
    });
  });

  describe('property tests', () => {
    test('output format is always HH:MM:SS,mmm', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 360000, noNaN: true }), (seconds) => {
          const result = formatSRTTime(seconds);
          return /^\d{2,}:\d{2}:\d{2},\d{3}$/.test(result);
        })
      );
    });

    test('milliseconds are always in range 0-999', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 86399, noNaN: true }), (seconds) => {
          const result = formatSRTTime(seconds);
          const ms = parseInt(result.split(',')[1]);
          return ms >= 0 && ms <= 999;
        })
      );
    });

    test('minutes and seconds are always in range 0-59', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 86399, noNaN: true }), (seconds) => {
          const result = formatSRTTime(seconds);
          const [time] = result.split(',');
          const [, mm, ss] = time.split(':').map(Number);
          return mm >= 0 && mm <= 59 && ss >= 0 && ss <= 59;
        })
      );
    });
  });
});

// ============================================================================
// parseSRTTime Tests
// ============================================================================

describe('parseSRTTime', () => {
  describe('unit tests', () => {
    test('parses standard SRT format', () => {
      expect(parseSRTTime('00:00:01,000')).toBe(1);
      expect(parseSRTTime('00:01:00,000')).toBe(60);
      expect(parseSRTTime('01:00:00,000')).toBe(3600);
    });

    test('parses milliseconds', () => {
      expect(parseSRTTime('00:00:01,500')).toBe(1.5);
      expect(parseSRTTime('00:00:00,001')).toBe(0.001);
    });

    test('parses dot separator (VTT format)', () => {
      expect(parseSRTTime('00:00:01.500')).toBe(1.5);
    });

    test('parses MM:SS,mmm format (no hours)', () => {
      expect(parseSRTTime('01:30,500')).toBe(90.5);
    });

    test('returns 0 for empty string', () => {
      expect(parseSRTTime('')).toBe(0);
    });

    test('returns 0 for invalid format', () => {
      expect(parseSRTTime('invalid')).toBe(0);
      expect(parseSRTTime('1:2')).toBe(0);
    });
  });

  describe('property tests - roundtrip', () => {
    test('format then parse returns approximately original value', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 86399, noNaN: true }), (seconds) => {
          const formatted = formatSRTTime(seconds);
          const parsed = parseSRTTime(formatted);
          // Allow 1ms tolerance due to rounding
          return Math.abs(parsed - seconds) < 0.002;
        })
      );
    });
  });
});

// ============================================================================
// stringifySRT Tests
// ============================================================================

describe('stringifySRT', () => {
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
      const result = stringifySRT(subtitles, 'primary');
      
      expect(result).toContain('1\n00:00:00,000 --> 00:00:05,000\nFirst');
      expect(result).toContain('2\n00:00:05,000 --> 00:00:10,000\nSecond');
    });

    test('generates correct SRT format for secondary', () => {
      const subtitles = [
        createSubtitle({ secondaryText: 'Secondary 1' }),
        createSubtitle({ id: '2', startTime: 5, endTime: 10, secondaryText: 'Secondary 2' }),
      ];
      const result = stringifySRT(subtitles, 'secondary');
      
      expect(result).toContain('Secondary 1');
      expect(result).toContain('Secondary 2');
    });

    test('filters out subtitles without requested text type', () => {
      const subtitles = [
        createSubtitle({ text: 'Has primary', secondaryText: undefined }),
      ];
      
      const primary = stringifySRT(subtitles, 'primary');
      const secondary = stringifySRT(subtitles, 'secondary');
      
      expect(primary).toContain('Has primary');
      expect(secondary).toBe('');
    });

    test('handles empty subtitle list', () => {
      expect(stringifySRT([], 'primary')).toBe('');
    });

    test('handles multiline text', () => {
      const subtitles = [
        createSubtitle({ text: 'Line 1\nLine 2' }),
      ];
      const result = stringifySRT(subtitles, 'primary');
      expect(result).toContain('Line 1\nLine 2');
    });
  });
});

// ============================================================================
// parseSRT Tests
// ============================================================================

describe('parseSRT', () => {
  describe('unit tests', () => {
    test('parses standard SRT content', () => {
      const srt = `1
00:00:00,000 --> 00:00:05,000
First subtitle

2
00:00:05,000 --> 00:00:10,000
Second subtitle`;
      
      const result = parseSRT(srt);
      
      expect(result).toHaveLength(2);
      expect(result[0].startTime).toBe(0);
      expect(result[0].endTime).toBe(5);
      expect(result[0].text).toBe('First subtitle');
      expect(result[1].startTime).toBe(5);
      expect(result[1].endTime).toBe(10);
    });

    test('handles Windows line endings', () => {
      const srt = '1\r\n00:00:00,000 --> 00:00:05,000\r\nTest';
      const result = parseSRT(srt);
      
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Test');
    });

    test('handles multiline subtitle text', () => {
      const srt = `1
00:00:00,000 --> 00:00:05,000
Line 1
Line 2
Line 3`;
      
      const result = parseSRT(srt);
      
      expect(result[0].text).toBe('Line 1\nLine 2\nLine 3');
    });

    test('returns empty array for invalid content', () => {
      expect(parseSRT('')).toHaveLength(0);
      expect(parseSRT('not valid srt')).toHaveLength(0);
    });

    test('skips malformed entries', () => {
      const srt = `1
00:00:00,000 --> 00:00:05,000
Valid

invalid entry here

2
00:00:05,000 --> 00:00:10,000
Also valid`;
      
      const result = parseSRT(srt);
      expect(result).toHaveLength(2);
    });
  });

  describe('property tests - roundtrip', () => {
    test('stringify then parse preserves subtitle timing', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            id: fc.uuid(),
            startTime: fc.float({ min: 0, max: 3600, noNaN: true }),
            endTime: fc.float({ min: 0, max: 3600, noNaN: true }),
            // Use simple alphanumeric to avoid parsing edge cases
            text: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9 ]+$/i.test(s) && s.trim().length > 0),
          }), { minLength: 1, maxLength: 5 }),
          (subs) => {
            const subtitles = subs.map(s => ({ 
              ...s, 
              endTime: Math.max(s.startTime + 0.1, s.endTime) 
            })) as SubtitleLine[];
            
            const srtString = stringifySRT(subtitles, 'primary');
            const parsed = parseSRT(srtString);
            
            // Check count matches
            if (parsed.length !== subtitles.length) return false;
            
            // Check times are approximately equal (within 1ms)
            for (let i = 0; i < parsed.length; i++) {
              if (Math.abs((parsed[i].startTime || 0) - subtitles[i].startTime) > 0.002) return false;
              if (Math.abs((parsed[i].endTime || 0) - subtitles[i].endTime) > 0.002) return false;
            }
            
            return true;
          }
        )
      );
    });
  });
});
