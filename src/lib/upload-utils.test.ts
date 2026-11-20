import { 
  validateVideoFile, 
  prepareUploadFormData, 
  generateClipId,
  isValidProcessingResponse,
  describeLostConnection,
  resolveMediaMimeType,
} from './upload-utils';

describe('resolveMediaMimeType', () => {
  test('keeps a declared media type and falls back to the extension otherwise', () => {
    expect(resolveMediaMimeType('a.webm', 'video/webm')).toBe('video/webm');
    expect(resolveMediaMimeType('a.MKV', 'application/octet-stream')).toBe('video/x-matroska');
    expect(resolveMediaMimeType('a.mov', '')).toBe('video/quicktime');
    expect(resolveMediaMimeType('a.xyz', 'application/octet-stream')).toBe('application/octet-stream');
  });
});

describe('describeLostConnection', () => {
  test('points to Drafts only when the server has the whole file', () => {
    expect(describeLostConnection(true)).toContain('Drafts');
    expect(describeLostConnection(false)).toContain('try again');
  });
});

describe('upload-utils', () => {
  describe('validateVideoFile', () => {
    test('returns valid for supported video file', () => {
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      expect(validateVideoFile(file)).toEqual({ valid: true });
    });

    test('returns error for unsupported format', () => {
      const file = new File(['text'], 'test.txt', { type: 'text/plain' });
      const result = validateVideoFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    test('accepts video by extension fallback', () => {
      const file = new File(['video'], 'test.mkv', { type: '' });
      expect(validateVideoFile(file)).toEqual({ valid: true });
    });
  });

  describe('prepareUploadFormData', () => {
    test('creates FormData with file', () => {
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      const formData = prepareUploadFormData(file);
      
      expect(formData.get('video')).toBe(file);
    });

    test('includes the upload ID when given', () => {
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      expect(prepareUploadFormData(file, { uploadId: 'abc-123' }).get('uploadId')).toBe('abc-123');
      expect(prepareUploadFormData(file).get('uploadId')).toBeNull();
    });

    test('includes optional parameters', () => {
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      const formData = prepareUploadFormData(file, {
        secondaryLanguage: 'Chinese',
        model: 'gemini-2.0-flash',
        reprocess: true,
      });
      
      expect(formData.get('secondaryLanguage')).toBe('Chinese');
      expect(formData.get('model')).toBe('gemini-2.0-flash');
      expect(formData.get('reprocess')).toBe('true');
    });
  });

  describe('generateClipId', () => {
    test('generates unique IDs', () => {
      const id1 = generateClipId();
      const id2 = generateClipId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('isValidProcessingResponse', () => {
    test('returns true for valid response', () => {
      const response = {
        subtitles: [{ startTime: '00:00:01,000', endTime: '00:00:02,000', text: 'Hello' }],
        videoPath: '/path/to/video.mp4',
      };
      expect(isValidProcessingResponse(response)).toBe(true);
    });

    test('returns false for null', () => {
      expect(isValidProcessingResponse(null)).toBe(false);
    });

    test('returns false for missing subtitles', () => {
      expect(isValidProcessingResponse({ videoPath: '/path' })).toBe(false);
    });

    test('returns false for missing videoPath', () => {
      expect(isValidProcessingResponse({ subtitles: [] })).toBe(false);
    });
  });
});
