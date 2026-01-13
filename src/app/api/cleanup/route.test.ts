/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import fs from 'fs';

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('@/lib/storage-config', () => ({
  getStorageConfig: jest.fn(() => ({
    stagingDir: '/mock/staging',
  })),
}));

describe('/api/cleanup', () => {
  const mockExistsSync = fs.existsSync as jest.Mock;
  const mockReaddirSync = fs.readdirSync as jest.Mock;
  const mockStatSync = fs.statSync as jest.Mock;
  const mockUnlinkSync = fs.unlinkSync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
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
      mockExistsSync.mockReturnValue(true);

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
      expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
    });

    it('should handle missing files gracefully', async () => {
      mockExistsSync.mockReturnValueOnce(true) // directory exists
        .mockReturnValueOnce(false) // file1 missing
        .mockReturnValueOnce(true); // file2 exists

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
      mockExistsSync.mockReturnValue(true);
      mockUnlinkSync.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

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

      mockReaddirSync.mockReturnValue(['old.mp4', 'recent.mp4']);
      mockStatSync
        .mockReturnValueOnce({ mtimeMs: twoHoursAgo }) // old.mp4
        .mockReturnValueOnce({ mtimeMs: thirtyMinutesAgo }); // recent.mp4

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
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should return 0 deleted when directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

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
      mockExistsSync.mockReturnValue(true);

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
      expect(mockUnlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('passwd')
      );
      expect(mockUnlinkSync).not.toHaveBeenCalledWith(
        expect.stringContaining('../')
      );
    });
  });
});
