/**
 * @jest-environment node
 *
 * Guards the single point of failure for the whole auth model: the proxy
 * (Next.js middleware) that enforces authentication on every /api/* route
 * except /api/login. If the proxy ever stops running or its logic regresses,
 * every file-read/-delete endpoint becomes unauthenticated.
 */
import { proxy } from './proxy';
import { NextRequest } from 'next/server';

describe('proxy auth enforcement', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 401 for an unauthenticated API request when API_PASSWORD is set', () => {
    process.env.API_PASSWORD = 'secure-password';
    const req = new NextRequest('http://localhost/api/storage?path=/x');
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it('allows /api/login through without credentials', () => {
    process.env.API_PASSWORD = 'secure-password';
    const req = new NextRequest('http://localhost/api/login', { method: 'POST' });
    const res = proxy(req);
    expect(res.status).not.toBe(401);
  });

  it('allows API requests with a valid Bearer token', () => {
    process.env.API_PASSWORD = 'secure-password';
    const req = new NextRequest('http://localhost/api/storage?path=/x', {
      headers: { authorization: 'Bearer secure-password' },
    });
    const res = proxy(req);
    expect(res.status).not.toBe(401);
  });

  it('rejects API requests with a wrong Bearer token', () => {
    process.env.API_PASSWORD = 'secure-password';
    const req = new NextRequest('http://localhost/api/storage?path=/x', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it('allows all API requests when API_PASSWORD is not set (open/trusted mode)', () => {
    process.env.API_PASSWORD = '';
    const req = new NextRequest('http://localhost/api/storage?path=/x');
    const res = proxy(req);
    expect(res.status).not.toBe(401);
  });
});

describe('proxy cross-origin protection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, API_PASSWORD: '' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('blocks state-changing requests from another origin, even in open mode', () => {
    const req = new NextRequest('http://localhost:3050/api/drafts?id=x', {
      method: 'DELETE',
      headers: { origin: 'https://evil.example', host: 'localhost:3050' },
    });
    expect(proxy(req).status).toBe(403);
  });

  it('blocks requests the browser marks as cross-site', () => {
    const req = new NextRequest('http://localhost:3050/api/drafts', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site', host: 'localhost:3050' },
    });
    expect(proxy(req).status).toBe(403);
  });

  it('blocks an opaque "null" origin', () => {
    const req = new NextRequest('http://localhost:3050/api/export', {
      method: 'POST',
      headers: { origin: 'null', host: 'localhost:3050' },
    });
    expect(proxy(req).status).toBe(403);
  });

  it('allows same-origin state-changing requests', () => {
    const req = new NextRequest('http://localhost:3050/api/drafts', {
      method: 'POST',
      headers: { origin: 'http://localhost:3050', host: 'localhost:3050' },
    });
    expect(proxy(req).status).not.toBe(403);
  });

  it('uses X-Forwarded-Host behind a reverse proxy', () => {
    const req = new NextRequest('http://127.0.0.1:3050/api/drafts', {
      method: 'POST',
      headers: {
        origin: 'https://subs.example.lan',
        host: '127.0.0.1:3050',
        'x-forwarded-host': 'subs.example.lan',
      },
    });
    expect(proxy(req).status).not.toBe(403);
  });

  it('allows non-browser clients that send no Origin', () => {
    const req = new NextRequest('http://localhost:3050/api/drafts', { method: 'POST' });
    expect(proxy(req).status).not.toBe(403);
  });

  it('does not apply to safe methods', () => {
    const req = new NextRequest('http://localhost:3050/api/drafts', {
      headers: { origin: 'https://evil.example', host: 'localhost:3050' },
    });
    expect(proxy(req).status).not.toBe(403);
  });
});
