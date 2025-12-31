/**
 * Path validation utilities for security
 * Prevents path traversal attacks by validating file paths
 */

import path from 'path';

/**
 * Validate that a file path is within an allowed directory
 * Uses path.resolve() to handle symlinks and relative paths (../)
 * 
 * @param filePath - The path to validate
 * @param allowedDir - The directory that should contain the file
 * @returns Object with isValid boolean and resolvedPath
 */
export function validatePathWithinDir(
  filePath: string,
  allowedDir: string
): { isValid: boolean; resolvedPath: string } {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);
  
  // Check if path is within allowed directory
  // Must start with allowedDir + separator OR be the exact allowedDir
  const isValid = 
    resolvedPath.startsWith(resolvedAllowedDir + path.sep) || 
    resolvedPath === resolvedAllowedDir;
  
  return { isValid, resolvedPath };
}

/**
 * Sanitize a filename by removing unsafe characters
 * Keeps alphanumeric, dots, hyphens, underscores only
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
