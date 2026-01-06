
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getStorageConfig } from '@/lib/storage-config';

// GET /api/stream?path=/path/to/video.mkv
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  // Security check: strict path validation to prevent traversal attacks
  // Resolve both paths to handle symlinks and relative paths like ../
  const config = getStorageConfig();
  const resolvedPath = path.resolve(filePath);
  const resolvedStagingDir = path.resolve(config.stagingDir);
  
  // Ensure the resolved path is strictly within the staging directory
  // Prevent null byte injection and traversal relative to staging
  if (!resolvedPath.startsWith(resolvedStagingDir + path.sep) && resolvedPath !== resolvedStagingDir) {
    console.warn(`[Stream] Blocked unauthorized path access: ${filePath} (resolved: ${resolvedPath})`);
    return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
  }

  // Additional check: explicitly forbid ".." in the originally supplied path component
  if (filePath.includes('..')) {
      console.warn(`[Stream] Blocked potential traversal pattern: ${filePath}`);
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
  }

  if (!fs.existsSync(resolvedPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Determine valid seek start time from Range header if possible? 
  // For now, simple stream from start. 
  // Adding seek support to live transcoding is complex (needs -ss before -i).
  // We'll trust the fast transcode performance.
  
  // FFmpeg arguments for H.264/AAC Fragmented MP4 (streamable)
  // -movflags frag_keyframe+empty_moov+default_base_moof to make it streamable without seeking
  const ffmpegArgs = [
    '-i', resolvedPath,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',  // Prioritize speed for preview
    '-tune', 'zerolatency',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  ];

  /* 
   * Note: For HW acceleration support, we would check capabilities here.
   * For MVP preview, CPU (libx264 ultrafast) is usually sufficient for 720p/1080p preview.
   */

  console.log(`[Stream] Spawning FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  // Clean up process if request is aborted
  const stream = new ReadableStream({
    start(controller) {
      ffmpegProcess.stdout.on('data', (chunk) => {
        try {
            controller.enqueue(chunk);
        } catch (e) {
            // Stream closed
            ffmpegProcess.kill();
        }
      });
      
      ffmpegProcess.stdout.on('end', () => {
        try { controller.close(); } catch(e) {}
      });

      ffmpegProcess.stderr.on('data', (data) => {
        // Log stderr but don't fail stream unless exit code is bad
        // console.log(`[FFmpeg-Stream Stderr]: ${data}`);
      });
      
      ffmpegProcess.on('error', (err) => {
          console.error('[Stream] FFmpeg Process Error:', err);
          try { controller.error(err); } catch(e) {}
      });
    },
    cancel() {
      console.log('[Stream] Client disconnected, killing FFmpeg');
      ffmpegProcess.kill();
    }
  });

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'video/mp4',
      // 'Transfer-Encoding': 'chunked' // Next.js/Node handles this automatically for streams?
    }
  });
}
