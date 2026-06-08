import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { getStorageConfig } from '@/lib/storage-config';
import { getDirectorySize } from '@/lib/storage-utils';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const CleanupSchema = z.object({
      target: z.enum(['temp', 'drafts', 'video']),
      fileIds: z.array(z.string()).optional(), // For specific file deletion
      olderThanHours: z.number().optional()     // For bulk cleanup
    });

    const validation = CleanupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid request", details: validation.error.format() }, { status: 400 });
    }

    const { target, fileIds, olderThanHours } = validation.data;
    const config = getStorageConfig();
    let targetDir = '';
    
    if (target === 'temp') targetDir = path.join(config.stagingDir, 'temp');
    if (target === 'drafts') targetDir = path.join(config.stagingDir, 'drafts'); 
    if (target === 'video') targetDir = path.join(config.stagingDir, 'videos');

    try {
        await fsPromises.access(targetDir);
    } catch {
         return NextResponse.json({ deletedCount: 0, message: "Directory does not exist" });
    }

    let deletedCount = 0;
    const errors: string[] = [];

    // Specific file deletion
    if (fileIds && fileIds.length > 0) {
        for (const fileId of fileIds) {
            // Basic sanitization
            const safeName = path.basename(fileId); 
            const filePath = path.join(targetDir, safeName);
            
            try {
                await fsPromises.access(filePath);
                try {
                    await fsPromises.unlink(filePath);
                    deletedCount++;
                } catch (e: any) {
                    errors.push(`Failed to delete ${safeName}: ${e.message}`);
                }
            } catch {
                // File does not exist, ignore
            }
        }
    }

    // Bulk cleanup (older than X)
    if (olderThanHours !== undefined) {
        const files = await fsPromises.readdir(targetDir);
        const now = Date.now();
        const maxAgeMs = olderThanHours * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(targetDir, file);
            try {
                const stats = await fsPromises.stat(filePath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    await fsPromises.unlink(filePath);
                    deletedCount++;
                }
            } catch (e: any) {
                // Ignore errors during iteration (race conditions etc)
            }
        }
    }

    const currentSize = getDirectorySize(targetDir);

    return NextResponse.json({ 
        success: true, 
        deletedCount, 
        currentSize,
        errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
