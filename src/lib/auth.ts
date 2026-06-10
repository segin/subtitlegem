import { NextRequest } from "next/server";
import crypto from "crypto";
import { validateSessionToken } from "./session";

/**
 * Constant-time string comparison to avoid leaking the password via timing.
 * Returns false (without short-circuiting on content) when lengths differ.
 */
function safeEqual(candidate: string | null | undefined, secret: string): boolean {
  if (typeof candidate !== "string") return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validates if the request is authorized.
 *
 * Authentication is only enforced when the API_PASSWORD environment variable
 * is set. If it is unset/empty, the app runs in open ("promiscuous") mode and
 * all requests are allowed — keeping it zero-config for local/trusted use.
 * When set, credentials are accepted via any of the methods below.
 *
 * Supports:
 * 1. Authorization: Bearer <password>
 * 2. X-API-Key: <password>
 * 3. sb_api_key cookie
 */
export function validateAuth(req: NextRequest): boolean {
  const apiPassword = process.env.API_PASSWORD;

  // If no password is set, authentication is disabled (open/trusted mode).
  if (!apiPassword || apiPassword.trim() === "") {
    return true;
  }

  // 1. Check Authorization Header (Bearer)
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type.toLowerCase() === "bearer" && safeEqual(token, apiPassword)) {
      return true;
    }
    // Fallback if no "Bearer" prefix
    if (safeEqual(authHeader, apiPassword)) {
      return true;
    }
  }

  // 2. Check X-API-Key Header
  const apiKeyHeader = req.headers.get("x-api-key");
  if (safeEqual(apiKeyHeader, apiPassword)) {
    return true;
  }

  // 3. Check cookie — prefer new signed session token, fall back to legacy direct match
  const sessionToken = req.cookies.get("sb_session")?.value;
  if (sessionToken && validateSessionToken(sessionToken, apiPassword)) {
    return true;
  }
  // Legacy: old sb_api_key cookie containing the raw password (pre-session-token)
  const legacyCookie = req.cookies.get("sb_api_key")?.value;
  if (safeEqual(legacyCookie, apiPassword)) {
    return true;
  }

  return false;
}

/**
 * Helper to check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  const apiPassword = process.env.API_PASSWORD;
  return !!(apiPassword && apiPassword.trim() !== "");
}
