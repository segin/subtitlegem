/**
 * ffmpeg-concat.test.ts - Unit tests for multi-video concatenation logic
 */

import { EventEmitter } from 'events';

// Mock child_process for exportMultiVideo
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

import { spawn } from 'child_process';
import { generateFilterComplex, exportMultiVideo } from './ffmpeg-concat';
import { ProjectConfig, TimelineClip, TimelineImage, MultiVideoProjectState } from '@/types/subtitle';

// Helper to create mock process
function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: jest.fn(), end: jest.fn() };
  return proc;
}

describe('ffmpeg-concat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateFilterComplex', () => {
    const config: ProjectConfig = {
      width: 1920,
      height: 1080,
      fps: 30,
      scalingMode: 'fit'
    };

    const inputs: Array<{ type: 'video' | 'image'; path: string; id: string }> = [
      { type: 'video', path: 'video1.mp4', id: 'v1' },
      { type: 'video', path: 'video2.mp4', id: 'v2' },
      { type: 'image', path: 'image1.jpg', id: 'i1' }
    ];

    test('generates basic filter graph for sequential clips', () => {
      const timeline: TimelineClip[] = [
        { 
          id: 'c1', 
          videoClipId: 'v1', 
          projectStartTime: 0, 
          sourceInPoint: 0, 
          clipDuration: 10 
        },
        { 
          id: 'c2', 
          videoClipId: 'v2', 
          projectStartTime: 10, 
          sourceInPoint: 5, 
          clipDuration: 5 
        }
      ];

      const { filterGraph, map } = generateFilterComplex(inputs, timeline, config);

      // Verify trim filters
      expect(filterGraph).toContain('trim=start=0:duration=10');
      expect(filterGraph).toContain('trim=start=5:duration=5');
      
      // Verify scaling (default fit uses scale+pad)
      expect(filterGraph).toContain('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080');
      
      // Verify concat
      expect(filterGraph).toContain('concat=n=2:v=1:a=1[vconcat][aconcat]');
      expect(map).toBe('[vconcat][aconcat]');
    });

    test('fills gaps with black video and silent audio', () => {
      const timeline: TimelineClip[] = [
        { 
          id: 'c1', 
          videoClipId: 'v1', 
          projectStartTime: 5, // Gap of 5 seconds at start
          sourceInPoint: 0, 
          clipDuration: 10 
        }
      ];

      const { filterGraph } = generateFilterComplex(inputs, timeline, config);

      // Check for black color gap
      expect(filterGraph).toContain('color=s=1920x1080:c=black:d=5[gapv0]');
      // Check for silent audio gap
      expect(filterGraph).toContain('anullsrc=cl=stereo:r=44100:d=5[gapa0]');
      // Verify gap is in concat
      expect(filterGraph).toContain('[gapv0][v1][gapa0][a1]concat=n=2');
    });

    test('handles different scaling modes', () => {
      const timeline: TimelineClip[] = [
        { id: 'c1', videoClipId: 'v1', projectStartTime: 0, sourceInPoint: 0, clipDuration: 10 }
      ];

      // Stretch
      const stretchResult = generateFilterComplex(inputs, timeline, { ...config, scalingMode: 'stretch' });
      expect(stretchResult.filterGraph).toContain('scale=1920:1080,setsar=1');

      // Fill
      const fillResult = generateFilterComplex(inputs, timeline, { ...config, scalingMode: 'fill' });
      expect(fillResult.filterGraph).toContain('scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1');

      // Fit (default)
      const fitResult = generateFilterComplex(inputs, timeline, { ...config, scalingMode: 'fit' });
      expect(fitResult.filterGraph).toContain('force_original_aspect_ratio=decrease,pad=1920:1080');
    });

    test('handles images on timeline', () => {
      const timeline: TimelineImage[] = [
        { 
          id: 'img1', 
          type: 'image',
          imageAssetId: 'i1', 
          projectStartTime: 0, 
          duration: 5 
        }
      ];

      const { filterGraph } = generateFilterComplex(inputs, timeline, config);

      // Verify silent audio for image
      expect(filterGraph).toContain('anullsrc=cl=stereo:r=44100:d=5[a0]');
      // Verify image scaling and fps
      expect(filterGraph).toContain('fps=30[v0]');
    });

    test('warns and skips if input ID is missing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const timeline: TimelineClip[] = [
        { id: 'c1', videoClipId: 'non-existent', projectStartTime: 0, sourceInPoint: 0, clipDuration: 10 }
      ];

      const { filterGraph } = generateFilterComplex(inputs, timeline, config);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Could not find input'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('exportMultiVideo', () => {
    const project: MultiVideoProjectState = {
        clips: [{ id: 'v1', filePath: '/path/to/video1.mp4', originalFilename: 'v1.mp4', duration: 100, width: 1920, height: 1080, fps: 30 }],
        timeline: [{ id: 'c1', videoClipId: 'v1', projectStartTime: 0, sourceInPoint: 0, clipDuration: 10 }],
        timelineImages: [],
        imageAssets: [],
        projectConfig: { width: 1920, height: 1080, fps: 30, scalingMode: 'fit' }
    };

    it('should use specified video codec', async () => {
        const mockProc = createMockProcess();
        (spawn as jest.Mock).mockReturnValue(mockProc);

        const promise = exportMultiVideo(project, '/subs.ass', '/output.mp4', {
            codec: 'libx265'
        });

        // Simulate FFmpeg finish
        setTimeout(() => mockProc.emit('close', 0), 10);

        await promise;

        const call = (spawn as jest.Mock).mock.calls.find(c => c[0] === 'ffmpeg');
        expect(call).toBeDefined();
        // Check args
        const args = call[1];
        const codecIndex = args.findIndex((a: string) => a === '-c:v');
        expect(codecIndex).toBeGreaterThan(-1);
        expect(args[codecIndex + 1]).toBe('libx265');
    });

    it('should fall back to libx264 if no codec specified', async () => {
        const mockProc = createMockProcess();
        (spawn as jest.Mock).mockReturnValue(mockProc);

        const promise = exportMultiVideo(project, '/subs.ass', '/output.mp4', {});

        setTimeout(() => mockProc.emit('close', 0), 10);

        await promise;

        const call = (spawn as jest.Mock).mock.calls.find(c => c[0] === 'ffmpeg');
        const args = call[1];
        const codecIndex = args.findIndex((a: string) => a === '-c:v');
        expect(args[codecIndex + 1]).toBe('libx264');
    });
  });
});
