import * as fc from 'fast-check';
import { formatTimestamp, parseTimestamp } from './time-utils';

describe('time-utils properties', () => {
  
  test('formatTimestamp -> parseTimestamp round trip roughly preserves value', () => {
    // Round to nearest millisecond because formatTimestamp drops micro/nanoseconds
    fc.assert(
      fc.property(fc.double({ min: 0, max: 360000, noNaN: true }), (seconds) => {
        // Implementation uses Math.round, so we must too
        const expected = Math.round(seconds * 1000) / 1000;
        const formatted = formatTimestamp(seconds);
        const parsed = parseTimestamp(formatted);
        
        expect(parsed).toBeCloseTo(expected, 3); // 3 decimal places (milliseconds)
      })
    );
  });

  test('formatTimestamp never throws on non-negative numbers', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: Number.MAX_SAFE_INTEGER, noNaN: true }), (seconds) => {
        const s = formatTimestamp(seconds);
        expect(typeof s).toBe('string');
        expect(s).toMatch(/^\d+:\d{2}:\d{2},\d{3}$/);
      })
    );
  });

  test('parseTimestamp handles arbitrary strings without crashing', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = parseTimestamp(s);
        expect(typeof result).toBe('number');
        // NaN is acceptable for garbage input
      })
    );
  });
});
