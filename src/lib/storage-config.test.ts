/**
 * storage-config.test.ts - Tests for storage configuration utilities
 * 
 * Tests path manipulation functions and security validation logic.
 */

import * as fc from 'fast-check';
import path from 'path';
import {
  getQueueItemDir,
  getExportJobDir,
  isPathSafe,
  getStagingDir,
} from './storage-config';

// Note: Most storage-config functions involve file system operations
// which are better suited for integration tests. Here we test the pure
// path manipulation functions.

describe('getQueueItemDir', () => {
  describe('unit tests', () => {
    test('constructs correct path', () => {
      const result = getQueueItemDir('/staging', 'queue-123');
      expect(result).toBe(path.join('/staging', 'videos', 'queue-123'));
    });

    test('handles absolute paths', () => {
      const result = getQueueItemDir('/var/storage', 'abc-def');
      expect(result).toBe('/var/storage/videos/abc-def');
    });

    test('handles relative paths', () => {
      const result = getQueueItemDir('./storage', 'item-1');
      expect(result).toBe(path.join('./storage', 'videos', 'item-1'));
    });
  });

  describe('fuzz tests', () => {
    test('never throws for alphanumeric IDs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          (stagingDir, queueId) => {
            const result = getQueueItemDir(stagingDir, queueId);
            return typeof result === 'string' && result.length > 0;
          }
        ),
        { numRuns: 500 }
      );
    });

    test('result always contains queueId', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.uuid(),
          (stagingDir, queueId) => {
            const result = getQueueItemDir(stagingDir, queueId);
            return result.includes(queueId);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});

describe('getExportJobDir', () => {
  describe('unit tests', () => {
    test('constructs correct path', () => {
      const result = getExportJobDir('/staging', 'job-456');
      expect(result).toBe(path.join('/staging', 'exports', 'job-456'));
    });

    test('handles absolute paths', () => {
      const result = getExportJobDir('/var/storage', 'export-abc');
      expect(result).toBe('/var/storage/exports/export-abc');
    });
  });

  describe('fuzz tests', () => {
    test('never throws for alphanumeric IDs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          (stagingDir, jobId) => {
            const result = getExportJobDir(stagingDir, jobId);
            return typeof result === 'string' && result.length > 0;
          }
        ),
        { numRuns: 500 }
      );
    });

    test('result always contains jobId', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.uuid(),
          (stagingDir, jobId) => {
            const result = getExportJobDir(stagingDir, jobId);
            return result.includes(jobId);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});

describe('isPathSafe', () => {
  const stagingDir = getStagingDir();
  const projectRoot = process.cwd();

  it('should allow valid paths in staging directory', () => {
    const validPath = path.join(stagingDir, 'test.mp4');
    expect(isPathSafe(validPath)).toBe(true);
  });

  it('should allow valid paths in subdirectories of staging', () => {
    const validPath = path.join(stagingDir, 'videos', 'job1', 'output.mp4');
    expect(isPathSafe(validPath)).toBe(true);
  });

  it('should allow valid paths in project root', () => {
    const validPath = path.join(projectRoot, 'src', 'app', 'page.tsx');
    expect(isPathSafe(validPath)).toBe(true);
  });

  it('should block paths with directory traversal (..)', () => {
    const invalidPath = path.join(stagingDir, '..', '..', 'etc', 'passwd');
    expect(isPathSafe(invalidPath)).toBe(false);
  });

  it('should block absolute paths outside authorized directories', () => {
    // Note: /etc/passwd is a good benchmark for outside the app/staging root
    expect(isPathSafe('/etc/passwd')).toBe(false);
  });

  it('should block null/undefined/empty paths', () => {
    expect(isPathSafe(null)).toBe(false);
    expect(isPathSafe(undefined)).toBe(false);
    expect(isPathSafe('')).toBe(false);
  });

  it('should block paths that are almost valid but escape via resolution', () => {
    const trickyPath = path.join(stagingDir, '..', 'secret.txt');
    expect(isPathSafe(trickyPath)).toBe(false);
  });
});
