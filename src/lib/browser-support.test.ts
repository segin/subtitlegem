/**
 * @jest-environment jsdom
 */
import { isMetadataSupported, BrowserSupport } from './browser-support';

describe('browser-support', () => {
    const mockSupport: BrowserSupport = {
        h264: true,
        hevc: false,
        vp9: true,
        av1: false,
        aac: true,
        opus: true,
        mp4: true,
        mkv: false,
        webm: true,
        h264_10bit: false,
        hevc_10bit: false,
    };

    describe('isMetadataSupported', () => {
        it('should return true for standard H.264', () => {
            const metadata = {
                videoCodec: 'h264',
                pixFmt: 'yuv420p',
                width: 1920,
                height: 1080
            };
            expect(isMetadataSupported(metadata, mockSupport)).toBe(true);
        });

        it('should return false for unsupported HEVC', () => {
            const metadata = {
                videoCodec: 'hevc',
                pixFmt: 'yuv420p',
                width: 1920,
                height: 1080
            };
            expect(isMetadataSupported(metadata, mockSupport)).toBe(false);
        });

        it('should return false for 10-bit H.264 without browser support', () => {
            const metadata = {
                videoCodec: 'h264',
                pixFmt: 'yuv420p10le',
                width: 1920,
                height: 1080
            };
            expect(isMetadataSupported(metadata, mockSupport)).toBe(false);
        });

        it('should return true for 10-bit H.264 if browser supports it', () => {
            const metadata = {
                videoCodec: 'h264',
                pixFmt: 'yuv420p10le',
                width: 1920,
                height: 1080
            };
            const customSupport = { ...mockSupport, h264_10bit: true };
            expect(isMetadataSupported(metadata, customSupport)).toBe(true);
        });

        it('should return false for odd dimensions', () => {
            const metadata = {
                videoCodec: 'h264',
                pixFmt: 'yuv420p',
                width: 1921,
                height: 1080
            };
            expect(isMetadataSupported(metadata, mockSupport)).toBe(false);
        });

        it('should return true if no metadata is provided (defensive)', () => {
            expect(isMetadataSupported(null, mockSupport)).toBe(true);
        });
    });
});
