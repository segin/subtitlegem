
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// GET /api/stream?path=/path/to/video.mkv
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }
    
    // Security check: strict path validation
    const { isPathSafe } = await import("@/lib/storage-config");
    if (!isPathSafe(filePath)) {
        console.warn(`[Stream] Blocked unauthorized path access: ${filePath}`);
        return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
    }
    
    const resolvedPath = path.resolve(filePath);

  // Reject symlinks so they can't point outside the staging jail.
  const { isRegularNonSymlinkFile } = await import("@/lib/path-utils");
  if (!isRegularNonSymlinkFile(resolvedPath)) {
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
    '-pix_fmt', 'yuv420p',   // Ensure compatibility with all browsers (Edge/Safari etc)
    '-profile:v', 'main',    // Use common profile for wider support
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure even dimensions (required by some decoders)
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
        } catch {
            // Stream closed
            ffmpegProcess.kill();
        }
      });

      ffmpegProcess.stdout.on('end', () => {
        try { controller.close(); } catch {}
      });

      ffmpegProcess.stderr.on('data', () => {
        // Log stderr but don't fail stream unless exit code is bad
      });

      ffmpegProcess.on('error', (err) => {
          console.error('[Stream] FFmpeg Process Error:', err);
          try { controller.error(err); } catch {}
      });
    },
    cancel() {
      console.log('[Stream] Client disconnected, killing FFmpeg');
      ffmpegProcess.kill();
    }
  });

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'video/mp4',
      // 'Transfer-Encoding': 'chunked' // Next.js/Node handles this automatically for streams?
    }
  });
}
