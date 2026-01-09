import * as fc from 'fast-check';
import { mergeSubtitles } from './subtitle-utils';
import { SubtitleLine } from '@/types/subtitle';

describe('subtitle-utils fuzzing', () => {
  
  // Generator for SubtitleLine
  const subtitleArb = fc.record({
    id: fc.uuid(),
    startTime: fc.double({min: 0, max: 10000, noNaN: true}),
    duration: fc.double({min: 0.1, max: 100, noNaN: true}), // Generate duration to ensure endTime > startTime
    text: fc.string(),
    secondaryText: fc.option(fc.string()),
    primaryColor: fc.option(fc.nat(0xFFFFFF).map(n => '#' + n.toString(16).padStart(6, '0'))),
    secondaryColor: fc.option(fc.nat(0xFFFFFF).map(n => '#' + n.toString(16).padStart(6, '0')))
  }).map(s => ({
    ...s,
    endTime: s.startTime + s.duration,
    duration: undefined // Remove helper prop
  })) as any as fc.Arbitrary<SubtitleLine>; 
  // Cast because map type inference is tricky with interface match

  test('mergeSubtitles never crashes and maintains invariants', () => {
    fc.assert(
      fc.property(
        fc.array(subtitleArb, { minLength: 2, maxLength: 50 }),
        (subtitles) => {
          const merged = mergeSubtitles(subtitles);
          
          // Should always return a subtitle (since minLength is 2)
          expect(merged).not.toBeNull();
          
          if (merged) {
             // Invariants
             expect(merged.startTime).toBeLessThan(merged.endTime);
             
             // Time containment
             const minStart = Math.min(...subtitles.map(s => s.startTime));
             const maxEnd = Math.max(...subtitles.map(s => s.endTime));
             
             expect(merged.startTime).toBeCloseTo(minStart);
             expect(merged.endTime).toBeCloseTo(maxEnd);
             
             // ID preservation (implementation picks *first sorted by time*)
             // Verify ID exists in original set
             expect(subtitles.map(s => s.id)).toContain(merged.id);
             
             // Text containment
             // The merged text should contain content from inputs (unless empty)
             const nonEmptyTextInputs = subtitles.filter(s => s.text && s.text.trim().length > 0);
             if (nonEmptyTextInputs.length > 0) {
                expect(merged.text.length).toBeGreaterThan(0);
             }
          }
        }
      )
    );
  });
});
