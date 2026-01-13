import fs from 'fs';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';

/**
 * secureDelete
 * Emulates `shred -uzv` behavior if SECURE_ERASE environment variable is true.
 * Performs operation asynchronously.
 * 
 * Behavior:
 * 1. Overwrites file with random data (3 passes default)
 * 2. Overwrites with zeros (1 pass)
 * 3. Unlinks (deletes) the file
 * 4. Verbose logging
 * 
 * @param filePath Path to the file to delete
 * @param forceSecure If true, bypasses env var check and forces secure delete
 */
export async function secureDelete(filePath: string, forceSecure = false): Promise<void> {
  try {
    try {
        await fsPromises.access(filePath);
    } catch {
        return; // File doesn't exist
    }
    
    // Check if secure erase is enabled
    const isSecureEnabled = forceSecure || 
      process.env.SECURE_ERASE === 'true' || 
      process.env.SECURE_ERASE === '1';

    if (!isSecureEnabled) {
      // Standard delete
      await fsPromises.unlink(filePath);
      return;
    }

    // --- Secure Erase Logic (shred -uzv) ---
    
    const stats = await fsPromises.stat(filePath);
    const fileSize = stats.size;
    const passes = 3; // Standard shred matches
    
    console.log(`[SecureDelete] Shredding ${filePath} (${fileSize} bytes)`);

    // 1. Random passes
    for (let i = 1; i <= passes; i++) {
        const fh = await fsPromises.open(filePath, 'r+');
        try {
            // Write random chunks
            let written = 0;
            const bufferSize = 64 * 1024; // 64KB chunks
            
            while (written < fileSize) {
                const remaining = fileSize - written;
                const chunkLen = Math.min(remaining, bufferSize);
                const buffer = crypto.randomBytes(chunkLen);
                await fh.write(buffer, 0, chunkLen, written);
                written += chunkLen;
            }
            // Sync to disk
            await fh.sync();
            console.log(`[SecureDelete] ${filePath}: pass ${i}/${passes + 1} (random)`);
        } finally {
            await fh.close();
        }
    }

    // 2. Zero pass (-z)
    const fh = await fsPromises.open(filePath, 'r+');
    try {
        let written = 0;
        const bufferSize = 64 * 1024;
        const zeros = Buffer.alloc(bufferSize, 0);
        
        while (written < fileSize) {
            const remaining = fileSize - written;
            const chunkLen = Math.min(remaining, bufferSize);
            const buffer = chunkLen === bufferSize ? zeros : zeros.subarray(0, chunkLen);
            await fh.write(buffer, 0, chunkLen, written);
            written += chunkLen;
        }
        await fh.sync();
        console.log(`[SecureDelete] ${filePath}: pass ${passes + 1}/${passes + 1} (000000)`);
    } finally {
        await fh.close();
    }

    // 3. Remove (-u)
    await fsPromises.unlink(filePath);
    console.log(`[SecureDelete] Removed ${filePath}`);

  } catch (error) {
    console.error(`[SecureDelete] Failed to delete ${filePath}:`, error);
    // Attempt standard unlink as fallback
    try {
        await fsPromises.unlink(filePath).catch(() => {});
    } catch (e) {
        // Ignore fallback error
    }
  }
}
