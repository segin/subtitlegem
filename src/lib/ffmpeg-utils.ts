import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

export interface BurnOptions {
  hwaccel?: 'nvenc' | 'amf' | 'qsv' | 'videotoolbox' | 'vaapi' | 'v4l2m2m' | 'rkmpp' | 'omx' | 'none';
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf?: number; // 0-51, 23 is default
  resolution?: string; // 'original' or 'WIDTHxHEIGHT'
  sampleDuration?: number;
  onProgress?: (progress: number, details?: any) => void;
}

export async function getAudioCodec(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve(audioStream?.codec_name || 'unknown');
    });
  });
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('copy')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

// Overhauled burnSubtitles function
export function burnSubtitles(videoPath: string, srtPath: string, outputPath: string, options: BurnOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { 
      hwaccel = 'none', 
      preset = 'veryfast', 
      crf = 23, 
      resolution = 'original',
      sampleDuration,
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

    // Video Filters: Aspect Ratio Preservation
    // ASS format supports more styling than SRT.
    let videoFilters = [];

    if (resolution && resolution !== 'original' && resolution.includes('x')) {
      const [width, height] = resolution.split('x');
      // Scale to fit within target and pad to maintain aspect ratio
      videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
      videoFilters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
    }

    videoFilters.push(`subtitles=${srtPath}`);
    command.videoFilter(videoFilters.join(','));

    // --- Encoding & Output Options ---
    // Map hwaccel to appropriate encoder
    const encoderMap: Record<string, string> = {
      nvenc: 'h264_nvenc',
      amf: 'h264_amf',
      qsv: 'h264_qsv',
      videotoolbox: 'h264_videotoolbox',
      vaapi: 'h264_vaapi',
      v4l2m2m: 'h264_v4l2m2m',
      rkmpp: 'h264_rkmpp',
      omx: 'h264_omx',
      none: 'libx264',
    };
    
    const videoCodec = encoderMap[hwaccel] || 'libx264';

    command.videoCodec(videoCodec);

    if (sampleDuration && sampleDuration > 0) {
      command.outputOptions([`-t ${sampleDuration}`]);
    }

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
        console.log(`[${new Date().toISOString()}] Spawning Ffmpeg with command: ` + commandLine);
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
        console.log(`[${new Date().toISOString()}] Ffmpeg finished successfully.`);
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error(`[${new Date().toISOString()}] Ffmpeg error:`, err.message);
        console.error('ffmpeg stderr:', stderr);
        reject(new Error(`Ffmpeg failed: ${err.message}`));
      });
      
    // --- Save ---
    command.save(outputPath);
  });
}