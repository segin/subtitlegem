import { secureDelete } from './security';
import fs from 'fs';
import path from 'path';
import os from 'os';
import fc from 'fast-check';

const TMP_DIR = path.join(os.tmpdir(), 'subtitlegem-security-fuzz');

describe('secureDelete Fuzzing', () => {
  beforeAll(() => {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it('should explicitly delete files of varying sizes and contents', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[^a-z0-9]/gi, '_')), // Safe filename
        fc.string({ minLength: 0, maxLength: 1024 * 10 }), // File content (up to 10KB to keep it fast)
        fc.boolean(), // forceSecure
        async (fileName, content, force) => {
          const filePath = path.join(TMP_DIR, `${fileName}_${Math.random().toString(36).substring(7)}.tmp`);
          
          // Create file
          fs.writeFileSync(filePath, content);
          expect(fs.existsSync(filePath)).toBe(true);
          
          // Secure delete
          if (force) {
            // If forcing secure delete, we expect it to take slightly longer and do IO, 
            // but functionally effectively it just deletes the file.
            await secureDelete(filePath, true);
          } else {
            // Environment based (defers to default env which is off in test, or we can mock it)
            // Here we test logic: if force is false, and env is unset/false, it should just unlink.
            // We'll set env to 'true' randomly? No, let's keep env clean and rely on force param for coverage.
            process.env.SECURE_ERASE = 'false';
            await secureDelete(filePath);
          }
          
          // Verify
          expect(fs.existsSync(filePath)).toBe(false);
        }
      ),
      { numRuns: 20 } // Limit runs to avoid excessive IO time during CI/Dev
    );
  }, 30000); // 30s timeout
});
