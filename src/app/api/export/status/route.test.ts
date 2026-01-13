/**
 * @jest-environment node
 */
import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/job-store', () => ({
  getJob: jest.fn(),
}));

import { getJob } from '@/lib/job-store';

describe('/api/export/status', () => {
  const mockGetJob = getJob as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('should return 400 when jobId is missing', async () => {
      const req = new NextRequest('http://localhost/api/export/status');

      const res = await GET(req);
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('jobId is required');
    });

    it('should return 400 when jobId is empty', async () => {
      const req = new NextRequest('http://localhost/api/export/status?jobId=');

      const res = await GET(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Job Lookup', () => {
    it('should return 404 when job is not found', async () => {
      mockGetJob.mockReturnValue(null);

      const req = new NextRequest('http://localhost/api/export/status?jobId=non-existent');

      const res = await GET(req);
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });

    it('should return job status when found', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'processing',
        progress: 50,
        outputPath: null,
        error: null,
        createdAt: Date.now(),
      };
      mockGetJob.mockReturnValue(mockJob);

      const req = new NextRequest('http://localhost/api/export/status?jobId=job-123');

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe('job-123');
      expect(data.status).toBe('processing');
      expect(data.progress).toBe(50);
    });

    it('should return completed job with output path', async () => {
      const mockJob = {
        id: 'job-456',
        status: 'completed',
        progress: 100,
        outputPath: '/mock/staging/temp/output.mp4',
        error: null,
        createdAt: Date.now(),
      };
      mockGetJob.mockReturnValue(mockJob);

      const req = new NextRequest('http://localhost/api/export/status?jobId=job-456');

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('completed');
      expect(data.outputPath).toBe('/mock/staging/temp/output.mp4');
    });

    it('should return failed job with error', async () => {
      const mockJob = {
        id: 'job-789',
        status: 'failed',
        progress: 0,
        outputPath: null,
        error: 'FFmpeg encoding failed',
        createdAt: Date.now(),
      };
      mockGetJob.mockReturnValue(mockJob);

      const req = new NextRequest('http://localhost/api/export/status?jobId=job-789');

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('failed');
      expect(data.error).toBe('FFmpeg encoding failed');
    });
  });
});
