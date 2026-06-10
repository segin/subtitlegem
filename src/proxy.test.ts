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
