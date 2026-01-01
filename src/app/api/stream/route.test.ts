/**
 * @jest-environment node
 */
import { GET } from './route';
import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('@/lib/storage-config', () => ({
  getStorageConfig: jest.fn(() => ({
    stagingDir: '/mock/staging',
  })),
}));

describe('/api/stream', () => {
  const mockSpawn = spawn as jest.Mock;
  const mockExistsSync = fs.existsSync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);

    // Mock spawn to return a fake process with stdout/stderr
    mockSpawn.mockReturnValue({
      stdout: {
        on: jest.fn(),
        pipe: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn(),
      kill: jest.fn(),
    });
  });

  it('should block requests without path', async () => {
    const req = new NextRequest('http://localhost/api/stream');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing path');
  });

  it('should block path traversal attempts', async () => {
    // Attempt to access /etc/passwd via traversal
    // Note: On non-unix systems this path might look different, but path.resolve handles separators.
    // We'll simulate a relative path traversal that resolves outside /mock/staging
    const maliciousPath = '../../etc/passwd';
    const req = new NextRequest(`http://localhost/api/stream?path=${encodeURIComponent(maliciousPath)}`);
    
    // We assume path.resolve works correctly in the test environment (node).
    // /mock/staging/../../etc/passwd -> /etc/passwd (on linux)
    
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized path');
  });

  it('should block absolute paths outside staging', async () => {
    const maliciousPath = '/etc/passwd';
    const req = new NextRequest(`http://localhost/api/stream?path=${encodeURIComponent(maliciousPath)}`);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('should allow valid paths within staging', async () => {
    const validPath = '/mock/staging/video.mp4';
    const req = new NextRequest(`http://localhost/api/stream?path=${encodeURIComponent(validPath)}`);
    
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    
    // Check spawn was called
    expect(mockSpawn).toHaveBeenCalled();
    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('-movflags');
    expect(args).toContain('frag_keyframe+empty_moov+default_base_moof');
    expect(args[1]).toBe(path.resolve(validPath));
  });

  it('should return 404 if file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const validPath = '/mock/staging/missing.mp4';
    const req = new NextRequest(`http://localhost/api/stream?path=${encodeURIComponent(validPath)}`);
    
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
