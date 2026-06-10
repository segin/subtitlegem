import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { 
  getStorageConfig, 
  validateStagingDir, 
  getStagingDirSize,
  cleanupOldItems,
  ensureStagingStructure
} from '@/lib/storage-config';

// Respond to an unsatisfiable Range request per RFC 7233.
function invalidRange(fileSize: number): NextResponse {
  return new NextResponse(null, {
    status: 416,
    headers: { 'Content-Range': `bytes */${fileSize}` },
  });
}

// GET /api/storage - Get current storage configuration or serve a file
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (filePath) {
      const { isPathSafe } = await import("@/lib/storage-config");
      if (!isPathSafe(filePath)) {
        console.warn(`[Storage] Blocked unauthorized path access: ${filePath}`);
        return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
      }

      const resolvedPath = path.resolve(filePath);

      // Reject symlinks so they can't point outside the staging jail.
      const { isRegularNonSymlinkFile } = await import("@/lib/path-utils");
      if (!isRegularNonSymlinkFile(resolvedPath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Determine content type
      const fileExtension = path.extname(resolvedPath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (fileExtension === '.mp4') contentType = 'video/mp4';
      else if (fileExtension === '.webm') contentType = 'video/webm';
      else if (fileExtension === '.mkv') contentType = 'video/x-matroska';
      else if (fileExtension === '.srt') contentType = 'text/plain';
      else if (fileExtension === '.ass') contentType = 'text/plain';

      const stat = fs.statSync(resolvedPath);
      const fileSize = stat.size;
      const range = req.headers.get('range');

      if (range) {
        // Handle Range request (byte serving). Supports "bytes=start-end",
        // "bytes=start-" and the suffix form "bytes=-N" (last N bytes).
        const parts = range.replace(/bytes=/, "").split("-");
        const startRaw = parts[0];
        const endRaw = parts[1];

        let start: number;
        let end: number;
        if (startRaw === "" && endRaw) {
          // Suffix range: last N bytes
          const suffixLength = parseInt(endRaw, 10);
          if (isNaN(suffixLength) || suffixLength <= 0) {
            return invalidRange(fileSize);
          }
          start = Math.max(0, fileSize - suffixLength);
          end = fileSize - 1;
        } else {
          start = parseInt(startRaw, 10);
          end = endRaw ? parseInt(endRaw, 10) : fileSize - 1;
        }

        // Validate the resolved range; return 416 on anything unsatisfiable.
        if (
          isNaN(start) || isNaN(end) ||
          start < 0 || end < start || start >= fileSize
        ) {
          return invalidRange(fileSize);
        }
        // Clamp end to the last byte.
        if (end >= fileSize) end = fileSize - 1;

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(resolvedPath, { start, end });

        // Convert Node stream to Web stream
        const stream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => {
              try { controller.enqueue(chunk); }
              catch (e) { fileStream.destroy(); }
            });
            fileStream.on('end', () => {
              try { controller.close(); } catch (e) {}
            });
            fileStream.on('error', (err) => {
              try { controller.error(err); } catch (e) {}
            });
          },
          cancel() {
            fileStream.destroy();
          }
        });

        return new NextResponse(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': contentType,
          },
        });
      } else {
        // Handle full file request
        const fileStream = fs.createReadStream(resolvedPath);
        
        // Convert Node stream to Web stream
        const stream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => {
              try { controller.enqueue(chunk); }
              catch (e) { fileStream.destroy(); }
            });
            fileStream.on('end', () => {
              try { controller.close(); } catch (e) {}
            });
            fileStream.on('error', (err) => {
              try { controller.error(err); } catch (e) {}
            });
          },
          cancel() {
            fileStream.destroy();
          }
        });

        return new NextResponse(stream as unknown as ReadableStream, {
          status: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': contentType,
          },
        });
      }
    }

    const config = getStorageConfig();
    const validation = await validateStagingDir(config.stagingDir);
    const currentSizeGB = getStagingDirSize(config.stagingDir);
    
    return NextResponse.json({
      config,
      validation,
      currentSizeGB,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/storage - Update storage configuration
export async function POST(req: NextRequest) {
  try {
    const { stagingDir, autoCleanup, maxStorageUsageGB } = await req.json();
    
    // Validate the new staging directory
    if (stagingDir) {
      const validation = await validateStagingDir(stagingDir);
      
      if (!validation.writable) {
        return NextResponse.json(
          { error: validation.error || 'Directory is not writable' },
          { status: 400 }
        );
      }
      
      // Create necessary subdirectories
      ensureStagingStructure(stagingDir);
    }
    
    // Note: Cannot actually save config server-side to localStorage
    // Client must save to localStorage after receiving confirmation
    
    return NextResponse.json({
      success: true,
      validation: stagingDir ? await validateStagingDir(stagingDir) : null,
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/storage - Clean up old items
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const maxAgeHours = parseInt(searchParams.get('maxAgeHours') || '24');
    
    const config = getStorageConfig();
    const cleanedCount = cleanupOldItems(config.stagingDir, maxAgeHours);
    const currentSizeGB = getStagingDirSize(config.stagingDir);
    
    return NextResponse.json({
      success: true,
      cleanedCount,
      currentSizeGB,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
