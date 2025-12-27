import { NextRequest, NextResponse } from 'next/server';
import { 
  getStorageConfig, 
  validateStagingDir, 
  getStagingDirSize,
  cleanupOldItems,
  ensureStagingStructure
} from '@/lib/storage-config';

// GET /api/storage - Get current storage configuration
export async function GET() {
  try {
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
