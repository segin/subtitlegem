import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getStorageConfig } from '@/lib/storage-config';
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

    if (!fs.existsSync(targetDir)) {
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
            
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    // Also try to cleanup related files (e.g. .json sidecars for videos?)
                    // For now keeping it simple.
                } catch (e: any) {
                    errors.push(`Failed to delete ${safeName}: ${e.message}`);
                }
            }
        }
    }

    // Bulk cleanup (older than X)
    if (olderThanHours !== undefined) {
        const files = fs.readdirSync(targetDir);
        const now = Date.now();
        const maxAgeMs = olderThanHours * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(targetDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch (e: any) {
                // Ignore errors during iteration (race conditions etc)
            }
        }
    }

    return NextResponse.json({ 
        success: true, 
        deletedCount, 
        currentSize: 0, // TODO: calculate new size if needed
        errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
