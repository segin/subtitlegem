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
  lstatSync: jest.fn(),
  createReadStream: jest.fn(),
}));

jest.mock('@/lib/storage-config', () => ({
  getStorageConfig: jest.fn(() => ({
    stagingDir: '/mock/staging',
  })),
  isPathSafe: jest.fn((p) => true),
}));

describe('/api/download', () => {
  const mockExistsSync = fs.existsSync as jest.Mock;
  const mockStatSync = fs.statSync as jest.Mock;
  const mockLstatSync = (fs as any).lstatSync as jest.Mock;
  const mockCreateReadStream = fs.createReadStream as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 1024 });
    mockLstatSync.mockReturnValue({ isSymbolicLink: () => false, isFile: () => true, size: 1024 });
    
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
      mockLstatSync.mockImplementation(() => { throw new Error('ENOENT'); });
      
      const maliciousPath = '../../../etc/passwd';
      const req = new NextRequest(
        `http://localhost/api/download?path=${encodeURIComponent(maliciousPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should block absolute paths outside temp directory', async () => {
      // The route sanitizes to basename only, so file won't exist
      mockLstatSync.mockImplementation(() => { throw new Error('ENOENT'); });
      
      const maliciousPath = '/etc/passwd';
      const req = new NextRequest(
        `http://localhost/api/download?path=${encodeURIComponent(maliciousPath)}`
      );

      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should only serve files from temp directory', async () => {
      // The route constructs: path.join(tempDir, path.basename(filePath))
      const req = new NextRequest(
        `http://localhost/api/download?path=/some/other/path/video.mp4`
      );

      // Mock: file exists in temp dir
      mockLstatSync.mockImplementation((p: string) => {
        if (p.includes('/mock/staging/temp/video.mp4')) {
          return { isSymbolicLink: () => false, isFile: () => true, size: 1024 };
        }
        throw new Error('ENOENT');
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Success Cases', () => {
    it('should return file stream with correct headers', async () => {
      mockLstatSync.mockReturnValue({ isSymbolicLink: () => false, isFile: () => true, size: 2048 });

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
      mockLstatSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const req = new NextRequest(
        'http://localhost/api/download?path=missing.mp4'
      );

      const res = await GET(req);
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('File not found or access denied');
    });

    it('should return 500 on read error', async () => {
      mockLstatSync.mockReturnValue({ isSymbolicLink: () => false, isFile: () => true, size: 1024 });
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
