/**
 * path-utils.test.ts - Unit, Property, and Fuzz tests for path validation
 */

import { validatePathWithinDir, sanitizeFilename } from './path-utils';
import * as fc from 'fast-check';
import path from 'path';

describe('path-utils', () => {
  describe('validatePathWithinDir', () => {
    describe('unit tests', () => {
      const stagingDir = '/home/user/storage';

      it('should allow paths within the directory', () => {
        expect(validatePathWithinDir('/home/user/storage/videos/test.mp4', stagingDir).isValid).toBe(true);
        expect(validatePathWithinDir('/home/user/storage/file.txt', stagingDir).isValid).toBe(true);
      });

      it('should reject paths outside the directory', () => {
        expect(validatePathWithinDir('/etc/passwd', stagingDir).isValid).toBe(false);
        expect(validatePathWithinDir('/home/other/file.txt', stagingDir).isValid).toBe(false);
      });

      it('should handle traversal attempts', () => {
        expect(validatePathWithinDir('/home/user/storage/../../../etc/passwd', stagingDir).isValid).toBe(false);
        expect(validatePathWithinDir('/home/user/storage/videos/../../secret.txt', stagingDir).isValid).toBe(false);
      });

      it('should allow exact staging directory path', () => {
        expect(validatePathWithinDir('/home/user/storage', stagingDir).isValid).toBe(true);
      });

      it('should reject paths that are prefixes but not subdirectories', () => {
        // /home/user/storage-evil should not be allowed even though it starts with /home/user/storage
        expect(validatePathWithinDir('/home/user/storage-evil/file.txt', stagingDir).isValid).toBe(false);
        expect(validatePathWithinDir('/home/user/storage2/file.txt', stagingDir).isValid).toBe(false);
      });

      it('should return resolved path', () => {
        const result = validatePathWithinDir('/home/user/storage/../storage/file.txt', stagingDir);
        expect(result.resolvedPath).toBe('/home/user/storage/file.txt');
      });
    });

    describe('property tests', () => {
      it('should always resolve to absolute path', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (filePath, allowedDir) => {
            const result = validatePathWithinDir(filePath, allowedDir);
            expect(path.isAbsolute(result.resolvedPath)).toBe(true);
          }),
          { numRuns: 100 }
        );
      });

      it('should be deterministic', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (filePath, allowedDir) => {
            const result1 = validatePathWithinDir(filePath, allowedDir);
            const result2 = validatePathWithinDir(filePath, allowedDir);
            expect(result1.isValid).toBe(result2.isValid);
            expect(result1.resolvedPath).toBe(result2.resolvedPath);
          }),
          { numRuns: 50 }
        );
      });
    });

    describe('fuzz tests', () => {
      it('should never throw for arbitrary input', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (filePath, allowedDir) => {
            // Should not throw
            const result = validatePathWithinDir(filePath, allowedDir);
            expect(typeof result.isValid).toBe('boolean');
            expect(typeof result.resolvedPath).toBe('string');
          }),
          { numRuns: 500 }
        );
      });

      it('should handle malicious traversal attempts', () => {
        const stagingDir = '/home/user/storage';
        // All of these should resolve outside the staging directory
        const maliciousPairs = [
          { input: '/etc/passwd', dir: stagingDir },
          { input: '/home/user/../../../etc/passwd', dir: stagingDir },
          { input: '/home/user/storage/../../../etc/passwd', dir: stagingDir },
        ];

        for (const { input, dir } of maliciousPairs) {
          const result = validatePathWithinDir(input, dir);
          expect(result.isValid).toBe(false);
        }
      });
    });
  });

  describe('sanitizeFilename', () => {
    describe('unit tests', () => {
      it('should keep safe characters', () => {
        expect(sanitizeFilename('video.mp4')).toBe('video.mp4');
        expect(sanitizeFilename('my-video_v2.0.mp4')).toBe('my-video_v2.0.mp4');
      });

      it('should replace unsafe characters with underscore', () => {
        expect(sanitizeFilename('file with spaces.mp4')).toBe('file_with_spaces.mp4');
        expect(sanitizeFilename('<script>alert(1)</script>.txt')).toBe('_script_alert_1___script_.txt');
        // Note: slashes are replaced, dots are kept
        expect(sanitizeFilename('../etc/passwd')).toBe('.._etc_passwd');
      });

      it('should handle unicode', () => {
        expect(sanitizeFilename('视频.mp4')).toBe('__.mp4');
        expect(sanitizeFilename('файл.mp4')).toBe('____.mp4');
      });
    });

    describe('property tests', () => {
      it('should only contain safe characters in output', () => {
        fc.assert(
          fc.property(fc.string(), (input) => {
            const result = sanitizeFilename(input);
            expect(/^[a-zA-Z0-9._-]*$/.test(result)).toBe(true);
          }),
          { numRuns: 200 }
        );
      });
    });
  });
});
