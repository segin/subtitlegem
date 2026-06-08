import {
  REFERENCE_WIDTH,
  REFERENCE_HEIGHT,
  REFERENCE_PIXELS,
  DEFAULT_FPS,
  DEFAULT_PRIMARY_LANGUAGE,
  DEFAULT_SECONDARY_LANGUAGE,
  DEFAULT_GLOBAL_SECONDARY_LANGUAGE,
  DEFAULT_AI_MODEL
} from '@/types/constants';

describe('constants', () => {
  test('REFERENCE_WIDTH is 1920', () => {
    expect(REFERENCE_WIDTH).toBe(1920);
  });

  test('REFERENCE_HEIGHT is 1080', () => {
    expect(REFERENCE_HEIGHT).toBe(1080);
  });

  test('REFERENCE_PIXELS is the product of width and height', () => {
    expect(REFERENCE_PIXELS).toBe(REFERENCE_WIDTH * REFERENCE_HEIGHT);
    expect(REFERENCE_PIXELS).toBe(2073600);
  });

  test('DEFAULT_FPS is 30', () => {
    expect(DEFAULT_FPS).toBe(30);
  });

  test('DEFAULT_PRIMARY_LANGUAGE is English', () => {
    expect(DEFAULT_PRIMARY_LANGUAGE).toBe('English');
  });

  test('DEFAULT_SECONDARY_LANGUAGE is Secondary', () => {
    expect(DEFAULT_SECONDARY_LANGUAGE).toBe('Secondary');
  });

  test('DEFAULT_GLOBAL_SECONDARY_LANGUAGE is Simplified Chinese', () => {
    expect(DEFAULT_GLOBAL_SECONDARY_LANGUAGE).toBe('Simplified Chinese');
  });

  test('DEFAULT_AI_MODEL is gemini-2.0-flash', () => {
    expect(DEFAULT_AI_MODEL).toBe('gemini-2.0-flash');
  });
});
