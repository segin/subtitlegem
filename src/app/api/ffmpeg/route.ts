import { NextRequest, NextResponse } from "next/server";
import { 
  probeFFmpeg, 
  getCachedCapabilities, 
  getPreferredVideoEncoders,
  getPreferredAudioEncoders,
  getPreferredFormats
} from "@/lib/ffmpeg-probe";

export const runtime = 'nodejs';

/**
 * GET /api/ffmpeg - Get FFmpeg capabilities
 * Query params:
 *   - refresh=true: Force re-probe
 *   - preferred=true: Return only preferred/common options
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get('refresh') === 'true';
  const preferredOnly = searchParams.get('preferred') === 'true';
  
  try {
    const capabilities = await probeFFmpeg(refresh);
    
    if (preferredOnly) {
      return NextResponse.json({
        version: capabilities.version,
        videoEncoders: getPreferredVideoEncoders(capabilities),
        audioEncoders: getPreferredAudioEncoders(capabilities),
        formats: getPreferredFormats(capabilities),
        hwaccels: capabilities.hwaccels,
        probedAt: capabilities.probedAt,
      });
    }
    
    return NextResponse.json(capabilities);
  } catch (error: any) {
    console.error('FFmpeg probe failed:', error);
    return NextResponse.json(
      { error: 'Failed to probe FFmpeg capabilities', details: error.message },
      { status: 500 }
    );
  }
}
