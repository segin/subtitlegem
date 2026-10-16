/**
 * @jest-environment node
 */
import { normalizeGeneratedSubtitles, mergeTranslatedSubtitles } from './ai-output';
import { SubtitleLine } from '@/types/subtitle';

describe('normalizeGeneratedSubtitles', () => {
  it('converts Gemini string timestamps to seconds and assigns unique IDs', () => {
    const result = normalizeGeneratedSubtitles([
      { startTime: '00:01:30,500', endTime: '00:01:32,000', text: 'Hello', secondaryText: 'Hola' },
      { startTime: '01:00:00,000', endTime: '01:00:01,250', text: 'Later' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ startTime: 90.5, endTime: 92, text: 'Hello', secondaryText: 'Hola' });
    expect(result[1]).toMatchObject({ startTime: 3600, endTime: 3601.25, text: 'Later' });
    expect(result[1].secondaryText).toBeUndefined();
    expect(result[0].id).toBeTruthy();
    expect(result[0].id).not.toBe(result[1].id);
  });

  it('accepts numeric times (e.g. Whisper output)', () => {
    const [line] = normalizeGeneratedSubtitles([{ startTime: 1.5, endTime: 3, text: 'x' }]);
    expect(line).toMatchObject({ startTime: 1.5, endTime: 3 });
  });

  it('drops non-object entries and repairs bad times', () => {
    const result = normalizeGeneratedSubtitles([
      null, 'junk', 42,
      { startTime: '00:00:05,000', endTime: '00:00:02,000', text: 'end before start' },
      { startTime: -4, endTime: Number.NaN },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ startTime: 5, endTime: 5 });
    expect(result[1]).toMatchObject({ startTime: 0, endTime: 0, text: '' });
  });

  it('returns an empty list for non-array input', () => {
    expect(normalizeGeneratedSubtitles(undefined)).toEqual([]);
    expect(normalizeGeneratedSubtitles({ subtitles: [] })).toEqual([]);
  });
});

describe('mergeTranslatedSubtitles', () => {
  const source: SubtitleLine[] = [
    { id: 'a', startTime: 1, endTime: 2, text: 'one', clipId: 'tl-1', primaryColor: '#ff0000' },
    { id: 'b', startTime: 3, endTime: 4, text: 'two', secondaryText: 'old' },
  ];

  it('takes only secondaryText from the AI and keeps IDs, timing, clip and styling', () => {
    const merged = mergeTranslatedSubtitles(source, [
      { startTime: '00:00:09,000', endTime: '00:00:10,000', text: 'ONE?', secondaryText: 'uno' },
      { startTime: '00:00:03,000', endTime: '00:00:04,000', text: 'two', secondaryText: 'dos' },
    ]);

    expect(merged).toEqual([
      { ...source[0], secondaryText: 'uno' },
      { ...source[1], secondaryText: 'dos' },
    ]);
  });

  it('keeps the existing line when the AI omits a translation', () => {
    const merged = mergeTranslatedSubtitles(source, [{ text: 'one' }, null]);
    expect(merged).toEqual(source);
  });

  it('throws on a line-count mismatch instead of misaligning translations', () => {
    expect(() => mergeTranslatedSubtitles(source, [{ secondaryText: 'uno' }]))
      .toThrow('Translation returned 1 lines for 2 input lines');
    expect(() => mergeTranslatedSubtitles(source, 'nope')).toThrow('Translation returned 0 lines');
  });
});
