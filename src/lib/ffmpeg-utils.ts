/**
 * FFmpeg Utilities - Using native child_process (replaces fluent-ffmpeg)
 * 
 * This module provides FFmpeg operations using Node.js child_process.spawn
 * for better control, no deprecated dependencies, and consistent behavior.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface BurnOptions {
  hwaccel?: 'nvenc' | 'amf' | 'qsv' | 'videotoolbox' | 'vaapi' | 'v4l2m2m' | 'rkmpp' | 'omx' | 'none';
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf?: number; // 0-51, 23 is default
  resolution?: string; // 'original' or 'WIDTHxHEIGHT'
  sampleDuration?: number;
  onProgress?: (progress: number, details?: any) => void;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  audioCodec?: string;
  videoCodec?: string;
  pixFmt?: string;
  fps?: number;
}

/**
 * Safely parse frame rate string from FFprobe (e.g., "30000/1001" or "30")
 * Avoids eval() which could be exploited with malicious video metadata.
 */
export function parseFrameRate(rate: string | undefined): number | undefined {
  if (!rate || rate === '0/0') return undefined;
  
  // Handle fraction format: "30000/1001"
  if (rate.includes('/')) {
    const parts = rate.split('/');
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
    return undefined;
  }
  
  // Handle simple number format: "30"
  const parsed = parseFloat(rate);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Run ffprobe and return parsed JSON metadata
 */
export async function ffprobe(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }

      try {
        const data = JSON.parse(stdout);
        
        // Find all video streams
        const videoStreams = data.streams?.filter((s: any) => s.codec_type === 'video') || [];
        
        // Select the "best" video stream (largest resolution)
        // This handles cases where file might have a cover art stream or mjpeg thumbnail stream first
        videoStreams.sort((a: any, b: any) => {
             const resA = (a.width || 0) * (a.height || 0);
             const resB = (b.width || 0) * (b.height || 0);
             return resB - resA; // Descending
        });

        const videoStream = videoStreams[0];
        const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');
        const format = data.format || {};

        resolve({
          duration: parseFloat(format.duration) || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          audioCodec: audioStream?.codec_name,
          videoCodec: videoStream?.codec_name,
          pixFmt: videoStream?.pix_fmt,
          fps: parseFrameRate(videoStream?.r_frame_rate),
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Get audio codec from video file
 */
export async function getAudioCodec(filePath: string): Promise<string> {
  const metadata = await ffprobe(filePath);
  return metadata.audioCodec || 'unknown';
}

/**
 * Get video dimensions
 */
export async function getVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const metadata = await ffprobe(filePath);
  return { width: metadata.width, height: metadata.height };
}

/**
 * Extract audio from video file
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-vn',           // No video
      '-acodec', 'copy',
      '-y',            // Overwrite output
      outputPath
    ];

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg extractAudio failed: ${stderr}`));
      }
      resolve(outputPath);
    });

    proc.on('error', reject);
  });
}

/**
 * Parse ffmpeg progress line to get current time in seconds
 */
function parseProgressTime(line: string): number | null {
  // Example: "time=00:01:23.45"
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const centiseconds = parseInt(match[4]);
    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }
  return null;
}

/**
 * Burn subtitles into video using FFmpeg
 */
export function burnSubtitles(
  videoPath: string, 
  assPath: string, 
  outputPath: string, 
  options: BurnOptions = {}
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const { 
      hwaccel = 'none', 
      preset = 'veryfast', 
      crf = 23, 
      resolution = 'original',
      sampleDuration,
      onProgress 
    } = options;

    // Get video duration for progress calculation
    let totalDuration = 0;
    try {
      const metadata = await ffprobe(videoPath);
      totalDuration = metadata.duration;
    } catch (e) {
      console.warn('[FFmpeg] Could not get video duration for progress:', e);
    }

    // Build FFmpeg arguments
    const args: string[] = ['-i', videoPath];

    // Hardware acceleration input options
    if (hwaccel === 'videotoolbox') {
      args.unshift('-hwaccel', 'videotoolbox');
    } else if (hwaccel === 'qsv') {
      args.unshift('-hwaccel', 'qsv');
    }

    // Build video filter chain
    const videoFilters: string[] = [];

    if (resolution && resolution !== 'original' && resolution.includes('x')) {
      const [width, height] = resolution.split('x');
      videoFilters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
      videoFilters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
    }

    // Add subtitle filter (escape path for filter syntax)
    // FFmpeg filter paths need complex escaping: 
    // 1. Backslashes become forward slashes (works better across platforms)
    // 2. Colons must be escaped as \:
    // 3. The whole thing should be wrapped in single quotes if it contains special chars like commas
    const processedPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\\\\\''");
    const escapedAssPath = `'${processedPath}'`;
    
    videoFilters.push(`subtitles=${escapedAssPath}`);

    args.push('-vf', videoFilters.join(','));

    // Map hwaccel to encoder
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
    args.push('-c:v', videoCodec);

    // Encoder-specific options
    if (videoCodec === 'libx264') {
      args.push('-preset', preset);
      args.push('-crf', crf.toString());
    }

    // Copy audio
    args.push('-c:a', 'copy');

    // Sample duration (for previews)
    if (sampleDuration && sampleDuration > 0) {
      args.push('-t', sampleDuration.toString());
    }

    // Overwrite output
    args.push('-y', outputPath);

    console.log(`[${new Date().toISOString()}] Spawning FFmpeg: ffmpeg ${args.join(' ')}`);

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      stderr += line;

      // Parse progress
      if (onProgress && totalDuration > 0) {
        const currentTime = parseProgressTime(line);
        if (currentTime !== null) {
          const percent = Math.min((currentTime / totalDuration) * 100, 100);
          onProgress(percent, { timemark: line });
        }
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`[${new Date().toISOString()}] FFmpeg error:`, stderr);
        return reject(new Error(`FFmpeg failed with code ${code}`));
      }
      console.log(`[${new Date().toISOString()}] FFmpeg finished successfully.`);
      resolve(outputPath);
    });

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Create a sample clip from a video file
 */
export async function createSampleClip(
  inputPath: string,
  outputPath: string,
  durationInSeconds: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-t', durationInSeconds.toString(),
      '-c', 'copy', // Fast copy without re-encoding
      '-y',
      outputPath
    ];

    console.log(`[FFmpeg] Creating sample clip: ffmpeg ${args.join(' ')}`);
    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Fallback: if 'copy' fails (e.g. keyframe issues), try re-encoding
        console.warn(`[FFmpeg] Copy failed (${stderr}), trying re-encode...`);
        const encodeArgs = [
            '-i', inputPath,
            '-t', durationInSeconds.toString(),
            '-c:v', 'libx264', '-preset', 'ultrafast',
            '-c:a', 'copy',
            '-y',
            outputPath
        ];
        const proc2 = spawn('ffmpeg', encodeArgs);
        proc2.on('close', (code2) => {
            if (code2 !== 0) return reject(new Error(`FFmpeg sample creation failed: ${stderr}`));
            resolve(outputPath);
        });
        return;
      }
      resolve(outputPath);
    });

    proc.on('error', reject);
  });
}