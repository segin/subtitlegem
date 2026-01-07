import { isPathSafe, getStagingDir } from './storage-config';
import path from 'path';

describe('storage-config: isPathSafe', () => {
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
    // Note: On some systems, /tmp might be allowed if project is in /tmp, 
    // but usually /etc/passwd is a safe bet for "outside"
    expect(isPathSafe('/etc/passwd')).toBe(false);
  });

  it('should block null/undefined/empty paths', () => {
    expect(isPathSafe(null)).toBe(false);
    expect(isPathSafe(undefined)).toBe(false);
    expect(isPathSafe('')).toBe(false);
  });

  it('should block paths that are almost valid but escape via resolution', () => {
    // If stagingDir is /home/user/project/storage
    // A path like /home/user/project/storage/../secret.txt
    const trickyPath = path.join(stagingDir, '..', 'secret.txt');
    expect(isPathSafe(trickyPath)).toBe(false);
  });
});
