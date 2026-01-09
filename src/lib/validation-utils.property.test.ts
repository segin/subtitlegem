import * as fc from 'fast-check';
import { validateSubtitleArraySize, validateSubtitleTextSize, MAX_SUBTITLES } from './validation-utils';

describe('validation-utils properties', () => {
  
  test('validateSubtitleArraySize accepts arrays <= MAX_SUBTITLES', () => {
    // We limit max length in Arbitrary to be reasonable for test speed, 
    // effectively testing the "happy path" fuzzing
    fc.assert(
      fc.property(fc.array(fc.anything(), { maxLength: 100 }), (arr) => {
        expect(() => validateSubtitleArraySize(arr)).not.toThrow();
      })
    );
  });

  // We manually test the failure case because fuzzing 10001 items is slow
  test('validateSubtitleArraySize throws for array > MAX_SUBTITLES', () => {
     // Mock array with length property to simulate huge array without allocating
     const hugeArray = { length: MAX_SUBTITLES + 1, [Symbol.iterator]: function*() {} } as any; 
     // IsArray check might fail on fake object. 
     // The utility checks `Array.isArray`.
     // So we must use real array. We can use `new Array(MAX_SUBTITLES + 1)` which is sparse/fast?
     const sparseArray = new Array(MAX_SUBTITLES + 1);
     expect(() => validateSubtitleArraySize(sparseArray)).toThrow();
  });

  test('validateSubtitleTextSize accepts valid small inputs', () => {
    fc.assert(
      fc.property(fc.array(fc.record({
        text: fc.string({maxLength: 100}),
        // Fix: fc.option returns T | null, but we need T | undefined. 
        // Mapping null to undefined explicitly.
        secondaryText: fc.option(fc.string({maxLength: 100})).map(s => s === null ? undefined : s)
      }), { maxLength: 50 }), (subs) => {
        expect(() => validateSubtitleTextSize(subs)).not.toThrow();
      })
    );
  });
});
