/**
 * @jest-environment node
 */
import { GET } from './route';
import { NextRequest } from 'next/server';
import fs from 'fs';

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  createReadStream: jest.fn(),
}));

jest.mock('@/lib/storage-config', () => ({
  getStorageConfig: jest.fn(() => ({
    stagingDir: '/mock/staging',
  })),
}));

describe('/api/download', () => {
  const mockExistsSync = fs.existsSync as jest.Mock;
  const mockStatSync = fs.statSync as jest.Mock;
  const mockCreateReadStream = fs.createReadStream as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 1024 });
    
    // Mock createReadStream to return a readable stream-like object
    mockCreateReadStream.mockReturnValue({
      on: jest.fn((event, callback) => {
        if (event === 'end') {
          // Simulate immediate end for testing
          setTimeout(() => callback(), 0);
        }
        return mockCreateReadStream();
      }),
      pipe: jest.fn(),
    });
  });

  describe('Validation', () => {
    it('should return 400 when path is missing', async () => {
      const req = new NextRequest('http://localhost/api/download');

      const res = await GET(req);
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('File path is required');
    });

    it('should return 400 when path is empty', async () => {
      const req = new NextRequest('http://localhost/api/download?path=');

      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Security', () => {
    it('should block path traversal attempts', async () => {
      // The route sanitizes to basename only, so file won't exist
      mockExistsSync.mockReturnValue(false);
      
      const maliciousPath = '../../../etc/passwd';
      const req = new NextRequest(
        `http://localhost/api/download?path=${encodeURIComponent(maliciousPath)}`
      );

      const res = await GET(req);
      // The route uses path.basename which sanitizes to just 'passwd'
      // Then checks if it exists in tempDir - it won't, so 404
      expect(res.status).toBe(404);
    });

    it('should block absolute paths outside temp directory', async () => {
      // The route sanitizes to basename only, so file won't exist
      mockExistsSync.mockReturnValue(false);
      
      const maliciousPath = '/etc/passwd';
      const req = new NextRequest(
        `http://localhost/api/download?path=${encodeURIComponent(maliciousPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should only serve files from temp directory', async () => {
      // The route constructs: path.join(tempDir, path.basename(filePath))
      // So even if you pass a full path, it only uses the filename
      const req = new NextRequest(
        `http://localhost/api/download?path=/some/other/path/video.mp4`
      );

      // Mock: file exists in temp dir
      mockExistsSync.mockImplementation((p: string) => 
        p === '/mock/staging/temp/video.mp4'
      );

      const res = await GET(req);
      // Will check if /mock/staging/temp/video.mp4 exists
      expect(res.status).toBe(200);
    });
  });

  describe('Success Cases', () => {
    it('should return file stream with correct headers', async () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ size: 2048 });

      const req = new NextRequest(
        'http://localhost/api/download?path=video.mp4'
      );

      const res = await GET(req);
      
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('video/mp4');
      expect(res.headers.get('Content-Length')).toBe('2048');
      expect(res.headers.get('Content-Disposition')).toContain('attachment');
      expect(res.headers.get('Content-Disposition')).toContain('video.mp4');
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const req = new NextRequest(
        'http://localhost/api/download?path=missing.mp4'
      );

      const res = await GET(req);
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('File not found or access denied');
    });

    it('should return 500 on read error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ size: 1024 });
      mockCreateReadStream.mockImplementation(() => {
        throw new Error('Read error');
      });

      const req = new NextRequest(
        'http://localhost/api/download?path=broken.mp4'
      );

      const res = await GET(req);
      expect(res.status).toBe(500);
      
      const data = await res.json();
      expect(data.error).toBe('Failed to download file');
    });
  });
});
