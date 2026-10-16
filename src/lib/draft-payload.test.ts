import { buildDraftSaveBody, distributeSubtitlesToClips, EditorDraftState } from './draft-payload';
import { DEFAULT_CONFIG, DEFAULT_PROJECT_CONFIG, VideoClip, TimelineClip, SubtitleLine } from '@/types/subtitle';

const clip = (id: string): VideoClip => ({
  id, filePath: `/storage/${id}.mp4`, originalFilename: `${id}.mp4`,
  duration: 60, width: 1920, height: 1080, subtitles: [],
});

const line = (id: string, clipId?: string): SubtitleLine => ({ id, startTime: 0, endTime: 1, text: id, clipId });

const baseState: EditorDraftState = {
  draftId: null,
  newDraftName: 'My Video.mp4',
  videoPath: '/storage/v.mp4',
  subtitles: [line('s1')],
  config: DEFAULT_CONFIG,
  videoClips: [],
  timelineClips: [],
  projectConfig: DEFAULT_PROJECT_CONFIG,
  imageAssets: [],
  timelineImages: [],
};

describe('distributeSubtitlesToClips', () => {
  const clips = [clip('v1'), clip('v2')];
  const timeline: TimelineClip[] = [
    { id: 'tl-1', videoClipId: 'v1', projectStartTime: 0, sourceInPoint: 0, clipDuration: 60 },
    { id: 'tl-2', videoClipId: 'v2', projectStartTime: 60, sourceInPoint: 0, clipDuration: 60 },
  ];

  it('maps each line to its source clip via the timeline clip ID', () => {
    const result = distributeSubtitlesToClips([line('a', 'tl-1'), line('b', 'tl-2'), line('c', 'tl-2')], clips, timeline);
    expect(result.map(c => c.subtitles.map(s => s.id))).toEqual([['a'], ['b', 'c']]);
  });

  it('accepts a library clip ID directly', () => {
    const result = distributeSubtitlesToClips([line('a', 'v2')], clips, timeline);
    expect(result[1].subtitles.map(s => s.id)).toEqual(['a']);
  });

  it('keeps unassigned or orphaned lines on the first clip instead of dropping them', () => {
    const result = distributeSubtitlesToClips([line('a'), line('b', 'deleted-timeline-clip')], clips, timeline);
    expect(result[0].subtitles.map(s => s.id)).toEqual(['a', 'b']);
    expect(result[1].subtitles).toEqual([]);
  });
});

describe('buildDraftSaveBody', () => {
  it('builds a V1 body for a single-video project', () => {
    const body = buildDraftSaveBody(baseState);
    expect(body).toEqual({
      name: 'My Video.mp4',
      videoPath: '/storage/v.mp4',
      subtitles: baseState.subtitles,
      config: DEFAULT_CONFIG,
    });
  });

  it('builds a V2 body with clips, timeline and images for a multi-video project', () => {
    const timeline: TimelineClip[] = [{ id: 'tl-1', videoClipId: 'v1', projectStartTime: 0, sourceInPoint: 0, clipDuration: 60 }];
    const images = [{ id: 'img', filePath: '/storage/i.png', originalFilename: 'i.png', width: 10, height: 10 }];
    const timelineImages = [{ id: 'ti', type: 'image' as const, imageAssetId: 'img', projectStartTime: 60, duration: 5 }];

    const body = buildDraftSaveBody({
      ...baseState,
      draftId: 'draft-1',
      subtitles: [line('a', 'tl-1')],
      videoClips: [clip('v1')],
      timelineClips: timeline,
      imageAssets: images,
      timelineImages,
    });

    expect(body).toMatchObject({
      id: 'draft-1',
      version: 2,
      timeline,
      projectConfig: DEFAULT_PROJECT_CONFIG,
      subtitleConfig: DEFAULT_CONFIG,
      imageAssets: images,
      timelineImages,
    });
    expect((body.clips as VideoClip[])[0].subtitles.map(s => s.id)).toEqual(['a']);
    expect(body).not.toHaveProperty('videoPath');
    expect(body).not.toHaveProperty('subtitles');
  });

  it('omits the name when updating, so a rename is not undone', () => {
    const body = buildDraftSaveBody({ ...baseState, draftId: 'draft-1' });
    expect(body.id).toBe('draft-1');
    expect(body).not.toHaveProperty('name');
  });
});
