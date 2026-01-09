import * as fc from 'fast-check';
import { 
  ProjectState, 
  migrateToMultiVideo, 
  isMultiVideoProject 
} from './subtitle';

describe('subtitle properties', () => {

  // Arbitrary for SubtitleLine (simplified)
  const subtitleLineArb = fc.record({
    id: fc.uuid(),
    startTime: fc.double({min:0, max: 1000}), 
    endTime: fc.double({min:0, max: 1000}),
    text: fc.string(),
    secondaryText: fc.option(fc.string())
  });

  // Arbitrary for V1 ProjectState
  const projectStateV1Arb = fc.record({
    version: fc.constant(1),
    timestamp: fc.integer(),
    videoPath: fc.option(fc.string()), // string | null
    subtitles: fc.array(subtitleLineArb),
    config: fc.record({
      primaryLanguage: fc.option(fc.string()),
      secondaryLanguage: fc.option(fc.string()),
      ffmpeg: fc.record({
        hwaccel: fc.constantFrom('none', 'nvenc', 'vaapi'),
        preset: fc.constantFrom('ultrafast', 'medium', 'veryslow'),
        crf: fc.integer({min: 0, max: 51}),
        resolution: fc.string()
      })
    })
  }) as any as fc.Arbitrary<ProjectState>;

  test('migrateToMultiVideo always produces valid V2 state', () => {
    fc.assert(
      fc.property(projectStateV1Arb, (v1) => {
        const v2 = migrateToMultiVideo(v1);

        // 1. Should be V2
        expect(isMultiVideoProject(v2)).toBe(true);
        expect(v2.version).toBe(2);

        // 2. Data Preservation
        // Subtitles should match exactly
        expect(v2.clips[0].subtitles).toEqual(v1.subtitles);
        
        // Video path should be string (null converts to empty string)
        const expectedPath = v1.videoPath || '';
        expect(v2.clips[0].filePath).toBe(expectedPath);
        
        // Config should match
        expect(v2.subtitleConfig).toEqual(v1.config);

        // 3. Structure Integrity
        expect(v2.clips).toHaveLength(1);
        expect(v2.timeline).toHaveLength(1);
        expect(v2.timeline[0].videoClipId).toBe(v2.clips[0].id);
      })
    );
  });
});
