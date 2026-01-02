import { getDirectorySize, formatBytes, estimateH264Size, IFileSystem } from './storage-utils';
import * as fc from 'fast-check';
import path from 'path';

// Types for our recursive directory structure model
type FileModel = number; // just size
type DirModel = {
  files: Record<string, FileModel>;
  subdirs: Record<string, DirModel>;
};

// Helper to calculate size from model (truth)
function calculateModelSize(model: DirModel): number {
  let size = 0;
  for (const fileSize of Object.values(model.files)) {
    size += fileSize;
  }
  for (const subdir of Object.values(model.subdirs)) {
    size += calculateModelSize(subdir);
  }
  return size;
}

// Convert model to IFileSystem
class MockFileSystem implements IFileSystem {
  constructor(private root: DirModel) {}

  private resolve(p: string): { node: DirModel | FileModel | null, name: string } {
    // Normalize path to basic parts
    // Assumption: we always start from root '/' for this test
    const parts = p.split(path.sep).filter(Boolean);
    
    let current: DirModel = this.root;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Check subdirs
        if (current.subdirs[part]) {
            if (i === parts.length - 1) {
                return { node: current.subdirs[part], name: part };
            }
            current = current.subdirs[part];
            continue;
        }
        
        // Check files
        if (current.files[part]) {
             if (i === parts.length - 1) {
                 return { node: current.files[part], name: part };
             }
             // File in middle of path? Invalid path for us
             return { node: null, name: part };
        }
        
        return { node: null, name: part };
    }
    
    // Root
    return { node: this.root, name: '' };
  }

  existsSync(p: string): boolean {
    if (p === '/' || p === '.' || p === '') return true;
    return !!this.resolve(p).node;
  }

  statSync(p: string) {
    if (p === '/' || p === '.' || p === '') {
        return { isFile: () => false, isDirectory: () => true, size: 0 };
    }

    const { node } = this.resolve(p);
    
    if (typeof node === 'number') {
        return { isFile: () => true, isDirectory: () => false, size: node };
    } else if (node) {
        return { isFile: () => false, isDirectory: () => true, size: 0 };
    }
    
    throw new Error(`ENOENT: no such file or directory, stat '${p}'`);
  }

  readdirSync(p: string): string[] {
    let node: DirModel;
    if (p === '/' || p === '.' || p === '') {
        node = this.root;
    } else {
        const res = this.resolve(p);
        if (typeof res.node === 'number' || !res.node) {
             throw new Error(`ENOTDIR: not a directory, readdir '${p}'`);
        }
        node = res.node;
    }

    return [
        ...Object.keys(node.files),
        ...Object.keys(node.subdirs)
    ];
  }
}

describe('storage-utils', () => {
  describe('formatBytes', () => {
    test('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1234)).toBe('1.21 KB');
    });
  });

  describe('getDirectorySize', () => {
    test('calculates empty directory size', () => {
      const mockFs = new MockFileSystem({ files: {}, subdirs: {} });
      expect(getDirectorySize('/', mockFs)).toBe(0);
    });

    test('calculates single file size', () => {
      const mockFs = new MockFileSystem({ 
        files: { 'test.txt': 100 }, 
        subdirs: {} 
      });
      expect(getDirectorySize('/', mockFs)).toBe(100);
    });
    
    test('flat path list calculation (property-based)', () => {
      // Generate a list of file paths and their sizes
      // e.g. [{ path: 'a/b/c.txt', size: 100 }, ...]
      const fileEntryArb = fc.record({
        pathParts: fc.array(
           fc.string({ minLength: 1, maxLength: 5 }).filter(s => /^[a-z0-9]+$/.test(s)), 
           { minLength: 1, maxLength: 5 }
        ),
        size: fc.integer({ min: 0, max: 10000 })
      });

      const filesArb = fc.array(fileEntryArb, { maxLength: 20 });

      fc.assert(
        fc.property(filesArb, (rawFileEntries) => {
           // Sanitize entries to ensure filesystem consistency
           // Rule: A path cannot be a prefix of another path (because that prefix would be a file, preventing it from being a dir)
           // We prioritize the shorter path (files > dirs) for simplicity in this generated set
           
           const fileEntries: typeof rawFileEntries = [];
           
           // Sort by path length ascending to process potential parents first
           const sorted = [...rawFileEntries].sort((a, b) => a.pathParts.join('/').length - b.pathParts.join('/').length);
           
           for (const entry of sorted) {
             const pathStr = entry.pathParts.join('/');
             
             // Check against accepted entries
             const isInvalid = fileEntries.some(valid => {
                const validPath = valid.pathParts.join('/');
                return pathStr === validPath || pathStr.startsWith(validPath + '/'); // Exact match or child of existing file
             });
             
             if (!isInvalid) {
               fileEntries.push(entry);
             }
           }

           // Build model from flat paths
           const root: DirModel = { files: {}, subdirs: {} };
           let expectedTotalSize = 0;

           for (const entry of fileEntries) {
             let current = root;
             const parts = entry.pathParts;
             
             // Navigate/Create structure
             for (let i = 0; i < parts.length - 1; i++) {
               const part = parts[i];
               if (!current.subdirs[part]) {
                 current.subdirs[part] = { files: {}, subdirs: {} };
               }
               current = current.subdirs[part];
             }
             
             // Add file (if not exists, or overwrite)
             const fileName = parts[parts.length - 1];
             // If a subdir exists with same name, we skip adding file (MockFS priority logic would mask it anyway)
             if (!current.subdirs[fileName]) {
               // If file already exists, we overwrite. 
               // If we overwrite, we just update expectation math?
               // Easier: rebuild expectation from final tree.
               current.files[fileName] = entry.size;
             }
           }
           
           const expectedSize = calculateModelSize(root);
           const mockFs = new MockFileSystem(root);
           
           const calculatedSize = getDirectorySize('/', mockFs);
           
           expect(calculatedSize).toBe(expectedSize);
        })
      );
    });
  });

  describe('estimateH264Size', () => {
    describe('Unit Tests', () => {
        test('Base Case: 1080p, CRF 23, 10 seconds', () => {
            // Base bitrate: 4500 Kbps video + 192 Kbps audio
            // Total: 4692 Kbps
            // Size: 4692 * 10 / 8 = 5865 KB = 5865000 Bytes
            // 4692 * 1000 * 10 / 8 = 5,865,000 Bytes
            const size = estimateH264Size({
                duration: 10,
                width: 1920,
                height: 1080,
                crf: 23
            });
            expect(size).toBe(5865000);
        });

        test('CRF Impact: CRF 17 (Better quality, larger)', () => {
            // CRF 17 is 6 steps lower than 23 -> 2^(6/6) = 2x factors
            // Video: 4500 * 2 = 9000 Kbps
            // Total: 9192 Kbps
            // 10 sec: 9192 * 1000 * 10 / 8 = 11,490,000
            const size = estimateH264Size({
                duration: 10,
                width: 1920,
                height: 1080,
                crf: 17
            });
            expect(size).toBe(11490000);
        });

        test('Resolution Impact: 4K (4x pixels of 1080p)', () => {
             // 3840x2160 = 4 * 1920x1080
             // Video: 4500 * 4 = 18000 Kbps
             // Total: 18192 Kbps
             // 10 sec: 18192 * 1000 * 10 / 8 = 22,740,000
             const size = estimateH264Size({
                duration: 10,
                width: 3840,
                height: 2160,
                crf: 23
            });
            expect(size).toBe(22740000);
        });

        test('Zero duration returns 0', () => {
            expect(estimateH264Size({ duration: 0, width: 1920, height: 1080, crf: 23 })).toBe(0);
        });
    });

    describe('Property Tests', () => {
        test('Size should be non-negative', () => {
            fc.assert(
                fc.property(
                    fc.double({ min: 0.1, max: 3600 }), // duration
                    fc.integer({ min: 100, max: 4000 }), // width
                    fc.integer({ min: 100, max: 4000 }), // height
                    fc.integer({ min: 0, max: 51 }), // crf
                    (d, w, h, crf) => {
                        const size = estimateH264Size({
                            duration: d,
                            width: w,
                            height: h,
                            crf: crf
                        });
                        return size >= 0 && !isNaN(size);
                    }
                )
            );
        });

        test('Lower CRF (higher quality) should result in larger size for same resolution/duration', () => {
            fc.assert(
                fc.property(
                    fc.double({ min: 1, max: 60 }),
                    fc.constant(1920),
                    fc.constant(1080),
                    fc.integer({ min: 0, max: 50 }),
                    (d, w, h, crf) => {
                        const sizeHigh = estimateH264Size({ duration: d, width: w, height: h, crf: crf });
                        const sizeLow = estimateH264Size({ duration: d, width: w, height: h, crf: crf + 1 });
                        return sizeHigh > sizeLow;
                    }
                )
            );
        });
    });
  });
});
