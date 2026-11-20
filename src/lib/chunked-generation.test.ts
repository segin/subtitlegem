import { planChunks, shiftSubtitles, generateInChunks, describeGaps, ChunkWorker, CHUNK_SECONDS } from './chunked-generation';

describe('planChunks', () => {
  it('splits into fixed-length pieces covering the whole recording', () => {
    const chunks = planChunks(6738.8); // generation.webm: 1 h 52 min
    expect(chunks.map(c => c.start)).toEqual([0, 1200, 2400, 3600, 4800, 6000]);
    expect(chunks.map(c => c.id)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(chunks[5].duration).toBeCloseTo(738.8);
    expect(chunks.reduce((sum, c) => sum + c.duration, 0)).toBeCloseTo(6738.8);
  });

  it('folds a short final piece into the previous one', () => {
    const chunks = planChunks(2 * CHUNK_SECONDS + 60);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toEqual({ index: 1, id: '2', start: CHUNK_SECONDS, duration: CHUNK_SECONDS + 60 });
  });

  it('handles short and invalid durations', () => {
    expect(planChunks(90)).toEqual([{ index: 0, id: '1', start: 0, duration: 90 }]);
    expect(planChunks(0)).toEqual([]);
    expect(planChunks(NaN)).toEqual([]);
  });
});

describe('shiftSubtitles', () => {
  it('offsets start and end times', () => {
    expect(shiftSubtitles([{ id: 'a', startTime: 1, endTime: 2.5, text: 'x' }], 1200))
      .toEqual([{ id: 'a', startTime: 1201, endTime: 1202.5, text: 'x' }]);
  });
});

describe('generateInChunks', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const line = (text: string) => ({ id: text, startTime: 10, endTime: 12, text });

  const makeWorker = (generate: ChunkWorker['generate']) => {
    const extracted: string[] = [];
    let live = 0;
    const worker: ChunkWorker = {
      extract: async (chunk) => { extracted.push(chunk.id); live++; return { path: `/tmp/piece-${chunk.id}.ogg`, mimeType: 'audio/ogg' }; },
      generate,
      cleanup: async () => { live--; },
    };
    return { worker, extracted, live: () => live };
  };

  it('stitches pieces in order with times shifted into place', async () => {
    const { worker, live } = makeWorker(async (_path, _mime, chunk) => {
      // Finish out of order to check results are stitched by position
      await new Promise(r => setTimeout(r, (3 - chunk.index) * 5));
      return { detectedLanguage: chunk.index === 0 ? undefined : 'Russian', subtitles: [line(`piece ${chunk.index}`)] };
    });
    const progress: number[] = [];
    const result = await generateInChunks(3 * CHUNK_SECONDS, worker, { concurrency: 3, onProgress: d => progress.push(d) });

    expect(result.subtitles.map(s => [s.text, s.startTime])).toEqual([
      ['piece 0', 10], ['piece 1', 1210], ['piece 2', 2410],
    ]);
    expect(result.detectedLanguage).toBe('Russian');
    expect(result.gaps).toEqual([]);
    expect(progress).toEqual([0, 1, 2, 3]);
    expect(live()).toBe(0); // every piece's audio file deleted
  });

  it('retries a failed piece once', async () => {
    let calls = 0;
    const { worker } = makeWorker(async (_p, _m, chunk) => {
      if (chunk.index === 0 && calls++ === 0) throw new Error('Gemini returned no subtitles');
      return { subtitles: [line('ok')] };
    });
    const result = await generateInChunks(2 * CHUNK_SECONDS, worker, { concurrency: 1 });
    expect(result.subtitles).toHaveLength(2);
    expect(result.gaps).toEqual([]);
  });

  it('splits a piece that keeps failing and leaves only the refused stretch as a gap', async () => {
    // Gemini refuses anything covering 45:00
    const refused = 45 * 60;
    const { worker, extracted, live } = makeWorker(async (_p, _m, chunk) => {
      if (chunk.start <= refused && refused < chunk.start + chunk.duration) throw new Error('prompt blocked: OTHER');
      return { subtitles: [line(`ok ${chunk.id}`)] };
    });

    const result = await generateInChunks(3 * CHUNK_SECONDS, worker, { concurrency: 1 });

    // Piece 3 (40-60 min) -> 3a (40-50) fails -> 3aa (40-45) ok, 3ab (45-50) is a gap; 3b (50-60) ok
    expect(extracted).toEqual(['1', '2', '3', '3', '3a', '3a', '3aa', '3ab', '3ab', '3b']);
    expect(result.gaps).toEqual([{ start: 2700, end: 3000, reason: 'prompt blocked: OTHER' }]);
    expect(result.subtitles.map(s => s.text)).toEqual([
      'ok 1', 'ok 2', 'ok 3aa',
      '[Subtitles missing 0:45-0:50: Gemini would not transcribe this part]',
      'ok 3b',
    ]);
    expect(result.subtitles[3].startTime).toBe(2700);
    expect(describeGaps(result.gaps)).toBe('No subtitles for 0:45-0:50: Gemini would not transcribe that part');
    expect(live()).toBe(0);
  });

  it('fails when nothing at all could be transcribed', async () => {
    const { worker } = makeWorker(async () => { throw new Error('quota exceeded'); });
    await expect(generateInChunks(CHUNK_SECONDS / 2, worker)).rejects.toThrow('whole recording: quota exceeded');
  });
});
