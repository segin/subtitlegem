import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { ffprobe } from '@/lib/ffmpeg-utils';
import { getStorageConfig } from '@/lib/storage-config';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const { isPathSafe } = await import("@/lib/storage-config");
    if (!isPathSafe(filePath)) {
      console.warn(`[VideoInfo] Blocked unauthorized path access: ${filePath}`);
      return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
    }
    
    // The path is now guaranteed to be safe by isPathSafe, so we can resolve it without further checks.
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Use safe ffprobe utility
    const metadata = await ffprobe(resolvedPath);
    
    // Construct response similar to previous structure but with safer data
    return NextResponse.json({
      filename: path.basename(resolvedPath),
      filePath: resolvedPath,
      fileSize: 0, // ffprobe helper doesn't return size currently, but we could add it
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      fps: metadata.fps,
      videoCodec: metadata.videoCodec,
      audioCodec: metadata.audioCodec,
      pixFmt: metadata.pixFmt,
    });
  } catch (error: any) {
    console.error('Probe error:', error);
    return NextResponse.json({ error: error.message || 'Failed to probe video' }, { status: 500 });
  }
}
