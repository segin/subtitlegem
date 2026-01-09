import * as fc from 'fast-check';
import { estimateH264Size, formatBytes } from './video-estimate-utils';

describe('video-estimate-utils properties', () => {
  
  test('formatBytes always returns string with unit', () => {
    fc.assert(
      fc.property(fc.maxSafeInteger(), (bytes) => {
        const result = formatBytes(Math.abs(bytes)); // Only test positive
        expect(typeof result).toBe('string');
        expect(result).toMatch(/Bytes|KB|MB|GB|TB|PB/);
      })
    );
  });

  test('estimateH264Size strictly increasing with duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3600 }), // Duration 1s to 1h
        fc.integer({ min: 2000, max: 5000 }), // Duration 2 (higher)
        fc.integer({ min: 100, max: 8000 }), // Width
        fc.integer({ min: 100, max: 8000 }), // Height
        fc.integer({ min: 0, max: 51 }),   // CRF
        (d1, d2_offset, w, h, crf) => {
          const params1 = { duration: d1, width: w, height: h, crf, audioBitrateKbps: 0 };
          const params2 = { duration: d1 + d2_offset, width: w, height: h, crf, audioBitrateKbps: 0 };
          
          expect(estimateH264Size(params2)).toBeGreaterThan(estimateH264Size(params1));
        }
      )
    );
  });

  test('estimateH264Size strictly increasing with pixel count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 600 }),
        fc.integer({ min: 100, max: 2000 }), // W1
        fc.integer({ min: 100, max: 2000 }), // H1
        fc.integer({ min: 10, max: 1000 }), // Delta W
        fc.integer({ min: 0, max: 51 }),
        (duration, w1, h1, deltaW, crf) => {
          const params1 = { duration, width: w1, height: h1, crf, audioBitrateKbps: 0 };
          const params2 = { duration, width: w1 + deltaW, height: h1, crf, audioBitrateKbps: 0 }; // Higher resolution
          
          expect(estimateH264Size(params2)).toBeGreaterThan(estimateH264Size(params1));
        }
      )
    );
  });

  test('estimateH264Size strictly decreasing with higher CRF', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 600 }),
        fc.integer({ min: 100, max: 4000 }), 
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 0, max: 45 }), // CRF 1
        fc.integer({ min: 1, max: 5 }), // Delta CRF
        (duration, w, h, crf1, deltaCrf) => {
          const params1 = { duration, width: w, height: h, crf: crf1, audioBitrateKbps: 0 };
          const params2 = { duration, width: w, height: h, crf: crf1 + deltaCrf, audioBitrateKbps: 0 }; // Higher CRF = Lower quality/size
          
          expect(estimateH264Size(params2)).toBeLessThan(estimateH264Size(params1));
        }
      )
    );
  });
});
