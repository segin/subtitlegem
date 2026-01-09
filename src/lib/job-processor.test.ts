import { processJob } from './job-processor';
import { QueueItem } from './queue-manager';
import fs from 'fs';
import { burnSubtitles } from './ffmpeg-utils';
import * as ffmpegConcat from './ffmpeg-concat';

jest.mock('fs');
jest.mock('./ffmpeg-utils', () => ({
  burnSubtitles: jest.fn()
}));

// Mock dynamic import of ffmpeg-concat
// Since jest hoist mocks, we mock the module. Dynamic import() returns the module.
jest.mock('./ffmpeg-concat', () => ({
  exportMultiVideo: jest.fn()
}));

describe('job-processor', () => {
    const mockItem: QueueItem = {
        id: '1',
        status: 'pending',
        progress: 0,
        file: { name: 'v.mp4', size: 100 },
        createdAt: 0,
        metadata: {
            videoPath: '/source/v.mp4',
            assPath: '/source/s.ass',
            outputPath: '/out/v.mp4',
            ffmpegConfig: {}
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (burnSubtitles as jest.Mock).mockResolvedValue('/out/v.mp4');
    });

    test('validates metadata', async () => {
        const invalidItem = { ...mockItem, metadata: {} } as any;
        await expect(processJob(invalidItem, jest.fn()))
            .rejects.toThrow('Missing required paths');
    });

    test('validates file existence', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        await expect(processJob(mockItem, jest.fn()))
            .rejects.toThrow('Source video not found');
    });

    test('runs burnSubtitles for single video', async () => {
        const onProgress = jest.fn();
        const result = await processJob(mockItem, onProgress);
        
        expect(burnSubtitles).toHaveBeenCalledWith(
            '/source/v.mp4',
            '/source/s.ass',
            '/out/v.mp4',
            expect.any(Object)
        );
        expect(result.videoPath).toBe('/out/v.mp4');
    });

    test('runs exportMultiVideo for multi-export type', async () => {
        const multiItem: QueueItem = {
            ...mockItem,
            metadata: {
                ...mockItem.metadata,
                type: 'multi-export',
                projectState: { clips: [] }
            }
        };

        const onProgress = jest.fn();
        (ffmpegConcat.exportMultiVideo as jest.Mock).mockResolvedValue('/out/multi.mp4');

        const result = await processJob(multiItem, onProgress);

        expect(ffmpegConcat.exportMultiVideo).toHaveBeenCalled();
        expect(result.videoPath).toBe('/out/multi.mp4');
    });
});
