/**
 * FFmpeg Capability Probing
 * 
 * Probes the locally installed FFmpeg to detect available:
 * - Video encoders (h264, h265, vp9, av1, etc.)
 * - Audio encoders (aac, mp3, opus, flac, etc.)
 * - Container formats (mp4, mkv, webm, mov, etc.)
 * - Hardware acceleration (nvenc, qsv, videotoolbox, vaapi)
 * 
 * Results are cached in memory (not persisted to disk).
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FFmpegEncoder {
  name: string;
  type: 'video' | 'audio';
  description: string;
  isHardware: boolean;
}

export interface FFmpegFormat {
  name: string;
  description: string;
  canMux: boolean;
  canDemux: boolean;
}

export interface FFmpegCapabilities {
  version: string;
  videoEncoders: FFmpegEncoder[];
  audioEncoders: FFmpegEncoder[];
  formats: FFmpegFormat[];
  hwaccels: string[];
  probedAt: number;
}

// In-memory cache
let cachedCapabilities: FFmpegCapabilities | null = null;

/**
 * Parse the output of `ffmpeg -encoders` to extract available encoders
 */
async function parseEncoders(): Promise<{ video: FFmpegEncoder[], audio: FFmpegEncoder[] }> {
  const video: FFmpegEncoder[] = [];
  const audio: FFmpegEncoder[] = [];
  
  try {
    const { stdout } = await execAsync('ffmpeg -encoders -hide_banner 2>/dev/null');
    const lines = stdout.split('\n');
    
    // Skip header lines until we hit "------"
    let started = false;
    for (const line of lines) {
      if (line.includes('------')) {
        started = true;
        continue;
      }
      if (!started) continue;
      
      // Format: " V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC"
      // First char: V=video, A=audio, S=subtitle
      const match = line.match(/^\s*([VAS])([.F])([.S])([.X])([.B])([.D])\s+(\S+)\s+(.+)$/);
      if (match) {
        const [, type, , , , , , name, description] = match;
        const isHardware = name.includes('nvenc') || name.includes('qsv') || 
                          name.includes('videotoolbox') || name.includes('vaapi') ||
                          name.includes('amf') || name.includes('v4l2m2m');
        
        const encoder: FFmpegEncoder = {
          name,
          type: type === 'V' ? 'video' : 'audio',
          description: description.trim(),
          isHardware,
        };
        
        if (type === 'V') {
          video.push(encoder);
        } else if (type === 'A') {
          audio.push(encoder);
        }
      }
    }
  } catch (error) {
    console.error('Failed to parse FFmpeg encoders:', error);
  }
  
  return { video, audio };
}

/**
 * Parse the output of `ffmpeg -formats` to extract available formats
 */
async function parseFormats(): Promise<FFmpegFormat[]> {
  const formats: FFmpegFormat[] = [];
  
  try {
    const { stdout } = await execAsync('ffmpeg -formats -hide_banner 2>/dev/null');
    const lines = stdout.split('\n');
    
    let started = false;
    for (const line of lines) {
      if (line.includes('--')) {
        started = true;
        continue;
      }
      if (!started) continue;
      
      // Format: " DE mp4             MP4 (MPEG-4 Part 14)"
      const match = line.match(/^\s*([D ])([E ])\s+(\S+)\s+(.+)$/);
      if (match) {
        const [, demux, mux, name, description] = match;
        formats.push({
          name,
          description: description.trim(),
          canDemux: demux === 'D',
          canMux: mux === 'E',
        });
      }
    }
  } catch (error) {
    console.error('Failed to parse FFmpeg formats:', error);
  }
  
  return formats;
}

/**
 * Get available hardware acceleration methods by testing actual encoder availability.
 * Simply listing hwaccels isn't enough - we need to verify the encoders work.
 */
async function parseHwaccels(): Promise<string[]> {
  const ENCODER_TEST_TIMEOUT = 8000; // 8 seconds for encoder tests
  
  // Map of hwaccel name to test encoder commands (multiple fallbacks)
  const hwaccelTests: { name: string; displayName: string; tests: string[] }[] = [
    { 
      name: 'nvenc',
      displayName: 'NVIDIA NVENC',
      tests: [
        'ffmpeg -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_nvenc -f null -',
        'ffmpeg -f lavfi -i color=black:size=64x64:duration=0.1 -c:v h264_nvenc -f null -',
      ]
    },
    { 
      name: 'amf',
      displayName: 'AMD AMF',
      tests: [
        'ffmpeg -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_amf -f null -',
      ]
    },
    { 
      name: 'qsv',
      displayName: 'Intel QuickSync',
      tests: [
        'ffmpeg -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_qsv -f null -',
        'ffmpeg -init_hw_device qsv=hw -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_qsv -f null -',
      ]
    },
    { 
      name: 'videotoolbox',
      displayName: 'Apple VideoToolbox',
      tests: [
        'ffmpeg -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_videotoolbox -f null -',
      ]
    },
    { 
      name: 'vaapi',
      displayName: 'Linux VAAPI',
      tests: [
        // Try multiple common VAAPI device paths
        'ffmpeg -init_hw_device vaapi=va:/dev/dri/renderD128 -f lavfi -i testsrc=duration=0.1:size=64x64 -vf format=nv12,hwupload -c:v h264_vaapi -f null -',
        'ffmpeg -init_hw_device vaapi=va:/dev/dri/renderD129 -f lavfi -i testsrc=duration=0.1:size=64x64 -vf format=nv12,hwupload -c:v h264_vaapi -f null -',
        'ffmpeg -vaapi_device /dev/dri/renderD128 -f lavfi -i testsrc=duration=0.1:size=64x64 -vf format=nv12,hwupload -c:v h264_vaapi -f null -',
      ]
    },
    { 
      name: 'v4l2m2m',
      displayName: 'V4L2 M2M (Generic ARM/SBC)',
      tests: [
        'ffmpeg -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_v4l2m2m -f null -',
      ]
    },
    { 
      name: 'rkmpp',
      displayName: 'Rockchip MPP (RK3399/RK3588)',
      tests: [
        // Rockchip boards with Mali GPU use RKMPP for encoding
        'ffmpeg -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_rkmpp -f null -',
      ]
    },
    { 
      name: 'omx',
      displayName: 'OpenMAX (Raspberry Pi/embedded)',
      tests: [
        // Raspberry Pi and some other embedded devices use OMX
        'ffmpeg -f lavfi -i testsrc=duration=0.1:size=64x64 -c:v h264_omx -f null -',
      ]
    },
  ];
  
  console.log('[FFmpeg] Testing hardware acceleration availability...');
  
  // Test each encoder in parallel
  const results = await Promise.all(
    hwaccelTests.map(async ({ name, displayName, tests }) => {
      // Try each test command until one succeeds
      for (const test of tests) {
        try {
          await execAsync(test, { timeout: ENCODER_TEST_TIMEOUT });
          console.log(`[FFmpeg] ✓ ${displayName} (${name}) is available`);
          return name;
        } catch (error: any) {
          // Continue to next test command
        }
      }
      console.log(`[FFmpeg] ✗ ${displayName} (${name}) not available`);
      return null;
    })
  );
  
  const available = results.filter((r): r is string => r !== null);
  console.log(`[FFmpeg] Available hardware acceleration: ${available.length > 0 ? available.join(', ') : 'none (CPU only)'}`);
  
  return available;
}

/**
 * Get FFmpeg version
 */
async function getVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('ffmpeg -version 2>/dev/null | head -1');
    const match = stdout.match(/ffmpeg version (\S+)/);
    return match ? match[1] : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Probe FFmpeg capabilities. Results are cached in memory.
 * Call with force=true to refresh the cache.
 */
export async function probeFFmpeg(force: boolean = false): Promise<FFmpegCapabilities> {
  if (cachedCapabilities && !force) {
    return cachedCapabilities;
  }
  
  console.log('[FFmpeg] Probing capabilities...');
  const startTime = Date.now();
  
  const [version, { video, audio }, formats, hwaccels] = await Promise.all([
    getVersion(),
    parseEncoders(),
    parseFormats(),
    parseHwaccels(),
  ]);
  
  cachedCapabilities = {
    version,
    videoEncoders: video,
    audioEncoders: audio,
    formats,
    hwaccels,
    probedAt: Date.now(),
  };
  
  console.log(`[FFmpeg] Probe complete in ${Date.now() - startTime}ms`);
  console.log(`[FFmpeg] Found ${video.length} video encoders, ${audio.length} audio encoders, ${formats.length} formats`);
  console.log(`[FFmpeg] Hardware acceleration: ${hwaccels.join(', ') || 'none'}`);
  
  return cachedCapabilities;
}

/**
 * Get cached capabilities without re-probing.
 * Returns null if not yet probed.
 */
export function getCachedCapabilities(): FFmpegCapabilities | null {
  return cachedCapabilities;
}

/**
 * Get commonly used video encoders from available options
 */
export function getPreferredVideoEncoders(capabilities: FFmpegCapabilities): FFmpegEncoder[] {
  const preferred = ['libx264', 'libx265', 'h264_nvenc', 'hevc_nvenc', 'h264_qsv', 
                     'hevc_qsv', 'h264_videotoolbox', 'libvpx-vp9', 'libaom-av1', 'libsvtav1'];
  
  return preferred
    .map(name => capabilities.videoEncoders.find(e => e.name === name))
    .filter((e): e is FFmpegEncoder => e !== undefined);
}

/**
 * Get commonly used audio encoders from available options
 */
export function getPreferredAudioEncoders(capabilities: FFmpegCapabilities): FFmpegEncoder[] {
  const preferred = ['aac', 'libfdk_aac', 'libmp3lame', 'libopus', 'flac', 'pcm_s16le'];
  
  return preferred
    .map(name => capabilities.audioEncoders.find(e => e.name === name))
    .filter((e): e is FFmpegEncoder => e !== undefined);
}

/**
 * Get commonly used output formats from available options
 */
export function getPreferredFormats(capabilities: FFmpegCapabilities): FFmpegFormat[] {
  const preferred = ['mp4', 'matroska', 'webm', 'mov', 'avi', 'flv'];
  
  return preferred
    .map(name => capabilities.formats.find(f => f.name === name && f.canMux))
    .filter((f): f is FFmpegFormat => f !== undefined);
}
