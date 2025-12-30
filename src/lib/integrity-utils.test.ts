import { checkClipIntegrity, canRelinkClip, IntegrityStatus } from './integrity-utils';
import { VideoClip } from '@/types/subtitle';
import * as fc from 'fast-check';

describe('integrity-utils', () => {

  // Fuzzer / Property Tests
  describe('checkClipIntegrity (Property)', () => {
    
    it('should return MISSING if measuredSize is null', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            filePath: fc.string(),
            originalFilename: fc.string(),
            duration: fc.integer(),
            width: fc.integer(),
            height: fc.integer(),
            subtitles: fc.constant([]),
            fileSize: fc.option(fc.integer({ min: 0 }), { nil: undefined })
          }),
          (clip) => {
            const result = checkClipIntegrity(clip as VideoClip, null);
            expect(result).toBe(IntegrityStatus.MISSING);
          }
        )
      );
    });

    it('should return OK if fileSize is undefined/null (legacy support)', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            filePath: fc.string(),
            originalFilename: fc.string(),
            duration: fc.integer(),
            width: fc.integer(),
            height: fc.integer(),
            subtitles: fc.constant([]),
            // Explicitly undefined or null fileSize
            fileSize: fc.constantFrom(undefined, null)
          }),
          fc.integer({ min: 0 }),
          (clip, measuredSize) => {
            const result = checkClipIntegrity(clip as VideoClip, measuredSize);
            expect(result).toBe(IntegrityStatus.OK);
          }
        )
      );
    });

    it('should return OK if sizes match', () => {
       fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          (size) => {
             const clip: Partial<VideoClip> = { fileSize: size };
             expect(checkClipIntegrity(clip as VideoClip, size)).toBe(IntegrityStatus.OK);
          }
        )
       );
    });

    it('should return MISMATCH if sizes differ', () => {
       fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.integer({ min: 0 }),
          (recordedSize, actualSize) => {
             fc.pre(recordedSize !== actualSize);
             const clip: Partial<VideoClip> = { fileSize: recordedSize };
             expect(checkClipIntegrity(clip as VideoClip, actualSize)).toBe(IntegrityStatus.MISMATCH);
          }
        )
       );
    });
  });

  describe('canRelinkClip (Property)', () => {

     it('should allow relink if filename and size match', () => {
        fc.assert(
         fc.property(
           fc.string({ minLength: 1 }),
           fc.integer({ min: 0 }),
           (filename, size) => {
              const clip: Partial<VideoClip> = { 
                  originalFilename: filename,
                  fileSize: size
              };
              expect(canRelinkClip(clip as VideoClip, filename, size)).toBe(true);
           }
         )
        );
     });

     it('should reject if filename differs', () => {
        fc.assert(
         fc.property(
           fc.string({ minLength: 1 }),
           fc.string({ minLength: 1 }),
           fc.integer({ min: 0 }),
           (name1, name2, size) => {
              fc.pre(name1 !== name2);
              const clip: Partial<VideoClip> = { 
                  originalFilename: name1,
                  fileSize: size
              };
              expect(canRelinkClip(clip as VideoClip, name2, size)).toBe(false);
           }
         )
        );
     });

     it('should reject if size differs', () => {
        fc.assert(
         fc.property(
           fc.string({ minLength: 1 }),
           fc.integer({ min: 0 }),
           fc.integer({ min: 0 }),
           (filename, size1, size2) => {
              fc.pre(size1 !== size2);
              const clip: Partial<VideoClip> = { 
                  originalFilename: filename,
                  fileSize: size1
              };
              expect(canRelinkClip(clip as VideoClip, filename, size2)).toBe(false);
           }
         )
        );
     });
  });
});
