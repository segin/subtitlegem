import { NextRequest, NextResponse } from 'next/server';
import { queueManager } from '@/lib/queue-manager';

export const dynamic = 'force-dynamic';

// GET /api/queue - Get current queue status
export async function GET() {
  try {
    // Initialize and recover from any crashes on first call
    await queueManager.initialize();
    
    const items = queueManager.getAllItems();
    const stats = queueManager.getStats();
    const config = queueManager.getConfig();
    const estimatedTimeMs = queueManager.getEstimatedTimeRemaining();
    
    return NextResponse.json({
      items,
      stats,
      config,
      estimatedTimeMs,
      isPaused: queueManager.getPausedState(),
      isProcessing: queueManager.isProcessing(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/queue - Add item to queue
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, fileSize, filePath, model, secondaryLanguage, sampleDuration } = body;
    
    if (!fileName || !fileSize || !filePath || !model) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { isPathSafe } = await import("@/lib/storage-config");
    if (!isPathSafe(filePath)) {
        console.warn(`[Queue] Blocked unauthorized path access: ${filePath}`);
        return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
    }
    
    const item = queueManager.addItem({
      file: {
        name: fileName,
        size: fileSize,
        path: filePath,
      },
      model,
      secondaryLanguage: secondaryLanguage || 'None',
      sampleDuration, // Optional: 2, 5, or 10 seconds
    });
    
    return NextResponse.json({ item });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/queue - Remove item from queue or clear completed
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const force = searchParams.get('force') === 'true';
    
    // Handle clear completed
    if (action === 'clear_completed') {
      const count = queueManager.clearCompleted();
      return NextResponse.json({ success: true, count });
    }
    
    // Handle single item delete
    if (!id) {
      return NextResponse.json(
        { error: 'Missing queue item ID' },
        { status: 400 }
      );
    }
    
    const removed = queueManager.removeItem(id, force);
    
    if (!removed) {
      return NextResponse.json(
        { error: 'Cannot remove item (may be processing)' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/queue - Control operations (pause, resume, cancel, retry)
export async function PUT(req: NextRequest) {
  try {
    const { action, id } = await req.json();
    
    switch (action) {
      case 'pause':
        queueManager.pause();
        return NextResponse.json({ success: true, paused: true });
        
      case 'resume':
        queueManager.resume();
        return NextResponse.json({ success: true, paused: false });
        
      case 'cancel':
        const canceled = queueManager.cancelCurrent();
        return NextResponse.json({ success: canceled });
        
      case 'retry':
        if (!id) {
          return NextResponse.json(
            { error: 'Missing item ID for retry' },
            { status: 400 }
          );
        }
        const retried = queueManager.retryItem(id);
        return NextResponse.json({ success: retried });
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
