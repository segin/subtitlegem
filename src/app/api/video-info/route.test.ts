/**
 * @jest-environment node
 */
import { GET } from './route';
import { NextRequest } from 'next/server';
import fs from 'fs';

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('@/lib/storage-config', () => ({
  getStorageConfig: jest.fn(() => ({
    stagingDir: '/mock/staging',
  })),
  isPathSafe: jest.fn((p) => {
    if (!p) return false;
    return p.startsWith('/mock/staging') || p.startsWith(process.cwd());
  }),
}));

jest.mock('@/lib/ffmpeg-utils', () => ({
  ffprobe: jest.fn(),
}));

import { ffprobe } from '@/lib/ffmpeg-utils';

describe('/api/video-info', () => {
  const mockExistsSync = fs.existsSync as jest.Mock;
  const mockFfprobe = ffprobe as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  describe('Validation', () => {
    it('should return 400 when path is missing', async () => {
      const req = new NextRequest('http://localhost/api/video-info');

      const res = await GET(req);
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Missing path parameter');
    });

    it('should return 400 when path is empty', async () => {
      const req = new NextRequest('http://localhost/api/video-info?path=');

      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Security', () => {
    it('should block path traversal attempts', async () => {
      const maliciousPath = '../../../etc/passwd';
      const req = new NextRequest(
        `http://localhost/api/video-info?path=${encodeURIComponent(maliciousPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(403);
      
      const data = await res.json();
      expect(data.error).toBe('Unauthorized path');
    });

    it('should block absolute paths outside staging', async () => {
      const maliciousPath = '/etc/passwd';
      const req = new NextRequest(
        `http://localhost/api/video-info?path=${encodeURIComponent(maliciousPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it('should allow paths within staging directory', async () => {
      const validPath = '/mock/staging/videos/test.mp4';
      mockFfprobe.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        fps: 30,
        videoCodec: 'h264',
        audioCodec: 'aac',
        pixFmt: 'yuv420p',
      });

      const req = new NextRequest(
        `http://localhost/api/video-info?path=${encodeURIComponent(validPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Success Cases', () => {
    it('should return video metadata', async () => {
      const validPath = '/mock/staging/videos/test.mp4';
      mockFfprobe.mockResolvedValue({
        duration: 120.5,
        width: 1920,
        height: 1080,
        fps: 29.97,
        videoCodec: 'h264',
        audioCodec: 'aac',
        pixFmt: 'yuv420p',
      });

      const req = new NextRequest(
        `http://localhost/api/video-info?path=${encodeURIComponent(validPath)}`
      );

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.filename).toBe('test.mp4');
      expect(data.filePath).toContain('test.mp4');
      expect(data.duration).toBe(120.5);
      expect(data.width).toBe(1920);
      expect(data.height).toBe(1080);
      expect(data.fps).toBe(29.97);
      expect(data.videoCodec).toBe('h264');
      expect(data.audioCodec).toBe('aac');
      expect(data.pixFmt).toBe('yuv420p');
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const validPath = '/mock/staging/videos/missing.mp4';

      const req = new NextRequest(
        `http://localhost/api/video-info?path=${encodeURIComponent(validPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('File not found');
    });

    it('should return 500 when ffprobe fails', async () => {
      const validPath = '/mock/staging/videos/corrupt.mp4';
      mockFfprobe.mockRejectedValue(new Error('Invalid data found'));

      const req = new NextRequest(
        `http://localhost/api/video-info?path=${encodeURIComponent(validPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(500);
      
      const data = await res.json();
      expect(data.error).toContain('Invalid data found');
    });
  });
});
