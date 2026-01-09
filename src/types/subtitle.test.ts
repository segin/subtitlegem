import { 
  isMultiVideoProject, 
  migrateToMultiVideo, 
  ProjectState,
  MultiVideoProjectState,
  DEFAULT_PROJECT_CONFIG
} from './subtitle';
import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from './constants';

describe('subtitle types utils', () => {
  
  const mockV1: ProjectState = {
    version: 1,
    timestamp: 123456789,
    videoPath: '/path/to/video.mp4',
    subtitles: [
      { id: '1', startTime: 0, endTime: 1, text: 'Test' }
    ],
    config: {
      ffmpeg: {
         hwaccel: 'none',
         preset: 'fast',
         crf: 23,
         resolution: 'original'
      }
    }
  };

  const mockV2: MultiVideoProjectState = {
    version: 2,
    timestamp: 123456789,
    clips: [],
    timeline: [],
    projectConfig: DEFAULT_PROJECT_CONFIG,
    subtitleConfig: mockV1.config
  };

  describe('isMultiVideoProject', () => {
    it('returns false for V1 state', () => {
      expect(isMultiVideoProject(mockV1)).toBe(false);
    });

    it('returns true for V2 state', () => {
      expect(isMultiVideoProject(mockV2)).toBe(true);
    });

    it('returns false for partial/invalid objects', () => {
      expect(isMultiVideoProject({} as any)).toBe(false);
      expect(isMultiVideoProject({ version: 2 } as any)).toBe(false);
      // 'clips' and 'timeline' are required keys
      expect(isMultiVideoProject({ version: 2, clips: [] } as any)).toBe(false);
    });
  });

  describe('migrateToMultiVideo', () => {
    it('migrates V1 to V2 correctly', () => {
      const v2 = migrateToMultiVideo(mockV1);

      expect(v2.version).toBe(2);
      expect(v2.timestamp).toBe(mockV1.timestamp);
      
      // Check clips
      expect(v2.clips).toHaveLength(1);
      const clip = v2.clips[0];
      expect(clip.filePath).toBe(mockV1.videoPath);
      expect(clip.subtitles).toEqual(mockV1.subtitles);
      expect(clip.width).toBe(REFERENCE_WIDTH);
      expect(clip.height).toBe(REFERENCE_HEIGHT);

      // Check timeline
      expect(v2.timeline).toHaveLength(1);
      const tlCheck = v2.timeline[0];
      expect(tlCheck.videoClipId).toBe(clip.id);
      expect(tlCheck.projectStartTime).toBe(0);

      // Check config inheritance
      expect(v2.subtitleConfig).toEqual(mockV1.config);
    });

    it('handles empty/null V1 fields gracefully', () => {
      const emptyV1: ProjectState = {
        ...mockV1,
        videoPath: null,
        subtitles: []
      };
      
      const v2 = migrateToMultiVideo(emptyV1);
      
      expect(v2.clips[0].filePath).toBe('');
      expect(v2.clips[0].subtitles).toEqual([]);
    });
  });
});
