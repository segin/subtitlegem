/**
 * Browser Media Compatibility Probing Utility
 * 
 * Used to detect if the current browser supports specific codecs and formats.
 * Helps decide whether to stream source files directly or force transcoding.
 */

export interface BrowserSupport {
    h264: boolean;
    hevc: boolean;
    vp9: boolean;
    av1: boolean;
    aac: boolean;
    opus: boolean;
    mp4: boolean;
    mkv: boolean;
    webm: boolean;
    h264_10bit: boolean;
    hevc_10bit: boolean;
}

/**
 * Probes the browser for media support using canPlayType and MediaCapabilities API.
 */
export async function probeBrowserSupport(): Promise<BrowserSupport> {
    const video = document.createElement('video');
    
    // Basic canPlayType checks
    const support: BrowserSupport = {
        h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
        hevc: video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== '',
        vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
        av1: video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== '',
        aac: video.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '',
        opus: video.canPlayType('audio/webm; codecs="opus"') !== '',
        mp4: video.canPlayType('video/mp4') !== '',
        mkv: video.canPlayType('video/x-matroska') !== '',
        webm: video.canPlayType('video/webm') !== '',
        h264_10bit: false, // Default
        hevc_10bit: false, // Default
    };

    // Advanced MediaCapabilities check if available
    if ('mediaCapabilities' in navigator) {
        try {
            // Check for H.264 10-bit (High 10 Profile)
            const h264_10 = await navigator.mediaCapabilities.decodingInfo({
                type: 'file',
                video: {
                    contentType: 'video/mp4; codecs="avc1.6e001f"', // High 10 Profile
                    width: 1920,
                    height: 1080,
                    bitrate: 5000000,
                    framerate: 30
                }
            });
            support.h264_10bit = h264_10.supported;

            // Check for HEVC 10-bit
            const hevc_10 = await navigator.mediaCapabilities.decodingInfo({
                type: 'file',
                video: {
                    contentType: 'video/mp4; codecs="hvc1.2.4.L120.B0"', // Main 10 Profile
                    width: 1920,
                    height: 1080,
                    bitrate: 5000000,
                    framerate: 30
                }
            });
            support.hevc_10bit = hevc_10.supported;
        } catch (e) {
            console.warn('[SupportProbe] MediaCapabilities check failed:', e);
        }
    }

    return support;
}

/**
 * Determines if a specific video metadata is supported by the current browser.
 * Returns true if supported, false if transcoding is recommended.
 */
export function isMetadataSupported(metadata: any, support: BrowserSupport): boolean {
    if (!metadata) return true; // Assume OK if no info yet

    const { videoCodec, pixFmt, width, height } = metadata;

    // 1. Check for 10-bit color formats (common cause of black screen in browsers)
    // Note: yuv410p is 8-bit despite having '10' in the name
    const is10bit = (pixFmt?.includes('10') || pixFmt?.includes('12')) && pixFmt !== 'yuv410p';
    if (is10bit) {
        if (videoCodec === 'h264' && !support.h264_10bit) return false;
        if ((videoCodec === 'hevc' || videoCodec === 'h265') && !support.hevc_10bit) return false;
        if (!['h264', 'hevc', 'h265'].includes(videoCodec)) return false; // Other 10-bit usually fail
    }

    // 2. Check for even dimensions (odd dimensions often break HW decoders)
    if (width % 2 !== 0 || height % 2 !== 0) return false;

    // 3. Basic codec check
    if (videoCodec === 'hevc' || videoCodec === 'h265') return support.hevc;
    if (videoCodec === 'vp9') return support.vp9;
    if (videoCodec === 'av1') return support.av1;
    if (videoCodec === 'h264') return support.h264;

    // 4. Container check implicitly via route.ts if we have server path
    
    return true;
}
