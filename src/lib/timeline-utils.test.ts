/**
 * timeline-utils.test.ts - Comprehensive tests for timeline calculations
 * 
 * Unit tests and property-based tests for time conversion functions
 */

import * as fc from 'fast-check';
import {
  toProjectTime,
  toSourceTime,
  toSourceTimeFromEdit,
  getClipEndTime,
  getProjectDuration,
  getActiveClipAt,
  getFlattenedSubtitles,
  findOverlappingClips,
  arrangeSequentially,
} from './timeline-utils';
import { TimelineClip, VideoClip, SubtitleLine, TimelineImage } from '@/types/subtitle';

// Test fixtures
const createTimelineClip = (overrides: Partial<TimelineClip> = {}): TimelineClip => ({
  id: 'timeline-1',
  videoClipId: 'clip-1',
  projectStartTime: 0,
  sourceInPoint: 0,
  clipDuration: 60,
  ...overrides,
});

const createVideoClip = (overrides: Partial<VideoClip> = {}): VideoClip => ({
  id: 'clip-1',
  filePath: '/path/to/video.mp4',
  originalFilename: 'video.mp4',
  duration: 120,
  width: 1920,
  height: 1080,
  subtitles: [],
  ...overrides,
});

const createSubtitle = (overrides: Partial<SubtitleLine> = {}): SubtitleLine => ({
  id: 'sub-1',
  startTime: 0,
  endTime: 5,
  text: 'Test subtitle',
  ...overrides,
});

// ============================================================================
// toProjectTime Tests
// ============================================================================

describe('toProjectTime', () => {
  describe('unit tests', () => {
    test('returns subtitle time when clip starts at 0', () => {
      const clip = createTimelineClip({ projectStartTime: 0 });
      expect(toProjectTime(5, clip)).toBe(5);
    });

    test('adds clip start time to subtitle time', () => {
      const clip = createTimelineClip({ projectStartTime: 480 }); // 8 minutes
      expect(toProjectTime(5, clip)).toBe(485); // 8:05
    });

    test('handles zero subtitle time', () => {
      const clip = createTimelineClip({ projectStartTime: 100 });
      expect(toProjectTime(0, clip)).toBe(100);
    });

    test('handles large values', () => {
      const clip = createTimelineClip({ projectStartTime: 3600 }); // 1 hour
      expect(toProjectTime(1800, clip)).toBe(5400); // 1.5 hours
    });
  });

  describe('property tests', () => {
    test('result is always >= projectStartTime for non-negative subtitle times', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 86400, noNaN: true }),
          fc.float({ min: 0, max: 3600, noNaN: true }),
          (projectStartTime, subtitleTime) => {
            const clip = createTimelineClip({ projectStartTime });
            return toProjectTime(subtitleTime, clip) >= projectStartTime;
          }
        )
      );
    });

    test('toProjectTime(0, clip) === clip.projectStartTime', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 86400, noNaN: true }),
          (projectStartTime) => {
            const clip = createTimelineClip({ projectStartTime });
            return toProjectTime(0, clip) === projectStartTime;
          }
        )
      );
    });
  });
});

// ============================================================================
// toSourceTime Tests
// ============================================================================

describe('toSourceTime', () => {
  describe('unit tests', () => {
    test('returns source time for valid project time', () => {
      const clip = createTimelineClip({ 
        projectStartTime: 100, 
        sourceInPoint: 10, 
        clipDuration: 30 
      });
      // Project time 115 -> 15s into clip -> source time 25 (10 + 15)
      expect(toSourceTime(115, clip)).toBe(25);
    });

    test('returns null for project time before clip', () => {
      const clip = createTimelineClip({ projectStartTime: 100 });
      expect(toSourceTime(50, clip)).toBeNull();
    });

    test('returns null for project time after clip', () => {
      const clip = createTimelineClip({ 
        projectStartTime: 100, 
        clipDuration: 30 
      });
      expect(toSourceTime(200, clip)).toBeNull();
    });

    test('handles edge: exactly at clip start', () => {
      const clip = createTimelineClip({ 
        projectStartTime: 100, 
        sourceInPoint: 5 
      });
      expect(toSourceTime(100, clip)).toBe(5);
    });

    test('handles edge: exactly at clip end', () => {
      const clip = createTimelineClip({ 
        projectStartTime: 100, 
        clipDuration: 30,
        sourceInPoint: 0
      });
      // At exactly clip end (130), the comparison is timeInClip > clipDuration
      // 130 - 100 = 30, 30 > 30 is false, so it returns the source time
      expect(toSourceTime(130, clip)).toBe(30);
    });
  });

  describe('property tests', () => {
    test('roundtrip: toSourceTime(toProjectTime(t, clip), clip) === sourceInPoint + t for valid t', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 1, max: 1000, noNaN: true }),
          (projectStartTime, sourceInPoint, clipDuration) => {
            const clip = createTimelineClip({ projectStartTime, sourceInPoint, clipDuration });
            
            // Pick a subtitle time within the clip duration
            const subtitleTime = clipDuration / 2;
            const projectTime = toProjectTime(subtitleTime, clip);
            const sourceTime = toSourceTime(projectTime, clip);
            
            if (sourceTime === null) return false;
            
            const expected = sourceInPoint + subtitleTime;
            return Math.abs(sourceTime - expected) < 0.0001;
          }
        )
      );
    });
  });
});

// ============================================================================
// toSourceTimeFromEdit Tests
// ============================================================================

describe('toSourceTimeFromEdit', () => {
  describe('unit tests', () => {
    test('converts timeline time back to source time', () => {
      // User drags subtitle to 8:01 (481s) on timeline
      // Clip at project 8:00 (480s), sourceInPoint at 5s
      const clip = createTimelineClip({ 
        projectStartTime: 480, 
        sourceInPoint: 5, 
        clipDuration: 30 
      });
      // Expected: (481 - 480) + 5 = 6s in source
      expect(toSourceTimeFromEdit(481, clip)).toBe(6);
    });

    test('handles zero offset case', () => {
      const clip = createTimelineClip({ 
        projectStartTime: 100, 
        sourceInPoint: 0 
      });
      // Timeline time exactly at clip start -> source time 0
      expect(toSourceTimeFromEdit(100, clip)).toBe(0);
    });

    test('handles sourceInPoint offset', () => {
      const clip = createTimelineClip({ 
        projectStartTime: 0, 
        sourceInPoint: 10, 
        clipDuration: 30 
      });
      // Timeline time 15 -> (15 - 0) + 10 = 25s in source
      expect(toSourceTimeFromEdit(15, clip)).toBe(25);
    });

    test('example from timing diagram: 8:01 -> 6s', () => {
      // From the timing model documentation:
      // Clip at 8:00 (480s), sourceInPoint 5s
      // User drags to 8:01 (481s)
      // Source time = (481 - 480) + 5 = 6s
      const clip = createTimelineClip({ 
        projectStartTime: 480, 
        sourceInPoint: 5, 
        clipDuration: 30 
      });
      expect(toSourceTimeFromEdit(481, clip)).toBe(6);
    });
  });

  describe('property tests', () => {
    test('roundtrip: toSourceTimeFromEdit and back preserves relative position', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 1, max: 1000, noNaN: true }),
          (projectStartTime, sourceInPoint, clipDuration) => {
            const clip = createTimelineClip({ projectStartTime, sourceInPoint, clipDuration });
            
            // Pick a time within the clip
            const offsetInClip = clipDuration / 2;
            const timelineTime = projectStartTime + offsetInClip;
            
            // Convert to source, then back to project
            const sourceTime = toSourceTimeFromEdit(timelineTime, clip);
            const backToProject = toProjectTime(sourceTime - sourceInPoint, clip);
            
            return Math.abs(backToProject - timelineTime) < 0.0001;
          }
        )
      );
    });

    test('toSourceTimeFromEdit(projectStartTime, clip) === sourceInPoint', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (projectStartTime, sourceInPoint) => {
            const clip = createTimelineClip({ projectStartTime, sourceInPoint });
            return toSourceTimeFromEdit(projectStartTime, clip) === sourceInPoint;
          }
        )
      );
    });
  });
});

// ============================================================================
// getClipEndTime Tests
// ============================================================================

describe('getClipEndTime', () => {
  test('calculates end time correctly', () => {
    const clip = createTimelineClip({ projectStartTime: 100, clipDuration: 30 });
    expect(getClipEndTime(clip)).toBe(130);
  });

  test('handles zero start time', () => {
    const clip = createTimelineClip({ projectStartTime: 0, clipDuration: 60 });
    expect(getClipEndTime(clip)).toBe(60);
  });
});

// ============================================================================
// getProjectDuration Tests
// ============================================================================

describe('getProjectDuration', () => {
  const createTimelineImage = (overrides: Partial<TimelineImage> = {}): TimelineImage => ({
    id: 'image-1',
    imageAssetId: 'asset-1',
    projectStartTime: 0,
    duration: 5,
    type: 'image',
    ...overrides,
  } as TimelineImage);

  test('returns 0 for empty timeline', () => {
    expect(getProjectDuration([], [])).toBe(0);
  });

  test('returns correct duration for single clip', () => {
    const timeline = [createTimelineClip({ projectStartTime: 0, clipDuration: 60 })];
    expect(getProjectDuration(timeline, [])).toBe(60);
  });

  test('returns correct duration for single image', () => {
    const images = [createTimelineImage({ projectStartTime: 10, duration: 5 })];
    expect(getProjectDuration([], images)).toBe(15);
  });

  test('returns end of latest item (clips and images)', () => {
    const timeline = [
      createTimelineClip({ id: '1', projectStartTime: 0, clipDuration: 30 }),
      createTimelineClip({ id: '2', projectStartTime: 50, clipDuration: 40 }), // Ends at 90
    ];
    const images = [
      createTimelineImage({ id: '3', projectStartTime: 95, duration: 10 }), // Ends at 105
    ];
    expect(getProjectDuration(timeline, images)).toBe(105);
  });

  test('handles case where clip is latest', () => {
    const timeline = [
      createTimelineClip({ id: '1', projectStartTime: 0, clipDuration: 100 }), // Ends at 100
    ];
    const images = [
      createTimelineImage({ id: '2', projectStartTime: 50, duration: 30 }), // Ends at 80
    ];
    expect(getProjectDuration(timeline, images)).toBe(100);
  });

  describe('property tests', () => {
    test('result is always >= end of any clip or image', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({ start: fc.float({min:0, max:1000}), dur: fc.float({min:1, max:100}) })),
          fc.array(fc.record({ start: fc.float({min:0, max:1000}), dur: fc.float({min:1, max:100}) })),
          (clipData, imageData) => {
            const timeline = clipData.map((d, i) => createTimelineClip({ id: `c${i}`, projectStartTime: d.start, clipDuration: d.dur }));
            const images = imageData.map((d, i) => createTimelineImage({ id: `i${i}`, projectStartTime: d.start, duration: d.dur }));
            
            const duration = getProjectDuration(timeline, images);
            
            for (const clip of timeline) {
               if (duration < clip.projectStartTime + clip.clipDuration) return false;
            }
            for (const img of images) {
               if (duration < img.projectStartTime + img.duration) return false;
            }
            return true;
          }
        )
      );
    });
  });
});

// ============================================================================
// getActiveClipAt Tests
// ============================================================================

describe('getActiveClipAt', () => {
  const timeline = [
    createTimelineClip({ id: 'a', projectStartTime: 0, clipDuration: 30 }),
    createTimelineClip({ id: 'b', projectStartTime: 30, clipDuration: 30 }),
    createTimelineClip({ id: 'c', projectStartTime: 60, clipDuration: 30 }),
  ];

  test('finds correct clip for time in first clip', () => {
    expect(getActiveClipAt(timeline, 15)?.id).toBe('a');
  });

  test('finds correct clip for time in middle clip', () => {
    expect(getActiveClipAt(timeline, 45)?.id).toBe('b');
  });

  test('finds correct clip for time in last clip', () => {
    expect(getActiveClipAt(timeline, 75)?.id).toBe('c');
  });

  test('returns null for time before first clip', () => {
    expect(getActiveClipAt(timeline, -5)).toBeNull();
  });

  test('returns null for time after all clips', () => {
    expect(getActiveClipAt(timeline, 100)).toBeNull();
  });

  test('handles exact clip boundaries', () => {
    expect(getActiveClipAt(timeline, 30)?.id).toBe('b'); // Start of b, not end of a
    expect(getActiveClipAt(timeline, 0)?.id).toBe('a'); // Start of a
  });
});

// ============================================================================
// getFlattenedSubtitles Tests
// ============================================================================

describe('getFlattenedSubtitles', () => {
  test('flattens subtitles from single clip', () => {
    const clips = [
      createVideoClip({
        id: 'clip-1',
        subtitles: [
          createSubtitle({ id: 's1', startTime: 5, endTime: 10, text: 'First' }),
          createSubtitle({ id: 's2', startTime: 15, endTime: 20, text: 'Second' }),
        ],
      }),
    ];
    
    const timeline = [
      createTimelineClip({ 
        videoClipId: 'clip-1', 
        projectStartTime: 100,
        sourceInPoint: 0,
        clipDuration: 60,
      }),
    ];
    
    const result = getFlattenedSubtitles(clips, timeline);
    
    expect(result).toHaveLength(2);
    expect(result[0].projectStartTime).toBe(105);
    expect(result[1].projectStartTime).toBe(115);
  });

  test('handles sourceInPoint offset', () => {
    const clips = [
      createVideoClip({
        id: 'clip-1',
        subtitles: [
          createSubtitle({ id: 's1', startTime: 10, endTime: 15, text: 'At 10s' }),
        ],
      }),
    ];
    
    const timeline = [
      createTimelineClip({ 
        videoClipId: 'clip-1', 
        projectStartTime: 0,
        sourceInPoint: 5, // Start 5s into video
        clipDuration: 30,
      }),
    ];
    
    const result = getFlattenedSubtitles(clips, timeline);
    
    // Subtitle at 10s in video, inPoint at 5s -> 5s offset -> project time 5
    expect(result).toHaveLength(1);
    expect(result[0].projectStartTime).toBe(5);
  });

  test('filters out subtitles before sourceInPoint', () => {
    const clips = [
      createVideoClip({
        id: 'clip-1',
        subtitles: [
          createSubtitle({ id: 's1', startTime: 2, endTime: 7, text: 'Before inPoint' }),
          createSubtitle({ id: 's2', startTime: 15, endTime: 20, text: 'After inPoint' }),
        ],
      }),
    ];
    
    const timeline = [
      createTimelineClip({ 
        videoClipId: 'clip-1', 
        projectStartTime: 0,
        sourceInPoint: 10,
        clipDuration: 20,
      }),
    ];
    
    const result = getFlattenedSubtitles(clips, timeline);
    
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('After inPoint');
  });

  test('returns sorted results for multiple clips', () => {
    const clips = [
      createVideoClip({
        id: 'clip-1',
        subtitles: [createSubtitle({ id: 's1', startTime: 5, endTime: 10 })],
      }),
      createVideoClip({
        id: 'clip-2',
        subtitles: [createSubtitle({ id: 's2', startTime: 5, endTime: 10 })],
      }),
    ];
    
    const timeline = [
      createTimelineClip({ id: 't2', videoClipId: 'clip-2', projectStartTime: 0, sourceInPoint: 0, clipDuration: 60 }),
      createTimelineClip({ id: 't1', videoClipId: 'clip-1', projectStartTime: 60, sourceInPoint: 0, clipDuration: 60 }),
    ];
    
    const result = getFlattenedSubtitles(clips, timeline);
    
    expect(result).toHaveLength(2);
    expect(result[0].projectStartTime).toBeLessThan(result[1].projectStartTime);
  });
});

// ============================================================================
// findOverlappingClips Tests
// ============================================================================

describe('findOverlappingClips', () => {
  test('returns empty for non-overlapping clips', () => {
    const timeline = [
      createTimelineClip({ id: 'a', projectStartTime: 0, clipDuration: 30 }),
      createTimelineClip({ id: 'b', projectStartTime: 30, clipDuration: 30 }),
    ];
    expect(findOverlappingClips(timeline)).toHaveLength(0);
  });

  test('detects overlapping clips', () => {
    const timeline = [
      createTimelineClip({ id: 'a', projectStartTime: 0, clipDuration: 40 }),
      createTimelineClip({ id: 'b', projectStartTime: 30, clipDuration: 30 }),
    ];
    const overlaps = findOverlappingClips(timeline);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].map(c => c.id).sort()).toEqual(['a', 'b']);
  });

  test('handles multiple overlaps', () => {
    const timeline = [
      createTimelineClip({ id: 'a', projectStartTime: 0, clipDuration: 100 }),
      createTimelineClip({ id: 'b', projectStartTime: 20, clipDuration: 30 }),
      createTimelineClip({ id: 'c', projectStartTime: 40, clipDuration: 30 }),
    ];
    const overlaps = findOverlappingClips(timeline);
    // a overlaps with b, a overlaps with c, b overlaps with c
    expect(overlaps).toHaveLength(3);
  });
});

// ============================================================================
// arrangeSequentially Tests
// ============================================================================

describe('arrangeSequentially', () => {
  test('arranges clips without gaps', () => {
    const timeline = [
      createTimelineClip({ id: 'a', projectStartTime: 100, clipDuration: 30 }),
      createTimelineClip({ id: 'b', projectStartTime: 200, clipDuration: 20 }),
      createTimelineClip({ id: 'c', projectStartTime: 300, clipDuration: 10 }),
    ];
    
    const result = arrangeSequentially(timeline);
    
    expect(result[0].projectStartTime).toBe(0);
    expect(result[1].projectStartTime).toBe(30);
    expect(result[2].projectStartTime).toBe(50);
  });

  test('preserves clip order', () => {
    const timeline = [
      createTimelineClip({ id: 'first', projectStartTime: 500, clipDuration: 10 }),
      createTimelineClip({ id: 'second', projectStartTime: 0, clipDuration: 20 }),
    ];
    
    const result = arrangeSequentially(timeline);
    
    expect(result[0].id).toBe('first');
    expect(result[1].id).toBe('second');
  });

  test('preserves clip durations', () => {
    const timeline = [
      createTimelineClip({ id: 'a', clipDuration: 30 }),
      createTimelineClip({ id: 'b', clipDuration: 45 }),
    ];
    
    const result = arrangeSequentially(timeline);
    
    expect(result[0].clipDuration).toBe(30);
    expect(result[1].clipDuration).toBe(45);
  });

  describe('property tests', () => {
    test('result has no overlaps', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1, max: 100, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (durations) => {
            const timeline = durations.map((d, i) => 
              createTimelineClip({ id: `clip-${i}`, clipDuration: d })
            );
            const result = arrangeSequentially(timeline);
            return findOverlappingClips(result).length === 0;
          }
        )
      );
    });

    test('total duration equals sum of clip durations', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1, max: 100, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (durations) => {
            const timeline = durations.map((d, i) => 
              createTimelineClip({ id: `clip-${i}`, clipDuration: d })
            );
            const result = arrangeSequentially(timeline);
            const totalDuration = getProjectDuration(result);
            const sumDurations = durations.reduce((a, b) => a + b, 0);
            return Math.abs(totalDuration - sumDurations) < 0.0001;
          }
        )
      );
    });
  });
});
