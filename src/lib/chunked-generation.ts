/**
 * Subtitle generation for long recordings, in pieces.
 *
 * Gemini's output is capped at 65,536 tokens per response. Dense speech
 * reaches that after roughly 90 minutes, so a longer recording came back cut
 * off mid-line (unparseable JSON), and the single request could run past
 * Node's fetch timeout. Long audio is therefore split into pieces that are
 * transcribed separately (a few at a time) and stitched back together.
 */
import { randomUUID } from "crypto";
import { SubtitleLine } from "@/types/subtitle";

/** Recordings longer than this are transcribed in pieces */
export const LONG_MEDIA_SECONDS = 30 * 60;
/** Length of each piece; ~20 min of dense speech is about a quarter of the output cap */
export const CHUNK_SECONDS = 20 * 60;
/** A shorter final piece is folded into the one before it */
const MIN_FINAL_CHUNK_SECONDS = 5 * 60;

export interface Chunk {
  /** Position among the top-level pieces */
  index: number;
  /** Name for logs and file names: "3", or "3a"/"3b" for the halves of a failed piece */
  id: string;
  start: number;
  duration: number;
}

export function planChunks(totalSeconds: number, chunkSeconds: number = CHUNK_SECONDS): Chunk[] {
  if (!(totalSeconds > 0)) return [];
  const chunks: Chunk[] = [];
  for (let start = 0; start < totalSeconds; start += chunkSeconds) {
    const index = chunks.length;
    chunks.push({ index, id: String(index + 1), start, duration: Math.min(chunkSeconds, totalSeconds - start) });
  }
  const last = chunks[chunks.length - 1];
  if (chunks.length > 1 && last.duration < MIN_FINAL_CHUNK_SECONDS) {
    chunks.pop();
    chunks[chunks.length - 1].duration += last.duration;
  }
  return chunks;
}

/** Move a piece's subtitles (timed from the piece's start) to their place in the whole recording */
export function shiftSubtitles(subtitles: SubtitleLine[], offsetSeconds: number): SubtitleLine[] {
  return subtitles.map(s => ({ ...s, startTime: s.startTime + offsetSeconds, endTime: s.endTime + offsetSeconds }));
}

export interface ChunkWorker {
  /** Write the given piece of the recording to an audio file */
  extract(chunk: Chunk): Promise<{ path: string; mimeType: string }>;
  /** Transcribe one audio file; times are relative to its start */
  generate(path: string, mimeType: string, chunk: Chunk): Promise<{ subtitles: SubtitleLine[]; detectedLanguage?: string }>;
  /** Delete a piece's audio file */
  cleanup(path: string): Promise<void>;
}

/** A stretch Gemini would not transcribe even in its smallest piece */
export interface SubtitleGap {
  start: number;
  end: number;
  reason: string;
}

export interface ChunkedResult {
  subtitles: SubtitleLine[];
  detectedLanguage?: string;
  /** Stretches left without subtitles; each also gets a placeholder line */
  gaps: SubtitleGap[];
}

/** A failing piece is halved and retried until pieces are this short */
const MIN_SPLIT_SECONDS = 5 * 60;

/**
 * Transcribe the recording piece by piece, `concurrency` pieces at a time.
 *
 * A failing piece is retried once, then split in half (down to 5 min) so one
 * bad stretch doesn't cost the whole recording; Gemini sometimes refuses a
 * stretch outright ("prompt blocked: OTHER"). Whatever still fails is left as
 * a gap with a visible placeholder line rather than silently missing.
 * Only if nothing at all could be transcribed does the generation fail.
 */
export async function generateInChunks(
  totalSeconds: number,
  worker: ChunkWorker,
  options: { concurrency?: number; onProgress?: (done: number, total: number) => void; label?: string } = {}
): Promise<ChunkedResult> {
  const chunks = planChunks(totalSeconds);
  const results: { subtitles: SubtitleLine[]; detectedLanguage?: string; gaps: SubtitleGap[] }[] = new Array(chunks.length);
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const label = options.label ? ` ${options.label}` : "";
  let next = 0;
  let done = 0;

  console.log(`[Chunked] Transcribing${label} (${(totalSeconds / 60).toFixed(1)} min) in ${chunks.length} pieces, ${concurrency} at a time`);
  options.onProgress?.(0, chunks.length);

  const describe = (c: Chunk) => `piece ${c.id}/${chunks.length} (${formatMinutes(c.start)}-${formatMinutes(c.start + c.duration)})`;

  /** Transcribe one stretch; subtitles come back timed from the start of the recording */
  const transcribe = async (chunk: Chunk): Promise<ChunkedResult> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let audio: { path: string; mimeType: string } | null = null;
      try {
        audio = await worker.extract(chunk);
        const result = await worker.generate(audio.path, audio.mimeType, chunk);
        return { subtitles: shiftSubtitles(result.subtitles, chunk.start), detectedLanguage: result.detectedLanguage, gaps: [] };
      } catch (error) {
        lastError = error;
        console.warn(`[Chunked] ${describe(chunk)} attempt ${attempt} failed: ${errorMessage(error)}`);
      } finally {
        if (audio) await worker.cleanup(audio.path).catch(() => {});
      }
    }

    if (chunk.duration / 2 >= MIN_SPLIT_SECONDS) {
      const half = chunk.duration / 2;
      console.warn(`[Chunked] Splitting ${describe(chunk)} in half`);
      const first = await transcribe({ ...chunk, id: `${chunk.id}a`, duration: half });
      const second = await transcribe({ ...chunk, id: `${chunk.id}b`, start: chunk.start + half, duration: chunk.duration - half });
      return {
        subtitles: [...first.subtitles, ...second.subtitles],
        detectedLanguage: first.detectedLanguage ?? second.detectedLanguage,
        gaps: [...first.gaps, ...second.gaps],
      };
    }

    const gap = { start: chunk.start, end: chunk.start + chunk.duration, reason: errorMessage(lastError) };
    console.error(`[Chunked] Giving up on ${describe(chunk)}; leaving it without subtitles: ${gap.reason}`);
    return { subtitles: [gapPlaceholder(gap)], gaps: [gap] };
  };

  const runWorker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      const startedAt = Date.now();
      const result = await transcribe(chunk);
      results[chunk.index] = result;
      done++;
      const lines = result.subtitles.length - result.gaps.length;
      console.log(`[Chunked] ${describe(chunk)} done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${lines} line(s)${result.gaps.length ? `, ${result.gaps.length} gap(s)` : ""}`);
      options.onProgress?.(done, chunks.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, runWorker));

  const gaps = results.flatMap(r => r.gaps);
  const missing = gaps.reduce((sum, g) => sum + (g.end - g.start), 0);
  if (chunks.length > 0 && missing >= totalSeconds - 0.001) {
    throw new Error(`Subtitle generation failed for the whole recording: ${gaps[0].reason}`);
  }

  return {
    subtitles: results.flatMap(r => r.subtitles),
    // The opening of a recording can be music or silence; use the first piece that detected anything
    detectedLanguage: results.find(r => r.detectedLanguage)?.detectedLanguage,
    gaps,
  };
}

/** Describe gaps for the user, e.g. "No subtitles for 0:40-0:45 (Gemini refused it)" */
export function describeGaps(gaps: SubtitleGap[]): string {
  const spans = gaps.map(g => `${formatMinutes(g.start)}-${formatMinutes(g.end)}`).join(", ");
  return `No subtitles for ${spans}: Gemini would not transcribe ${gaps.length === 1 ? "that part" : "those parts"}`;
}

function gapPlaceholder(gap: SubtitleGap): SubtitleLine {
  return {
    id: randomUUID(),
    startTime: gap.start,
    endTime: Math.min(gap.end, gap.start + 10),
    text: `[Subtitles missing ${formatMinutes(gap.start)}-${formatMinutes(gap.end)}: Gemini would not transcribe this part]`,
    placeholder: true,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
