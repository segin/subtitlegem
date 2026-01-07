import { REFERENCE_PIXELS } from '@/types/constants';

/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export interface EstimationParams {
  duration: number; // Seconds
  width: number;    // Pixels
  height: number;   // Pixels
  crf: number;      // 0-51 (libx264)
  audioBitrateKbps?: number;
}

/**
 * Estimate file size for H.264/libx264 encoded video
 * 
 * Heuristic:
 * Base: 1080p (1920x1080) @ CRF 23 ~= 4500 Kbps video bitrate
 * Scaling:
 * - Resolution: Linear with pixel count (Pixels / BasePixels)
 * - CRF: +6 CRF = Halves bitrate, -6 CRF = Doubles bitrate (Exponential base 2^(diff/6))
 * 
 * @param params EstimationParams
 * @returns Estimated size in Bytes
 */
export function estimateH264Size(params: EstimationParams): number {
  const { duration, width, height, crf, audioBitrateKbps = 192 } = params;

  if (duration <= 0 || width <= 0 || height <= 0) return 0;

  const BASE_VIDEO_BITRATE_KBPS = 4500; // 1080p @ CRF 23
  const BASE_PIXELS = REFERENCE_PIXELS;

  const currentPixels = width * height;
  const pixelRatio = currentPixels / BASE_PIXELS;

  // CRF scalar: +/- 6 CRF = half/double bitrate
  // Formula: 2 ^ ((BaseCRF - TargetCRF) / 6)
  const crfDiff = 23 - crf;
  const crfFactor = Math.pow(2, crfDiff / 6);

  // Video Bitrate
  const estimatedVideoBitrate = BASE_VIDEO_BITRATE_KBPS * pixelRatio * crfFactor;

  // Total Bitrate
  const totalBitrate = estimatedVideoBitrate + audioBitrateKbps;

  // Size = Bitrate * Duration / 8 (bits to bytes) * 1024 (Kb to bits)
  // Actually input is Kbps (KiloBITS per second)
  // Total Bits = Kbps * 1000 * Duration
  // Total Bytes = Total Bits / 8
  const totalBits = totalBitrate * 1000 * duration;
  const totalBytes = totalBits / 8;

  return Math.round(totalBytes);
}
