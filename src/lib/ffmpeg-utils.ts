import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

export interface BurnOptions {
  hwaccel?: 'nvenc' | 'qsv' | 'videotoolbox' | 'none';
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf?: number; // 0-51, 23 is default
  onProgress?: (progress: number, details: any) => void;
}

export async function getAudioCodec(filePath: string): Promise<string> {
  // ... existing code
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  // ... existing code
}

// Overhauled burnSubtitles function
export function burnSubtitles(videoPath: string, srtPath: string, outputPath: string, options: BurnOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { 
      hwaccel = 'none', 
      preset = 'veryfast', 
      crf = 23, 
      onProgress 
    } = options;

    const command: FfmpegCommand = ffmpeg(videoPath);

    // --- Input & Hardware Acceleration ---
    // Note: Actual hwaccel options depend on ffmpeg build & system
    if (hwaccel === 'videotoolbox') { // macOS
      command.inputOptions('-hwaccel videotoolbox');
    } else if (hwaccel === 'qsv') { // Intel
      command.inputOptions('-hwaccel qsv');
    }

    // --- Video Filters ---
    // ASS format supports more styling than SRT. We use SRT for simplicity, 
    // but ffmpeg converts it to ASS internally.
    const subtitlesFilter = `subtitles=${srtPath}`;
    command.videoFilter(subtitlesFilter);

    // --- Encoding & Output Options ---
    let videoCodec = 'libx264'; // Default CPU encoder
    
    if (hwaccel === 'nvenc') { // NVIDIA
      videoCodec = 'h264_nvenc';
    } else if (hwaccel === 'qsv') { // Intel
      videoCodec = 'h264_qsv';
    } else if (hwaccel === 'videotoolbox') { // macOS
      videoCodec = 'h264_videotoolbox';
    }

    command.videoCodec(videoCodec);

    if (videoCodec === 'libx264') {
      command.outputOptions([
        `-preset ${preset}`,
        `-crf ${crf}`,
      ]);
    }

    // Copy audio track to avoid re-encoding
    command.audioCodec('copy');

    // --- Event Handling ---
    let totalDuration = 0;
    
    command
      .on('start', (commandLine) => {
        console.log('Spawning Ffmpeg with command: ' + commandLine);
      })
      .on('codecData', (data) => {
        // Get total duration of video
        totalDuration = parseFloat(data.duration.replace(/:/g, ''));
      })
      .on('progress', (progress) => {
        if (onProgress && totalDuration > 0) {
          const currentTime = parseFloat(progress.timemark.replace(/:/g, ''));
          const percent = (currentTime / totalDuration) * 100;
          onProgress(percent, progress);
        }
      })
      .on('end', (stdout, stderr) => {
        console.log('Ffmpeg finished successfully.');
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Ffmpeg error:', err.message);
        console.error('ffmpeg stderr:', stderr);
        reject(new Error(`Ffmpeg failed: ${err.message}`));
      });
      
    // --- Save ---
    command.save(outputPath);
  });
}