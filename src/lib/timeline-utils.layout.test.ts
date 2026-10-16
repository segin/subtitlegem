import { buildSequentialTimeline, repairPlaceholderTimeline, findOverlappingClips } from './timeline-utils';
import { TimelineClip, VideoClip } from '@/types/subtitle';

const clip = (id: string, duration: number): VideoClip => ({
  id, filePath: `/storage/${id}.mp4`, originalFilename: `${id}.mp4`,
  duration, width: 1920, height: 1080, subtitles: [],
});

describe('buildSequentialTimeline', () => {
  it('places uploaded clips back to back at full length', () => {
    const timeline = buildSequentialTimeline([{ id: 'a', duration: 42 }, { id: 'b', duration: 7.5 }, { id: 'c', duration: 30 }]);
    expect(timeline.map(t => [t.videoClipId, t.projectStartTime, t.clipDuration])).toEqual([
      ['a', 0, 42], ['b', 42, 7.5], ['c', 49.5, 30],
    ]);
    expect(timeline[0]).toMatchObject({ id: 'timeline-a', sourceInPoint: 0 });
  });

  it('leaves unknown durations as placeholders for the editor to repair', () => {
    const timeline = buildSequentialTimeline([{ id: 'a' }, { id: 'b', duration: 10 }]);
    expect(timeline.map(t => t.clipDuration)).toEqual([0, 10]);
  });
});

describe('repairPlaceholderTimeline', () => {
  // What older upload flows saved: staggered 10s apart, zero length
  const placeholder = (ids: string[]): TimelineClip[] => ids.map((id, i) => ({
    id: `timeline-${id}`, videoClipId: id, projectStartTime: i * 10, sourceInPoint: 0, clipDuration: 0,
  }));

  it('lays out placeholder clips back to back instead of overlapping', () => {
    const clips = [clip('a', 60), clip('b', 25), clip('c', 90)];
    const repaired = repairPlaceholderTimeline(placeholder(['a', 'b', 'c']), clips);

    expect(repaired.map(t => [t.videoClipId, t.projectStartTime, t.clipDuration])).toEqual([
      ['a', 0, 60], ['b', 60, 25], ['c', 85, 90],
    ]);
    expect(findOverlappingClips(repaired)).toEqual([]);
  });

  it('keeps placeholder positions when full-length clips still fit', () => {
    const clips = [clip('a', 5), clip('b', 8)];
    const repaired = repairPlaceholderTimeline(placeholder(['a', 'b']), clips);
    expect(repaired.map(t => [t.projectStartTime, t.clipDuration])).toEqual([[0, 5], [10, 8]]);
  });

  it('never moves a timeline without placeholders', () => {
    const arranged: TimelineClip[] = [
      { id: 't1', videoClipId: 'a', projectStartTime: 0, sourceInPoint: 0, clipDuration: 60 },
      { id: 't2', videoClipId: 'b', projectStartTime: 30, sourceInPoint: 0, clipDuration: 25 },
    ];
    expect(repairPlaceholderTimeline(arranged, [clip('a', 60), clip('b', 25)])).toBe(arranged);
  });

  it('respects the source in-point when filling a placeholder', () => {
    const timeline: TimelineClip[] = [{ id: 't', videoClipId: 'a', projectStartTime: 0, sourceInPoint: 15, clipDuration: 0 }];
    expect(repairPlaceholderTimeline(timeline, [clip('a', 60)])[0].clipDuration).toBe(45);
  });
});
