import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "./lib/auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Reject state-changing requests sent by a browser from another site (CSRF).
 * Browsers attach Origin to cross-origin POST/PUT/PATCH/DELETE; non-browser
 * clients (curl, scripts) usually omit it and are left to the auth check.
 */
function isCrossSiteRequest(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method)) return false;

  if (req.headers.get("sec-fetch-site") === "cross-site") return true;

  const origin = req.headers.get("origin");
  if (!origin) return false;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  try {
    return new URL(origin).host !== host;
  } catch {
    // Malformed or opaque ("null") origin
    return true;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect API routes
  if (pathname.startsWith("/api/")) {
    if (isCrossSiteRequest(req)) {
      return NextResponse.json(
        { error: "Cross-origin request blocked" },
        { status: 403 }
      );
    }

    // Exclude /api/login from authentication
    if (pathname === "/api/login") {
      return NextResponse.next();
    }

    // Enforce authentication
    if (!validateAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: "/api/:path*",
};
