/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import fs from 'fs';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
  createWriteStream: jest.fn(),
  unlinkSync: jest.fn(),
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

jest.mock('@/lib/global-settings-store', () => ({
  getGlobalSettings: jest.fn(() => ({
    aiFallbackChain: ['gemini'],
  })),
}));

jest.mock('@/lib/ai-provider', () => ({
  processWithFallback: jest.fn(),
}));

jest.mock('@/lib/gemini', () => ({
  uploadToGemini: jest.fn(),
}));

jest.mock('@/lib/ffmpeg-utils', () => ({
  extractAudio: jest.fn(),
  getAudioCodec: jest.fn(),
}));

// Mock Busboy (we won't use it in these tests, but it's initialized)
jest.mock('busboy', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
    }));
});

import { processWithFallback } from '@/lib/ai-provider';
import { uploadToGemini } from '@/lib/gemini';

describe('/api/process (JSON modes)', () => {
  const mockProcess = processWithFallback as jest.Mock;
  const mockUpload = uploadToGemini as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Reprocess Mode', () => {
    it('should validate inputs', async () => {
      const req = new NextRequest('http://localhost/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'reprocess' }), // missing fileUri/filePath
      });

      const res = await POST(req);
      const data = await res.json();
      
      expect(res.status).toBe(400);
      // Zod validation returns 'Invalid request data' for schema violations
      expect(data.error).toBe('Invalid request data');
    });


    it('should handle fileUri processing', async () => {
      mockProcess.mockResolvedValue({
        subtitles: [{ id: '1', text: 'test' }],
        detectedLanguage: 'English'
      });

      const req = new NextRequest('http://localhost/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'reprocess',
          fileUri: 'gs://test/file.mp4',
          language: 'English',
          model: 'gemini-2.0'
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.subtitles).toHaveLength(1);
      expect(mockProcess).toHaveBeenCalledWith(
        'generate',
        expect.objectContaining({ fileUri: 'gs://test/file.mp4' }),
        expect.anything()
      );
    });

    it('should handle local file upload + processing', async () => {
        // Mock fs exists
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        // Mock fs stats (large file > 10MB)
        (fs.statSync as jest.Mock).mockReturnValue({ size: 20 * 1024 * 1024 });

        mockUpload.mockResolvedValue({
            uri: 'gs://new/upload.mp4',
            name: 'files/123'
        });

        mockProcess.mockResolvedValue({
            subtitles: [{ id: '1', text: 'test' }],
            detectedLanguage: 'English'
        });

        const req = new NextRequest('http://localhost/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'reprocess',
                filePath: '/mock/staging/file.mp4',
                language: 'English'
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(mockUpload).toHaveBeenCalled();
        expect(mockProcess).toHaveBeenCalledWith(
            'generate',
            expect.objectContaining({ fileUri: 'gs://new/upload.mp4' }),
            expect.anything()
        );
        expect(data.geminiFileUri).toBe('gs://new/upload.mp4');
    });
  });

  describe('Translate Mode', () => {
    it('should require subtitles', async () => {
      const req = new NextRequest('http://localhost/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'translate' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should call translate process', async () => {
       mockProcess.mockResolvedValue({
           subtitles: [{ id: '1', text: 'test', secondaryText: 'translated' }]
       });

       const req = new NextRequest('http://localhost/api/process', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           mode: 'translate',
           subtitles: [{id: '1', text: 'test'}],
           secondaryLanguage: 'Spanish'
         }),
       });

       const res = await POST(req);
       const data = await res.json();

       expect(res.status).toBe(200);
       expect(mockProcess).toHaveBeenCalledWith(
           'translate',
           expect.objectContaining({ targetLanguage: 'Spanish' }),
           expect.anything()
       );
       expect(data.subtitles[0].secondaryText).toBe('translated');
    });
  });
});
