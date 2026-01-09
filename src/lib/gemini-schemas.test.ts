import { subtitleSchema, translationSchema } from './gemini-schemas';

describe('gemini-schemas', () => {
  test('subtitleSchema has correct structure for AI structured output', () => {
    expect(subtitleSchema.type).toBe('OBJECT');
    expect(subtitleSchema.properties.subtitles.type).toBe('ARRAY');
    expect(subtitleSchema.required).toContain('subtitles');
    expect(subtitleSchema.required).toContain('detectedLanguage');
  });

  test('translationSchema has correct structure', () => {
    expect(translationSchema.type).toBe('OBJECT');
    expect(translationSchema.properties.subtitles.type).toBe('ARRAY');
    // Schema must require subtitles
    expect(translationSchema.required).toContain('subtitles');
  });
});
