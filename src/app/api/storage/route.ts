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

// GET /api/storage - Get current storage configuration or serve a file
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (filePath) {
      // Security: Ensure path is within allowed directories
      const config = getStorageConfig();
      const stagingDir = config.stagingDir;
      const absolutePath = path.resolve(filePath);
      
      const isAllowed = absolutePath.startsWith(stagingDir) || 
                         absolutePath.includes('subtitlegem');

      if (!isAllowed) {
        return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
      }

      if (!fs.existsSync(absolutePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Serve the file
      const fileBuffer = fs.readFileSync(absolutePath);
      const fileExtension = path.extname(absolutePath).toLowerCase();
      
      let contentType = 'application/octet-stream';
      if (fileExtension === '.mp4') contentType = 'video/mp4';
      else if (fileExtension === '.webm') contentType = 'video/webm';
      else if (fileExtension === '.mkv') contentType = 'video/x-matroska';
      else if (fileExtension === '.srt') contentType = 'text/plain';
      else if (fileExtension === '.ass') contentType = 'text/plain';

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    }

    const config = getStorageConfig();
    const validation = await validateStagingDir(config.stagingDir);
    const currentSizeGB = getStagingDirSize(config.stagingDir);
    
    return NextResponse.json({
      config,
      validation,
      currentSizeGB,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
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
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
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
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
