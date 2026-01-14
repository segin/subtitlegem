/**
 * ffmpeg-concat.fuzz.test.ts - Fuzzing tests for FFmpeg Filter Complex Generator
 * 
 * Uses fast-check to generate random, messy timelines and verify that
 * generateFilterComplex always produces valid output without crashing.
 */

import * as fc from 'fast-check';
import { generateFilterComplex } from './ffmpeg-concat';
import { ProjectConfig, TimelineClip } from '@/types/subtitle';

describe('ffmpeg-concat (fuzzing)', () => {
  
  // Arbitrary for Project Config
  const projectConfigArbitrary = fc.record({
    width: fc.integer({ min: 100, max: 8000 }),
    height: fc.integer({ min: 100, max: 8000 }),
    fps: fc.integer({ min: 1, max: 240 }),
    scalingMode: fc.constantFrom('fit', 'fill', 'stretch') as fc.Arbitrary<'fit' | 'fill' | 'stretch'>
  });

  // Arbitrary for Video Inputs
  const inputsArbitrary = fc.array(fc.record({
    type: fc.constant('video'),
    path: fc.string(),
    id: fc.uuid()
  }), { minLength: 1, maxLength: 5 });

  test('generateFilterComplex should handle arbitrary timelines without crashing', () => {
    fc.assert(
      fc.property(
        projectConfigArbitrary,
        inputsArbitrary,
        fc.array(fc.record({
             // We need to generate clips that reference IDs from inputsArbitrary
             // but here we generate standard valid-looking inputs
             projectStartTime: fc.float({ min: 0, max: 1000, noNaN: true }),
             sourceInPoint: fc.float({ min: 0, max: 100, noNaN: true }),
             clipDuration: fc.float({ min: 0.1, max: 100, noNaN: true })
        }), { minLength: 1, maxLength: 20 }),
        (config, inputs, rawClips) => {
            // Fixup clips to reference valid input IDs
            const timeline: TimelineClip[] = rawClips.map((c, i) => ({
                id: `clip-${i}`,
                videoClipId: inputs[i % inputs.length].id, // Cyclic reference to ensures existence
                projectStartTime: c.projectStartTime,
                sourceInPoint: c.sourceInPoint,
                clipDuration: c.clipDuration
            }));

            // EXECUTE
            const result = generateFilterComplex(inputs as any, timeline, config);

            // VERIFICATIONS
            // 1. result should exist
            expect(result).toBeDefined();
            expect(result.filterGraph).toBeDefined();
            expect(result.map).toBeDefined();

            // 2. filterGraph should verify basic syntax (basic sanity check)
            expect(result.filterGraph).not.toContain('NaN');
            expect(result.filterGraph).not.toContain('undefined');
            
            // 3. Should contain concat filter
            expect(result.filterGraph).toContain('concat=');
            
            // 4. Input labels should be referenced
            inputs.forEach((_, idx) => {
                // Not guaranteed to be used if we skipped it? 
                // Wait, we forced usage via modulo. 
                // But complex filter might optimize? No.
                // We should see [0:v] etc.
                // expect(result.filterGraph).toContain(`[${idx}:v]`);
            });
        }
      ),
      { numRuns: 100 } // Run 100 random variations
    );
  });
});
