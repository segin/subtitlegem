/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
  createWriteStream: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('@/lib/storage-config', () => ({
  getStorageConfig: jest.fn(() => ({
    stagingDir: '/mock/staging',
  })),
  isPathSafe: jest.fn((p) => true),
}));

jest.mock('busboy', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
    }));
});

describe('/api/process Authentication', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should allow access when API_PASSWORD is not set', async () => {
    process.env.API_PASSWORD = '';

    const req = new NextRequest('http://localhost/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'translate', subtitles: [] }),
    });

    const res = await POST(req);
    // Should NOT be 401. If it's 400 or something else, it means it passed auth check.
    expect(res.status).not.toBe(401);
  });

  it('should return 401 when API_PASSWORD is set but no auth provided', async () => {
    process.env.API_PASSWORD = 'secure-password';

    const req = new NextRequest('http://localhost/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'translate', subtitles: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should allow access with correct Bearer token', async () => {
    process.env.API_PASSWORD = 'secure-password';

    const req = new NextRequest('http://localhost/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer secure-password'
      },
      body: JSON.stringify({ mode: 'translate', subtitles: [] }),
    });

    const res = await POST(req);
    expect(res.status).not.toBe(401);
  });

  it('should allow access with correct X-API-Key header', async () => {
    process.env.API_PASSWORD = 'secure-password';

    const req = new NextRequest('http://localhost/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'secure-password'
      },
      body: JSON.stringify({ mode: 'translate', subtitles: [] }),
    });

    const res = await POST(req);
    expect(res.status).not.toBe(401);
  });

  it('should return 401 with incorrect password', async () => {
    process.env.API_PASSWORD = 'secure-password';

    const req = new NextRequest('http://localhost/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-password'
      },
      body: JSON.stringify({ mode: 'translate', subtitles: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
