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

/** Detailed hardware encoder availability per platform */
export interface HWEncoderInfo {
  platform: string;        // e.g., 'nvenc', 'amf', 'qsv'
  displayName: string;     // e.g., 'NVIDIA NVENC'
  h264: string | null;     // Encoder name if available, e.g., 'h264_nvenc'
  h265: string | null;     // Encoder name if available, e.g., 'hevc_nvenc'
  av1: string | null;      // Encoder name if available, e.g., 'av1_nvenc'
  vp9: string | null;      // Encoder name if available, e.g., 'vp9_qsv' (Intel Tiger Lake+, Arc, VAAPI)
}

export interface FFmpegCapabilities {
  version: string;
  videoEncoders: FFmpegEncoder[];
  audioEncoders: FFmpegEncoder[];
  formats: FFmpegFormat[];
  hwaccels: string[];           // Legacy: list of platform names
  hwEncoders: HWEncoderInfo[];  // New: detailed encoder availability
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
 * Broad-spectrum hardware encoder probe.
 * Tests all codecs (H.264, H.265, AV1, VP9) across all platforms in parallel.
 * Returns detailed availability info for each platform+codec combination.
 */
async function parseHwaccels(): Promise<{ hwaccels: string[]; hwEncoders: HWEncoderInfo[] }> {
  const ENCODER_TEST_TIMEOUT = 8000;
  const TEST_INPUT = '-f lavfi -i testsrc=duration=0.1:size=64x64';
  
  // Define all platforms and their encoders per codec
  const platforms: {
    name: string;
    displayName: string;
    encoders: { codec: 'h264' | 'h265' | 'av1' | 'vp9'; name: string; cmd?: string }[];
  }[] = [
    {
      name: 'nvenc',
      displayName: 'NVIDIA NVENC',
      encoders: [
        { codec: 'h264', name: 'h264_nvenc' },
        { codec: 'h265', name: 'hevc_nvenc' },
        { codec: 'av1', name: 'av1_nvenc' },  // RTX 40 series+
      ]
    },
    {
      name: 'amf',
      displayName: 'AMD AMF',
      encoders: [
        { codec: 'h264', name: 'h264_amf' },
        { codec: 'h265', name: 'hevc_amf' },
        { codec: 'av1', name: 'av1_amf' },  // RX 7000 series+
      ]
    },
    {
      name: 'qsv',
      displayName: 'Intel QuickSync',
      encoders: [
        { codec: 'h264', name: 'h264_qsv' },
        { codec: 'h265', name: 'hevc_qsv' },
        { codec: 'av1', name: 'av1_qsv' },   // Arc GPUs
        { codec: 'vp9', name: 'vp9_qsv' },
      ]
    },
    {
      name: 'videotoolbox',
      displayName: 'Apple VideoToolbox',
      encoders: [
        { codec: 'h264', name: 'h264_videotoolbox' },
        { codec: 'h265', name: 'hevc_videotoolbox' },
      ]
    },
    {
      name: 'vaapi',
      displayName: 'Linux VAAPI',
      encoders: [
        { codec: 'h264', name: 'h264_vaapi', cmd: '-init_hw_device vaapi=va:/dev/dri/renderD128 -vf format=nv12,hwupload' },
        { codec: 'h265', name: 'hevc_vaapi', cmd: '-init_hw_device vaapi=va:/dev/dri/renderD128 -vf format=nv12,hwupload' },
        { codec: 'av1', name: 'av1_vaapi', cmd: '-init_hw_device vaapi=va:/dev/dri/renderD128 -vf format=nv12,hwupload' },
        { codec: 'vp9', name: 'vp9_vaapi', cmd: '-init_hw_device vaapi=va:/dev/dri/renderD128 -vf format=nv12,hwupload' },
      ]
    },
    {
      name: 'v4l2m2m',
      displayName: 'V4L2 M2M (ARM/SBC)',
      encoders: [
        { codec: 'h264', name: 'h264_v4l2m2m' },
      ]
    },
    {
      name: 'rkmpp',
      displayName: 'Rockchip MPP',
      encoders: [
        { codec: 'h264', name: 'h264_rkmpp' },
        { codec: 'h265', name: 'hevc_rkmpp' },
      ]
    },
    {
      name: 'omx',
      displayName: 'OpenMAX (RPi)',
      encoders: [
        { codec: 'h264', name: 'h264_omx' },
      ]
    },
  ];
  
  console.log('[FFmpeg] Broad-spectrum encoder probe starting...');
  const startTime = Date.now();
  
  // Build all test tasks
  const testTasks: { platform: string; displayName: string; codec: string; encoder: string; cmd: string }[] = [];
  
  for (const platform of platforms) {
    for (const enc of platform.encoders) {
      const extraArgs = enc.cmd || '';
      const cmd = `ffmpeg ${extraArgs} ${TEST_INPUT} -c:v ${enc.name} -f null - 2>&1`;
      testTasks.push({
        platform: platform.name,
        displayName: platform.displayName,
        codec: enc.codec,
        encoder: enc.name,
        cmd,
      });
    }
  }
  
  console.log(`[FFmpeg] Testing ${testTasks.length} encoder combinations...`);
  
  // Run all tests in parallel
  const results = await Promise.all(
    testTasks.map(async (task) => {
      try {
        await execAsync(task.cmd, { timeout: ENCODER_TEST_TIMEOUT });
        console.log(`[FFmpeg] ✓ ${task.encoder}`);
        return { ...task, available: true };
      } catch {
        return { ...task, available: false };
      }
    })
  );
  
  // Aggregate results by platform
  const hwEncoders: HWEncoderInfo[] = platforms.map(platform => {
    const platformResults = results.filter(r => r.platform === platform.name);
    const h264 = platformResults.find(r => r.codec === 'h264' && r.available);
    const h265 = platformResults.find(r => r.codec === 'h265' && r.available);
    const av1 = platformResults.find(r => r.codec === 'av1' && r.available);
    const vp9 = platformResults.find(r => r.codec === 'vp9' && r.available);
    
    return {
      platform: platform.name,
      displayName: platform.displayName,
      h264: h264?.encoder || null,
      h265: h265?.encoder || null,
      av1: av1?.encoder || null,
      vp9: vp9?.encoder || null,
    };
  }).filter(info => info.h264 || info.h265 || info.av1 || info.vp9);  // Only include platforms with at least one encoder
  
  // Legacy hwaccels list (platforms with any working encoder)
  const hwaccels = hwEncoders.map(e => e.platform);
  
  console.log(`[FFmpeg] Probe complete in ${Date.now() - startTime}ms`);
  console.log(`[FFmpeg] Available platforms: ${hwaccels.length > 0 ? hwaccels.join(', ') : 'none (CPU only)'}`);
  for (const enc of hwEncoders) {
    const codecs = [enc.h264 && 'H.264', enc.h265 && 'H.265', enc.av1 && 'AV1', enc.vp9 && 'VP9'].filter(Boolean);
    console.log(`[FFmpeg]   ${enc.displayName}: ${codecs.join(', ')}`);
  }
  
  return { hwaccels, hwEncoders };
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
  
  const [version, { video, audio }, formats, { hwaccels, hwEncoders }] = await Promise.all([
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
    hwEncoders,
    probedAt: Date.now(),
  };
  
  console.log(`[FFmpeg] Probe complete in ${Date.now() - startTime}ms`);
  console.log(`[FFmpeg] Found ${video.length} video encoders, ${audio.length} audio encoders, ${formats.length} formats`);
  console.log(`[FFmpeg] Hardware platforms: ${hwaccels.join(', ') || 'none'}`);
  
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
