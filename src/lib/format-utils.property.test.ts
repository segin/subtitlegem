import * as fc from 'fast-check';
import { formatBytes } from './format-utils';

describe('format-utils properties', () => {

  test('formatBytes produces valid strings', () => {
    fc.assert(
      fc.property(fc.double({min: 0, max: Number.MAX_SAFE_INTEGER, noNaN: true}), (bytes) => {
        const s = formatBytes(bytes);
        expect(typeof s).toBe('string');
        const parts = s.split(' ');
        expect(parts.length).toBe(2);
        // Value part should be number
        expect(!isNaN(parseFloat(parts[0]))).toBe(true);
        // Unit part should be one of B, KB, MB...
        expect(['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']).toContain(parts[1]);
      })
    );
  });

  test('formatBytes is monotonically increasing inside unit ranges', () => {
    // Check that inside a single unit (e.g. KB), larger bytes => larger value number
    fc.assert(
      fc.property(fc.double({min: 1024, max: 1024 * 1024 - 1, noNaN: true}), (bytes) => {
         const res = formatBytes(bytes); // Should be KB
         const resNext = formatBytes(bytes + 1); // Should be KB
         
         const unit = res.split(' ')[1];
         const unitNext = resNext.split(' ')[1];
         // Only enforce monotonicity if units are the same (1023 KB vs 1.00 MB is hard to compare by plain float)
         if (unit === unitNext) {
            const val = parseFloat(res.split(' ')[0]);
            const valNext = parseFloat(resNext.split(' ')[0]);
            expect(valNext).toBeGreaterThanOrEqual(val);
         }
      })
    );
  });
});
