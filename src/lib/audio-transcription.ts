/**
 * Transcribe a local media file through Gemini as small mono audio pieces.
 *
 * Shared by uploads of long recordings and by Reprocess: pieces are cut
 * straight from the file, sent inline (no Files API upload, nothing that can
 * expire), and stitched back together by generateInChunks(), which retries
 * and splits pieces Gemini refuses.
 */
import path from "path";
import { ModelConfig } from "@/types/subtitle";
import { extractAudioChunk } from "./ffmpeg-utils";
import { generateInChunks, ChunkWorker, ChunkedResult } from "./chunked-generation";
import { processWithFallback } from "./ai-provider";
import { secureDelete } from "./security";
import fs from "fs";

export interface AudioTranscriptionOptions {
  /** Media file on disk */
  sourcePath: string;
  /** Seconds of the file to transcribe from its start (its full duration, or less for a preview) */
  duration: number;
  /** Where piece files are written (and deleted again) */
  workDir: string;
  secondaryLanguage?: string;
  modelName?: string;
  promptHints?: string;
  fallbackChain: ModelConfig[];
  /** For log lines */
  label?: string;
  onProgress?: (done: number, total: number) => void;
}

export function createAudioChunkWorker(options: Omit<AudioTranscriptionOptions, 'duration' | 'label' | 'onProgress'>): ChunkWorker {
  const baseName = `${path.basename(options.sourcePath, path.extname(options.sourcePath))}_${Date.now()}`;
  const secondaryLanguage = options.secondaryLanguage && options.secondaryLanguage !== "None" ? options.secondaryLanguage : undefined;

  return {
    extract: async (chunk) => {
      const chunkPath = path.join(options.workDir, `${baseName}_part${chunk.id}.ogg`);
      await extractAudioChunk(options.sourcePath, chunkPath, chunk.start, chunk.duration);
      return { path: chunkPath, mimeType: "audio/ogg" };
    },
    generate: async (chunkPath, mimeType) => {
      const result = await processWithFallback(
        'generate',
        {
          base64Data: fs.readFileSync(chunkPath).toString('base64'),
          mimeType,
          isInline: true,
          secondaryLanguage,
          modelName: options.modelName,
          promptHints: options.promptHints,
        },
        options.fallbackChain
      );
      return { subtitles: result.subtitles, detectedLanguage: result.detectedLanguage };
    },
    cleanup: (chunkPath) => secureDelete(chunkPath).then(() => undefined),
  };
}

export async function transcribeAudio(options: AudioTranscriptionOptions): Promise<ChunkedResult> {
  if (!(options.duration > 0)) {
    throw new Error("Could not read the length of the video, so it can't be transcribed");
  }
  if (!fs.existsSync(options.workDir)) fs.mkdirSync(options.workDir, { recursive: true });
  return generateInChunks(options.duration, createAudioChunkWorker(options), {
    label: options.label,
    onProgress: options.onProgress,
  });
}
