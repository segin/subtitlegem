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
 * Calculate the total size of a directory recursively (Asynchronous)
 * @param dirPath Absolute path to directory
 * @returns Total size in bytes
 */
export async function getDirectorySizeAsync(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const stats = await fs.promises.stat(dirPath);

    if (stats.isFile()) {
      return stats.size;
    }

    if (stats.isDirectory()) {
      const files = await fs.promises.readdir(dirPath);

      const sizes = await Promise.all(
        files.map(file => getDirectorySizeAsync(path.join(dirPath, file)))
      );

      totalSize = sizes.reduce((acc, size) => acc + size, 0);
    }
  } catch (error) {
    // If path doesn't exist or other error, return 0
    return 0;
  }

  return totalSize;
}
