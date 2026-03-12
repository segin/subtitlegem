/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { promises as fsPromises } from 'fs';

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
  },
}));

jest.mock('@/lib/storage-config', () => ({
  getStorageConfig: jest.fn(() => ({
    stagingDir: '/mock/staging',
  })),
}));

jest.mock('@/lib/storage-utils', () => ({
  getDirectorySize: jest.fn(() => 1024),
}));

describe('/api/cleanup', () => {
  const mockAccess = fsPromises.access as jest.Mock;
  const mockReaddir = fsPromises.readdir as jest.Mock;
  const mockStat = fsPromises.stat as jest.Mock;
  const mockUnlink = fsPromises.unlink as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockResolvedValue(undefined);
  });

  describe('Validation', () => {
    it('should return 400 for invalid target type', async () => {
      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'invalid' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for missing body', async () => {
      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should accept valid target types', async () => {
      for (const target of ['temp', 'drafts', 'video']) {
        const req = new NextRequest('http://localhost/api/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Specific File Deletion', () => {
    it('should delete specified files and return count', async () => {
      mockAccess.mockResolvedValue(undefined);

      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'temp',
          fileIds: ['file1.mp4', 'file2.mp4'],
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deletedCount).toBe(2);
      expect(data.currentSize).toBe(1024);
      expect(mockUnlink).toHaveBeenCalledTimes(2);
    });

    it('should handle missing files gracefully', async () => {
      mockAccess.mockResolvedValueOnce(undefined) // directory exists
        .mockRejectedValueOnce(new Error('ENOENT')) // file1 missing
        .mockResolvedValueOnce(undefined); // file2 exists

      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'temp',
          fileIds: ['missing.mp4', 'exists.mp4'],
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deletedCount).toBe(1);
    });

    it('should capture errors during deletion', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockUnlink.mockRejectedValueOnce(new Error('Permission denied'));

      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'temp',
          fileIds: ['protected.mp4'],
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deletedCount).toBe(0);
      expect(data.errors).toContain('Failed to delete protected.mp4: Permission denied');
    });
  });

  describe('Bulk Cleanup by Age', () => {
    it('should delete files older than specified hours', async () => {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);
      const thirtyMinutesAgo = now - (30 * 60 * 1000);

      mockReaddir.mockResolvedValue(['old.mp4', 'recent.mp4']);
      mockStat
        .mockResolvedValueOnce({ mtimeMs: twoHoursAgo }) // old.mp4
        .mockResolvedValueOnce({ mtimeMs: thirtyMinutesAgo }); // recent.mp4

      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'temp',
          olderThanHours: 1,
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deletedCount).toBe(1);
      expect(data.currentSize).toBe(1024);
      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should return 0 deleted when directory does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'temp' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.deletedCount).toBe(0);
      expect(data.message).toBe('Directory does not exist');
    });

    it('should sanitize file names to prevent path traversal', async () => {
      mockAccess.mockResolvedValue(undefined);

      const req = new NextRequest('http://localhost/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'temp',
          fileIds: ['../../../etc/passwd'],
        }),
      });

      const res = await POST(req);

      // Should use basename only, so won't find the file
      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining('passwd')
      );
      expect(mockUnlink).not.toHaveBeenCalledWith(
        expect.stringContaining('../')
      );
    });
  });
});
