import { processWithFallback } from './ai-provider';
import * as gemini from './gemini';

// Mock the gemini module
jest.mock('./gemini', () => ({
  generateSubtitles: jest.fn(),
  translateSubtitles: jest.fn(),
  generateSubtitlesInline: jest.fn()
}));

// Mock console to keep output clean
global.console.warn = jest.fn();
global.console.error = jest.fn();
global.console.log = jest.fn();

describe('ai-provider', () => {
  const mockParams = {
    fileUri: 'gs://test',
    mimeType: 'audio/mp3'
  };

  const geminiConfig: any = {
    id: '1', provider: 'gemini', modelName: 'gemini-pro', enabled: true
  };
  
  const openaiConfig: any = {
    id: '2', provider: 'openai', modelName: 'whisper-1', enabled: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processWithFallback', () => {
    test('succeeds with first provider if it works', async () => {
      (gemini.generateSubtitles as jest.Mock).mockResolvedValue({
        detectedLanguage: 'en',
        subtitles: [{id: '1', startTime: 0, endTime: 1, text: 'test'}]
      });

      const result = await processWithFallback('generate', mockParams, [geminiConfig]);

      expect(result.provider).toBe('gemini');
      expect(result.subtitles).toHaveLength(1);
      expect(gemini.generateSubtitles).toHaveBeenCalledTimes(1);
    });

    test('falls back to second provider on safety error', async () => {
      // First provider fails with safety error
      (gemini.generateSubtitles as jest.Mock).mockRejectedValue(new Error('Candidate was blocked due to safety'));
      
      // We need a second provider. Let's use a 2nd gemini config for simplicity of mocking
      const geminifallback = { ...geminiConfig, id: '2', modelName: 'gemini-fallback' };
      
      // Mock implementation to return success on second call
      (gemini.generateSubtitles as jest.Mock)
        .mockRejectedValueOnce(new Error('Candidate was blocked due to safety'))
        .mockResolvedValueOnce({
           detectedLanguage: 'en',
           subtitles: [{id: '1', startTime: 0, endTime: 1, text: 'fallback'}]
        });

      const result = await processWithFallback('generate', mockParams, [geminiConfig, geminifallback]);

      expect(result.provider).toBe('gemini');
      expect(result.modelName).toBe('gemini-fallback');
      expect(gemini.generateSubtitles).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Safety refusal'));
    });

    test('throws if all providers fail', async () => {
       (gemini.generateSubtitles as jest.Mock).mockRejectedValue(new Error('Fatal error'));

       await expect(processWithFallback('generate', mockParams, [geminiConfig]))
         .rejects.toThrow('Fatal error');
    });
  });
});
