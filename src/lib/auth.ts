import { NextRequest } from "next/server";
import { validateSessionToken } from "./session";

/**
 * Validates if the request is authorized.
 *
 * Authentication is only enforced if the API_PASSWORD environment variable is set.
 * This allows the app to remain "zero-config" for local/trusted usage while
 * providing security for remote/public deployments.
 *
 * Supports:
 * 1. Authorization: Bearer <password>
 * 2. X-API-Key: <password>
 * 3. sb_api_key cookie
 */
export function validateAuth(req: NextRequest): boolean {
  const apiPassword = process.env.API_PASSWORD;

  // If no password is set, authentication is disabled (trusted environment)
  if (!apiPassword || apiPassword.trim() === "") {
    return true;
  }

  // 1. Check Authorization Header (Bearer)
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type.toLowerCase() === "bearer" && token === apiPassword) {
      return true;
    }
    // Fallback if no "Bearer" prefix
    if (authHeader === apiPassword) {
      return true;
    }
  }

  // 2. Check X-API-Key Header
  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader === apiPassword) {
    return true;
  }

  // 3. Check cookie — prefer new signed session token, fall back to legacy direct match
  const sessionToken = req.cookies.get("sb_session")?.value;
  if (sessionToken && validateSessionToken(sessionToken, apiPassword)) {
    return true;
  }
  // Legacy: old sb_api_key cookie containing the raw password (pre-session-token)
  const legacyCookie = req.cookies.get("sb_api_key")?.value;
  if (legacyCookie === apiPassword) {
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
