import fs from 'fs';
import path from 'path';
import os from 'os';

export interface StorageConfig {
  stagingDir: string;
  autoCleanup: boolean;
  maxStorageUsageGB: number;
}

export interface StorageValidation {
  exists: boolean;
  writable: boolean;
  availableSpaceGB: number;
  error?: string;
}

const DEFAULT_CONFIG: StorageConfig = {
  stagingDir: process.env.STAGING_DIR || path.join(process.cwd(), 'storage'),
  autoCleanup: true,
  maxStorageUsageGB: 50,
};

/**
 * Validate that a directory exists and is writable
 */
export async function validateStagingDir(dirPath: string): Promise<StorageValidation> {
  try {
    // Check if directory exists
    const exists = fs.existsSync(dirPath);
    
    if (!exists) {
      // Try to create it
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch (createError: any) {
        return {
          exists: false,
          writable: false,
          availableSpaceGB: 0,
          error: `Cannot create directory: ${createError.message}`,
        };
      }
    }

    // Check if writable by creating a test file
    const testFile = path.join(dirPath, `.test-${Date.now()}`);
    let writable = false;
    
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      writable = true;
    } catch (writeError: any) {
      return {
        exists: true,
        writable: false,
        availableSpaceGB: 0,
        error: `Directory not writable: ${writeError.message}`,
      };
    }

    // Get available space using Node.js fs.statfs (available since Node 18.15.0)
    let availableSpaceGB = 0;
    
    try {
      // Use fs.statfs to get filesystem statistics
      const stats = await fs.promises.statfs(dirPath);
      // Available space = available blocks * block size
      availableSpaceGB = (stats.bavail * stats.bsize) / (1024 ** 3);
    } catch (spaceError: any) {
      // If statfs fails (older Node versions or unsupported platforms), 
      // fall back to a default estimate and log the issue
      console.warn('[Storage] Could not check disk space:', spaceError.message);
      availableSpaceGB = 50; // Conservative default
    }

    return {
      exists: true,
      writable: true,
      availableSpaceGB,
    };
    
  } catch (error: any) {
    return {
      exists: false,
      writable: false,
      availableSpaceGB: 0,
      error: error.message,
    };
  }
}

/**
 * Get the current staging directory
 * Priority: localStorage > environment variable > default temp
 */
export function getStagingDir(): string {
  // In server-side context, we can only use env variable
  if (typeof window === 'undefined') {
    return process.env.STAGING_DIR || DEFAULT_CONFIG.stagingDir;
  }
  
  // Client-side: check localStorage first
  const stored = localStorage.getItem('subtitlegem_storage_config');
  if (stored) {
    try {
      const config: StorageConfig = JSON.parse(stored);
      return config.stagingDir;
    } catch {
      // Fall through to default
    }
  }
  
  return DEFAULT_CONFIG.stagingDir;
}

/**
 * Get the full storage configuration
 */
export function getStorageConfig(): StorageConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG;
  }
  
  const stored = localStorage.getItem('subtitlegem_storage_config');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  
  return DEFAULT_CONFIG;
}

/**
 * Save storage configuration to localStorage (client-side)
 */
export function setStorageConfig(config: Partial<StorageConfig>): void {
  if (typeof window === 'undefined') {
    throw new Error('Cannot set storage config on server side');
  }
  
  const current = getStorageConfig();
  const updated = { ...current, ...config };
  localStorage.setItem('subtitlegem_storage_config', JSON.stringify(updated));
}

/**
 * Create necessary subdirectories in staging directory
 */
export function ensureStagingStructure(stagingDir: string): void {
  const dirs = [
    path.join(stagingDir, 'videos'),
    path.join(stagingDir, 'exports'),
    path.join(stagingDir, 'temp'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Get the path for a specific queue item's video directory
 */
export function getQueueItemDir(stagingDir: string, queueId: string): string {
  return path.join(stagingDir, 'videos', queueId);
}

/**
 * Get the path for a specific export job directory
 */
export function getExportJobDir(stagingDir: string, jobId: string): string {
  return path.join(stagingDir, 'exports', jobId);
}

/**
 * Clean up a queue item's directory
 */
export function cleanupQueueItem(stagingDir: string, queueId: string): void {
  const dir = getQueueItemDir(stagingDir, queueId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Clean up an export job's directory
 */
export function cleanupExportJob(stagingDir: string, jobId: string): void {
  const dir = getExportJobDir(stagingDir, jobId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Get total size of staging directory in GB
 */
export function getStagingDirSize(stagingDir: string): number {
  if (!fs.existsSync(stagingDir)) {
    return 0;
  }
  
  let totalSize = 0;
  
  function getDirectorySize(dirPath: string): number {
    let size = 0;
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          size += getDirectorySize(itemPath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      // If we can't read a directory, skip it
    }
    
    return size;
  }
  
  totalSize = getDirectorySize(stagingDir);
  return totalSize / (1024 ** 3); // Convert to GB
}

/**
 * Clean up old completed items based on age
 */
export function cleanupOldItems(stagingDir: string, maxAgeHours: number = 24): number {
  const videosDir = path.join(stagingDir, 'videos');
  const exportsDir = path.join(stagingDir, 'exports');
  let cleanedCount = 0;
  
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  
  [videosDir, exportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) return;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          const age = now - stats.mtimeMs;
          
          if (age > maxAgeMs) {
            fs.rmSync(itemPath, { recursive: true, force: true });
            cleanedCount++;
          }
        }
      }
    } catch (error) {
      console.error(`Error cleaning up ${dir}:`, error);
    }
  });
  
  return cleanedCount;
}

/**
 * Validates if a file path is safe to access (within staging or project root)
 * Prevents path traversal and unauthorized file access.
 */
export function isPathSafe(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  
  // Explicitly deny '..' sequences to prevent traversal attempts before resolution
  if (filePath.includes('..')) return false;
  
  const stagingDir = getStagingDir();
  const resolvedPath = path.resolve(filePath);
  const resolvedStagingDir = path.resolve(stagingDir);
  const projectRoot = path.resolve(process.cwd());
  
  // Check if path is within staging directory or project root
  return resolvedPath.startsWith(resolvedStagingDir + path.sep) || 
         resolvedPath === resolvedStagingDir ||
         resolvedPath.startsWith(projectRoot + path.sep);
}
