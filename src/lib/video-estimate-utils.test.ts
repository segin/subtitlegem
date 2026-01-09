import { formatBytes, estimateH264Size } from './video-estimate-utils';
import { REFERENCE_PIXELS } from '@/types/constants';

describe('video-estimate-utils', () => {
  
  describe('formatBytes', () => {
    it('formats 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('formats KB correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats MB correctly', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('formats GB correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('handles custom decimals', () => {
      expect(formatBytes(1500, 3)).toBe('1.465 KB');
      expect(formatBytes(1500, 0)).toBe('1 KB');
    });
  });

  describe('estimateH264Size', () => {
    // Base Case: 1080p @ CRF 23, 60s
    // Base Bitrate: 4500 Kbps (Video) + 192 (Audio) = 4692 Kbps
    // Total Bits: 4692 * 1000 * 60 = 281,520,000 bits
    // Total Bytes: 35,190,000 bytes (~33.5 MB)
    
    const BASE_1080P_PIXELS = 1920 * 1080; // Should match REFERENCE_PIXELS if using 1080p base

    it('calculates estimation for base 1080p params', () => {
      const size = estimateH264Size({
        duration: 60,
        width: 1920,
        height: 1080,
        crf: 23,
        audioBitrateKbps: 192
      });
      
      // Allow slight floating point variance
      expect(size).toBeGreaterThan(35000000); 
      expect(size).toBeLessThan(35500000);
    });

    it('returns 0 for invalid inputs', () => {
      expect(estimateH264Size({ duration: 0, width: 1920, height: 1080, crf: 23 })).toBe(0);
      expect(estimateH264Size({ duration: 60, width: 0, height: 1080, crf: 23 })).toBe(0);
    });

    it('scales linearly with resolution (720p)', () => {
      const baseSize = estimateH264Size({
        duration: 60,
        width: 1920,
        height: 1080,
        crf: 23,
        audioBitrateKbps: 0 // Exclude audio for pure video scaling check
      });

      const halfResSize = estimateH264Size({
        duration: 60, 
        width: 960,  // Half width
        height: 1080, // Same height
        crf: 23,
        audioBitrateKbps: 0
      });

      // 1920*1080 vs 960*1080 = Exactly half pixels
      // Size should be exactly half (ignoring int rounding)
      expect(Math.abs(halfResSize - (baseSize / 2))).toBeLessThan(5);
    });

    it('scales exponentially with CRF (+6 CRF = Half Size)', () => {
      const crf23 = estimateH264Size({
        duration: 60,
        width: 1920,
        height: 1080,
        crf: 23,
        audioBitrateKbps: 0
      });

      const crf29 = estimateH264Size({
        duration: 60,
        width: 1920,
        height: 1080,
        crf: 29, // +6
        audioBitrateKbps: 0
      });

      // Should be half size
      expect(Math.abs(crf29 - (crf23 / 2))).toBeLessThan(100);
    });

    it('scales exponentially with CRF (-6 CRF = Double Size)', () => {
      const crf23 = estimateH264Size({
        duration: 60,
        width: 1920,
        height: 1080,
        crf: 23,
        audioBitrateKbps: 0
      });

      const crf17 = estimateH264Size({
        duration: 60,
        width: 1920,
        height: 1080,
        crf: 17, // -6
        audioBitrateKbps: 0
      });

      // Should be double size
      expect(Math.abs(crf17 - (crf23 * 2))).toBeLessThan(100);
    });
  });
});
