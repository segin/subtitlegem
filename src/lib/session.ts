import crypto from 'crypto';

const SESSION_DURATION_SECONDS = 24 * 60 * 60; // 24 hours
export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;

/**
 * Create a signed session token using HMAC-SHA256.
 * Format: "<timestamp>.<nonce>.<signature>"
 * The password is never stored in the token.
 */
export function createSessionToken(secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${nonce}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/**
 * Validate a session token. Returns false if the token is expired, malformed,
 * or the signature doesn't match (constant-time comparison).
 */
export function validateSessionToken(token: string, secret: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [ts, , sig] = parts;
    const tsNum = parseInt(ts, 10);
    if (isNaN(tsNum)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now - tsNum > SESSION_DURATION_SECONDS) return false;
    // Reconstruct the payload using only ts and nonce (parts[1])
    const payload = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
