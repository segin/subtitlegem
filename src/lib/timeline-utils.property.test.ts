import * as fc from 'fast-check';
import { 
  arrangeSequentially, 
  findOverlappingClips, 
  toProjectTime, 
  toSourceTime,
} from './timeline-utils';
import { TimelineClip } from '@/types/subtitle';

describe('timeline-utils properties', () => {

  const timelineClipArb = fc.record({
    id: fc.uuid(),
    videoClipId: fc.uuid(),
    projectStartTime: fc.double({ min: 0, max: 10000, noNaN: true }),
    sourceInPoint: fc.double({ min: 0, max: 1000, noNaN: true }),
    clipDuration: fc.double({ min: 0.1, max: 1000, noNaN: true })
  });

  test('arrangeSequentially never produces overlaps', () => {
    fc.assert(
      fc.property(fc.array(timelineClipArb), (timeline) => {
        const arranged = arrangeSequentially(timeline);
        const overlaps = findOverlappingClips(arranged);
        
        expect(overlaps).toHaveLength(0);
        
        // Also verify duration conservation
        if (arranged.length > 0) {
           const totalDuration = timeline.reduce((sum, c) => sum + c.clipDuration, 0);
           const lastClip = arranged[arranged.length - 1];
           const end = lastClip.projectStartTime + lastClip.clipDuration;
           expect(end).toBeCloseTo(totalDuration);
        }
      })
    );
  });

  test('coordinate transform round-trip within clip', () => {
    fc.assert(
      fc.property(timelineClipArb, (clip) => {
        // Pick a time strictly inside the clip source range
        // sourceTime = sourceInPoint + offset (0 to duration)
        const offset = clip.clipDuration / 2;
        const sourceTime = clip.sourceInPoint + offset;
        
        // Helper to simulate inverse of toSourceTime -> get Project Time from Source Time
        // projectTime = projectStartTime + (sourceTime - sourceInPoint)
        const expectedProjectTime = clip.projectStartTime + (sourceTime - clip.sourceInPoint);
        
        // Test toSourceTime
        const calculatedSource = toSourceTime(expectedProjectTime, clip);
        expect(calculatedSource).toBeCloseTo(sourceTime);

        // Test toProjectTime (input is relative subtitle time, i.e., offset)
        const calculatedProject = toProjectTime(offset, clip);
        expect(calculatedProject).toBeCloseTo(expectedProjectTime);
      })
    );
  });
});
