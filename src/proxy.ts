import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "./lib/auth";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect API routes
  if (pathname.startsWith("/api/")) {
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
