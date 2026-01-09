
/**
 * Format bytes to human readable string
 * Extracted to separate file to allow client-side usage without 'fs' dependency
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(k)) : 0;
  
  // Handle case where bytes < 1 (log(0.stuff) is negative) => i < 0
  const safeI = Math.max(0, i);
  // Also handle max unit
  const finalI = Math.min(safeI, sizes.length - 1);

  return parseFloat((bytes / Math.pow(k, finalI)).toFixed(dm)) + ' ' + sizes[finalI];
}
