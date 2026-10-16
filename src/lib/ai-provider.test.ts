import { processWithFallback } from './ai-provider';
import * as gemini from './gemini';
import { ModelConfig } from '@/types/subtitle';

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

  const geminiConfig: ModelConfig = {
    id: '1', provider: 'gemini', modelName: 'gemini-pro', enabled: true
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

describe('ai-provider API key scoping', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'env-secret' };
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ subtitles: [] }) } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const translateWith = (config: Partial<ModelConfig>) =>
    processWithFallback('translate', { subtitles: [], targetLanguage: 'French' }, [
      { id: 'oa', provider: 'openai', modelName: 'gpt-4o', enabled: true, ...config },
    ]).catch(() => undefined);

  const sentAuthHeader = () => fetchMock.mock.calls[0]?.[1]?.headers?.Authorization;

  test('sends the env key to the default endpoint', async () => {
    await translateWith({});
    expect(fetchMock.mock.calls[0][0]).toContain('https://api.openai.com/v1');
    expect(sentAuthHeader()).toBe('Bearer env-secret');
  });

  test('never sends the env key to a custom endpoint', async () => {
    await translateWith({ endpoint: 'https://attacker.example/v1' });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('env-secret');
  });

  test('uses an explicitly configured key with a custom endpoint', async () => {
    await translateWith({ endpoint: 'https://proxy.example/v1', apiKey: 'own-key' });
    expect(sentAuthHeader()).toBe('Bearer own-key');
  });
});

describe('ai-provider output normalization', () => {
  const geminiConfig: ModelConfig = { id: '1', provider: 'gemini', modelName: 'gemini-pro', enabled: true };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generate returns numeric times and IDs instead of raw Gemini strings', async () => {
    (gemini.generateSubtitles as jest.Mock).mockResolvedValue({
      detectedLanguage: 'en',
      subtitles: [{ startTime: '00:00:01,500', endTime: '00:00:03,000', text: 'hi' }],
    });

    const result = await processWithFallback('generate', { fileUri: 'f', mimeType: 'video/mp4' }, [geminiConfig]);

    expect(result.subtitles[0]).toMatchObject({ startTime: 1.5, endTime: 3, text: 'hi' });
    expect(typeof result.subtitles[0].id).toBe('string');
  });

  test('translate keeps the input lines and only fills in secondaryText', async () => {
    const input = [{ id: 'keep-me', startTime: 4, endTime: 5, text: 'hello', clipId: 'tl-1' }];
    (gemini.translateSubtitles as jest.Mock).mockResolvedValue([
      { startTime: '00:00:04,000', endTime: '00:00:05,000', text: 'hello', secondaryText: 'hola' },
    ]);

    const result = await processWithFallback('translate', { subtitles: input, targetLanguage: 'Spanish' }, [geminiConfig]);

    expect(result.subtitles).toEqual([{ ...input[0], secondaryText: 'hola' }]);
  });
});
