import { 
  validateVideoFile, 
  prepareUploadFormData, 
  generateClipId,
  isValidProcessingResponse 
} from './upload-utils';

describe('upload-utils', () => {
  describe('validateVideoFile', () => {
    test('returns valid for supported video file', () => {
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' });
      expect(validateVideoFile(file)).toEqual({ valid: true });
    });

    test('returns error for file too large', () => {
      // Create a mock file with size > 2GB
      const largeFile = {
        name: 'large.mp4',
        size: 3 * 1024 * 1024 * 1024,
        type: 'video/mp4',
      } as File;
      
      const result = validateVideoFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
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
