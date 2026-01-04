
import fs from 'fs';
import path from 'path';
import * as fc from 'fast-check';
import { computeMetrics } from './metrics-utils';
import { DraftV1, DraftV2 } from './draft-store';

jest.mock('fs');
jest.mock('./storage-utils', () => ({
  getDirectorySize: jest.fn(() => 1024), // Mocked rendered size
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('metrics-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unit Tests', () => {
    it('should compute metrics for a valid V1 draft', () => {
      const draft: DraftV1 = {
        id: 'test-v1',
        name: 'Test V1',
        version: 1,
        videoPath: '/path/to/video.mp4',
        subtitles: [{ id: '1', startTime: 1, endTime: 2, text: 'Hello' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ size: 5000 } as any);
      mockedFs.readdirSync.mockReturnValue([]);

      const metrics = computeMetrics(draft, '/staging');

      expect(metrics.sourceCount).toBe(1);
      expect(metrics.sourceSize).toBe(5000);
      expect(metrics.subtitleCount).toBe(1);
      expect(metrics.renderCount).toBe(0);
      expect(metrics.renderedSize).toBe(1024); // From mock
    });

    it('should compute metrics for a valid V2 draft', () => {
      const draft: DraftV2 = {
        id: 'test-v2',
        name: 'Test V2',
        version: 2,
        clips: [
          { id: 'c1', filePath: 'v1.mp4', originalFilename: 'v1.mp4', fileSize: 1000, duration: 10, width: 1280, height: 720, subtitles: [] },
          { id: 'c2', filePath: 'v2.mp4', originalFilename: 'v2.mp4', fileSize: 2000, duration: 20, width: 1280, height: 720, subtitles: [] },
        ],
        timeline: [],
        projectConfig: { width: 1280, height: 720, fps: 30, scalingMode: 'fit' },
        subtitleConfig: { ffmpeg: { hwaccel: 'none', preset: 'veryfast', crf: 23, resolution: 'original' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(['output1.mp4'] as any);

      const metrics = computeMetrics(draft, '/staging');

      expect(metrics.sourceCount).toBe(2);
      expect(metrics.sourceSize).toBe(3000);
      expect(metrics.subtitleCount).toBe(0); // V2 doesn't have top-level subtitles
      expect(metrics.renderCount).toBe(1);
    });
  });

  describe('Property Tests', () => {
    it('should always return non-negative metrics for any V2 draft structure', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            name: fc.string(),
            version: fc.constant(2 as const),
            clips: fc.array(fc.record({
              fileSize: fc.nat(),
            })),
          }),
          (draftData) => {
            const draft = draftData as unknown as DraftV2;
            const metrics = computeMetrics(draft, '/staging');
            
            expect(metrics.sourceCount).toBeGreaterThanOrEqual(0);
            expect(metrics.sourceSize).toBeGreaterThanOrEqual(0);
            expect(metrics.renderCount).toBeGreaterThanOrEqual(0);
            expect(metrics.renderedSize).toBeGreaterThanOrEqual(0);
            expect(metrics.subtitleCount).toBeGreaterThanOrEqual(0);
          }
        )
      );
    });

    it('should have sourceSize equal to sum of clip fileSizes for V2', () => {
      fc.assert(
        fc.property(
          fc.array(fc.nat(1000000)),
          (sizes) => {
            const draft = {
              id: 'prop-v2',
              version: 2,
              clips: sizes.map((s, i) => ({ id: `c${i}`, fileSize: s })),
            } as unknown as DraftV2;

            const metrics = computeMetrics(draft, '/staging');
            const expectedSize = sizes.reduce((a, b) => a + b, 0);
            
            expect(metrics.sourceSize).toBe(expectedSize);
            expect(metrics.sourceCount).toBe(sizes.length);
          }
        )
      );
    });
  });

  describe('Fuzzing & Edge Cases', () => {
    it('should handle draft with missing clips (undefined)', () => {
      const draft = { id: 'fuzz-1', version: 2 } as any;
      const metrics = computeMetrics(draft, '/staging');
      expect(metrics.sourceCount).toBe(0);
      expect(metrics.sourceSize).toBe(0);
    });

    it('should handle V1 with non-existent video path', () => {
      const draft = { id: 'fuzz-2', version: 1, videoPath: '/missing' } as any;
      mockedFs.existsSync.mockReturnValue(false);
      const metrics = computeMetrics(draft, '/staging');
      expect(metrics.sourceSize).toBe(0);
    });

    it('should not crash when readdirSync fails', () => {
      const draft = { id: 'fuzz-3', version: 1 } as any;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockImplementation(() => { throw new Error('Permission denied'); });
      
      expect(() => computeMetrics(draft, '/staging')).not.toThrow();
    });
  });
});
