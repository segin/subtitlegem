import { QueueItem } from './queue-manager';
import { burnSubtitles } from './ffmpeg-utils';
import path from 'path';
import fs from 'fs';

/**
 * Process a single queue item
 * This function extracts metadata from the item and runs the appropriate FFmpeg task.
 */
export async function processJob(
  item: QueueItem,
  onProgress: (progress: number) => void
): Promise<{ videoPath: string; srtPath?: string }> {
  console.log(`[${new Date().toISOString()}] [JobProcessor] Starting job ${item.id} (${item.model})`);

  if (!item.metadata) {
    throw new Error('Job metadata missing. cannot process.');
  }

  const { videoPath, assPath, outputPath, ffmpegConfig } = item.metadata;

  // Validation
  if (!videoPath || !outputPath) {
    throw new Error('Missing required paths in job metadata');
  }

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Source video not found: ${videoPath}`);
  }

  if (assPath && !fs.existsSync(assPath)) {
     throw new Error(`Subtitle file not found: ${assPath}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Determine what operation to run
  // Currently we only support burning subtitles, but this could be expanded
  try {
     const resultPath = await burnSubtitles(
       videoPath,
       assPath || '', 
       outputPath,
       {
         ...ffmpegConfig,
         onProgress: (progress) => {
           onProgress(progress);
         }
       }
     );

     console.log(`[${new Date().toISOString()}] [JobProcessor] Job ${item.id} completed successfully`);
     
     return {
       videoPath: resultPath,
       srtPath: undefined // We don't generate a new SRT generally, usually we used the existing one
     };

  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] [JobProcessor] Job ${item.id} failed:`, error);
    throw error;
  }
}
