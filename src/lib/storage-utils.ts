import fs from 'fs';
import path from 'path';

// Minimal FS interface for our needs
export interface IFileSystem {
  existsSync(path: string): boolean;
  statSync(path: string): { isFile(): boolean; isDirectory(): boolean; size: number };
  readdirSync(path: string): string[];
}

// Wrapper for real fs to match interface
const realFs: IFileSystem = {
  existsSync: (p) => fs.existsSync(p),
  statSync: (p) => fs.statSync(p),
  readdirSync: (p) => fs.readdirSync(p) as string[]
};

/**
 * Calculate the total size of a directory recursively
 * @param dirPath Absolute path to directory
 * @param fileSystem Optional filesystem implementation (defaults to real fs)
 * @returns Total size in bytes
 */
export function getDirectorySize(dirPath: string, fileSystem: IFileSystem = realFs): number {
  let totalSize = 0;

  if (!fileSystem.existsSync(dirPath)) {
    return 0;
  }

  const stats = fileSystem.statSync(dirPath);

  if (stats.isFile()) {
    return stats.size;
  }

  if (stats.isDirectory()) {
    const files = fileSystem.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      totalSize += getDirectorySize(filePath, fileSystem); // recursive pass
    }
  }

  return totalSize;
}

/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
