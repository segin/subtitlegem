
import { NextRequest, NextResponse } from 'next/server';
import { queueManager } from '@/lib/queue-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial state immediately
      const initialState = {
        type: 'initial',
        items: queueManager.getAllItems(),
        paused: queueManager.getPausedState(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialState)}\n\n`));

      // Event listener for queue updates
      const onUpdate = () => {
        const updateState = {
          type: 'update',
          items: queueManager.getAllItems(),
          paused: queueManager.getPausedState(),
        };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(updateState)}\n\n`));
        } catch (error) {
          // Controller might be closed
          queueManager.off('update', onUpdate);
        }
      };

      // Subscribe to updates
      queueManager.on('update', onUpdate);

      // Heartbeat to keep connection alive (every 15s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (error) {
          clearInterval(heartbeat);
          queueManager.off('update', onUpdate);
        }
      }, 15000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        queueManager.off('update', onUpdate);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
