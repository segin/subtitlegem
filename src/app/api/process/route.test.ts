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

jest.mock('@/lib/auth', () => ({
  validateAuth: jest.fn(() => true),
}));

jest.mock('@/lib/gemini', () => ({
  uploadToGemini: jest.fn(),
}));

jest.mock('@/lib/ffmpeg-utils', () => ({
  extractAudio: jest.fn(),
  getAudioCodec: jest.fn(),
  ffprobe: jest.fn(),
}));

jest.mock('@/lib/audio-transcription', () => ({
  transcribeAudio: jest.fn(),
}));

// Mock Busboy (we won't use it in these tests, but it's initialized)
jest.mock('busboy', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
    }));
});

import { processWithFallback } from '@/lib/ai-provider';
import { uploadToGemini } from '@/lib/gemini';
import { isPathSafe } from '@/lib/storage-config';
import { ffprobe } from '@/lib/ffmpeg-utils';
import { transcribeAudio } from '@/lib/audio-transcription';

describe('/api/process (JSON modes)', () => {
  const mockProcess = processWithFallback as jest.Mock;
  const mockUpload = uploadToGemini as jest.Mock;
  const mockFfprobe = ffprobe as jest.Mock;
  const mockTranscribe = transcribeAudio as jest.Mock;

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

    it('transcribes a local file in audio pieces with the chosen model and hints', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        mockFfprobe.mockResolvedValue({ duration: 6738.8 });
        mockTranscribe.mockResolvedValue({
            subtitles: [{ id: '1', startTime: 1, endTime: 2, text: 'test' }],
            detectedLanguage: 'Russian',
            gaps: [{ start: 2700, end: 3000, reason: 'prompt blocked: OTHER' }],
        });

        const req = new NextRequest('http://localhost/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'reprocess',
                filePath: '/mock/staging/file.mp4',
                model: 'gemini-3.1-pro-preview',
                secondaryLanguage: 'English',
                promptHints: 'Speaker: Neptune',
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(mockTranscribe).toHaveBeenCalledWith(expect.objectContaining({
            sourcePath: '/mock/staging/file.mp4',
            duration: 6738.8,
            modelName: 'gemini-3.1-pro-preview',
            secondaryLanguage: 'English',
            promptHints: 'Speaker: Neptune',
        }));
        expect(mockUpload).not.toHaveBeenCalled(); // no Files API upload that expires
        expect(data.subtitles).toHaveLength(1);
        expect(data.detectedLanguage).toBe('Russian');
        expect(data.subtitleWarning).toBe('No subtitles for 0:45-0:50: Gemini would not transcribe that part');
    });

    it('previews only the first sampleDuration seconds', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        mockFfprobe.mockResolvedValue({ duration: 6738.8 });
        mockTranscribe.mockResolvedValue({ subtitles: [], gaps: [] });

        const req = new NextRequest('http://localhost/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'reprocess', filePath: '/mock/staging/file.mp4', sampleDuration: 10, secondaryLanguage: 'None' }),
        });

        expect((await POST(req)).status).toBe(200);
        expect(mockTranscribe).toHaveBeenCalledWith(expect.objectContaining({ duration: 10, secondaryLanguage: undefined }));
    });

    it('reports a missing source file', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        const req = new NextRequest('http://localhost/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'reprocess', filePath: '/mock/staging/gone.mp4' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(404);
        expect(mockTranscribe).not.toHaveBeenCalled();
    });

    it('should block unsafe filePath even with sampleDuration', async () => {
      (isPathSafe as jest.Mock).mockReturnValue(false);

      const req = new NextRequest('http://localhost/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'reprocess',
          filePath: '/etc/passwd',
          sampleDuration: 10
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Unauthorized path');
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
           subtitles: [{id: '1', text: 'test', startTime: 0, endTime: 10}],
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

