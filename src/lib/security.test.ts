import { secureDelete } from './security';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
    stat: jest.fn(),
    open: jest.fn(),
    access: jest.fn()
  },
  existsSync: jest.fn()
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue(Buffer.from('random'))
}));

describe('secureDelete', () => {
  const mockUnlink = fsPromises.unlink as jest.Mock;
  const mockStat = fsPromises.stat as jest.Mock;
  const mockOpen = fsPromises.open as jest.Mock;
  const mockAccess = fsPromises.access as jest.Mock;

  // Mock file handle object
  const mockFileHandle = {
    write: jest.fn(),
    sync: jest.fn(),
    close: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpen.mockResolvedValue(mockFileHandle);
    mockStat.mockResolvedValue({ size: 100 } as fs.Stats);
    mockAccess.mockResolvedValue(undefined); // File exists
    
    // Reset env
    delete process.env.SECURE_ERASE;
  });

  afterEach(() => {
    delete process.env.SECURE_ERASE;
  });

  it('should simply unlink when SECURE_ERASE is disabled', async () => {
    process.env.SECURE_ERASE = 'false';
    await secureDelete('/tmp/test-file');
    
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/test-file');
    expect(mockOpen).not.toHaveBeenCalled(); // No shredding
  });

  it('should perform 4 passes (3 random + 1 zero) when SECURE_ERASE is enabled', async () => {
    process.env.SECURE_ERASE = 'true';
    await secureDelete('/tmp/test-file');
    
    // 1. Verify Unlink
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/test-file');
    
    // 2. Verify Shredding
    // 3 random passes + 1 zero pass = 4 opens
    expect(mockOpen).toHaveBeenCalledTimes(4);
    
    // Verify write calls
    expect(mockFileHandle.write).toHaveBeenCalled();
    expect(mockFileHandle.sync).toHaveBeenCalledTimes(4); // Once per pass
    expect(mockFileHandle.close).toHaveBeenCalledTimes(4);
  });

  it('should respect forceSecure parameter regardless of env', async () => {
    process.env.SECURE_ERASE = 'false';
    await secureDelete('/tmp/test-file', true); // Force true
    
    expect(mockOpen).toHaveBeenCalledTimes(4); // Should shred
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/test-file');
  });

  it('should handle non-existent files gracefully', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    
    await secureDelete('/tmp/missing');
    
    expect(mockUnlink).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('should fallback to unlink if shredding fails', async () => {
    process.env.SECURE_ERASE = 'true';
    mockOpen.mockRejectedValue(new Error('Permission denied'));
    
    await secureDelete('/tmp/test-file');
    
    // Should still attempt to unlink
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/test-file');
  });
});
