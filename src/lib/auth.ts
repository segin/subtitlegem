import { NextRequest } from "next/server";

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

  // Authentication is REQUIRED. If no password is set, all requests are denied.
  if (!apiPassword || apiPassword.trim() === "") {
    return false;
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

  // 3. Check Cookie
  const cookieToken = req.cookies.get("sb_api_key")?.value;
  if (cookieToken === apiPassword) {
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
