/**
 * Uploads the user cancelled on purpose.
 *
 * When the page that started an upload disconnects, /api/process saves the
 * result as a draft so a sleeping phone doesn't lose it. A deliberate Cancel
 * looks the same from the server's side (the connection closes), so the page
 * reports cancellations here first and the result is discarded instead.
 */

const KEEP_MS = 24 * 60 * 60 * 1000;

// Shared through globalThis: each API route bundle gets its own copy of this module
const store = ((globalThis as { __subtitlegemCancelledUploads?: Map<string, number> })
  .__subtitlegemCancelledUploads ??= new Map<string, number>());

export function markUploadCancelled(uploadId: string, now: number = Date.now()): void {
  for (const [id, at] of store) {
    if (now - at > KEEP_MS) store.delete(id);
  }
  store.set(uploadId, now);
}

export function isUploadCancelled(uploadId: string | null | undefined): boolean {
  return !!uploadId && store.has(uploadId);
}
