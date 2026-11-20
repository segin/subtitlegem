import { applyReprocessedSubtitles } from './reprocess-utils';
import { SubtitleLine } from '@/types/subtitle';

const line = (id: string, start: number, end: number, text: string, extra: Partial<SubtitleLine> = {}): SubtitleLine =>
  ({ id, startTime: start, endTime: end, text, ...extra });

describe('applyReprocessedSubtitles', () => {
  const single = () => '';

  it('replaces a single-video project\'s lines', () => {
    const current = [line('a', 0, 2, 'old a'), line('b', 3, 5, 'old b')];
    const result = applyReprocessedSubtitles(current, [
      { videoClipId: '', subtitles: [line('n1', 0, 1, 'new 1'), line('n2', 1, 2, 'new 2')] },
    ], 'replace', single);

    expect(result.map(l => l.text)).toEqual(['new 1', 'new 2']);
    expect(result[0]).not.toHaveProperty('clipId');
  });

  it('replaces only the reprocessed clips in a multi-video project, in place', () => {
    const timelineToVideo: Record<string, string> = { t1: 'v1', t2: 'v2' };
    const current = [
      line('a', 0, 2, 'clip 1', { clipId: 't1' }),
      line('b', 0, 2, 'clip 2 old', { clipId: 't2' }),
      line('c', 3, 4, 'clip 2 old too', { clipId: 't2' }),
    ];
    const result = applyReprocessedSubtitles(current, [
      { videoClipId: 'v2', lineClipId: 't2', subtitles: [line('n', 1, 2, 'clip 2 new')] },
    ], 'replace', l => timelineToVideo[l.clipId!]);

    expect(result.map(l => [l.text, l.clipId])).toEqual([['clip 1', 't1'], ['clip 2 new', 't2']]);
  });

  it('adds new lines for a clip that had none', () => {
    const result = applyReprocessedSubtitles([], [
      { videoClipId: 'v1', lineClipId: 't1', subtitles: [line('n', 0, 1, 'hello')] },
    ], 'replace', () => 'v1');
    expect(result).toEqual([line('n', 0, 1, 'hello', { clipId: 't1' })]);
  });

  it('"update text only" keeps timing and styling and takes the best-overlapping new text', () => {
    const current = [
      line('a', 0, 4, 'old a', { styleOverrides: { color: '#ff0000' } }),
      line('b', 5, 8, 'old b', { secondaryText: 'kept translation' }),
      line('c', 20, 22, 'nothing new here'),
    ];
    const fresh = [
      line('n1', 0, 2, 'New'),
      line('n2', 2, 4.5, 'text.', { secondaryText: 'translated' }),
      line('n3', 4.6, 7, 'Second line'),
      line('n4', 30, 31, 'speech no line covers'),
    ];
    const result = applyReprocessedSubtitles(current, [{ videoClipId: '', subtitles: fresh }], 'merge', single);

    expect(result).toEqual([
      line('a', 0, 4, 'New text.', { styleOverrides: { color: '#ff0000' }, secondaryText: 'translated' }),
      line('b', 5, 8, 'Second line', { secondaryText: 'kept translation' }),
      line('c', 20, 22, 'nothing new here'),
    ]);
  });

  it('does not merge gap placeholders into existing lines', () => {
    const result = applyReprocessedSubtitles(
      [line('a', 0, 10, 'keep me')],
      [{ videoClipId: '', subtitles: [line('p', 0, 10, '[Subtitles missing ...]', { placeholder: true })] }],
      'merge', single
    );
    expect(result[0].text).toBe('keep me');
  });
});
