import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const apiPassword = process.env.API_PASSWORD;

    if (!apiPassword || apiPassword.trim() === "") {
      return NextResponse.json({
        success: true,
        message: "Authentication disabled"
      });
    }

    if (password === apiPassword) {
      const response = NextResponse.json({
        success: true,
        message: "Login successful"
      });

      // Store a signed session token, not the raw password
      const token = createSessionToken(apiPassword);
      response.cookies.set("sb_session", token, {
        httpOnly: true,
        // Default to secure unless explicitly disabled (e.g., local HTTP dev)
        secure: process.env.SECURE_COOKIES !== "false",
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_MAX_AGE, // 24 hours
      });

      return response;
    }

    return NextResponse.json({
      success: false,
      error: "Invalid password"
    }, { status: 401 });

  } catch {
    return NextResponse.json({
      success: false,
      error: "Invalid request"
    }, { status: 400 });
  }
}

/**
 * GET /api/login - Check if auth is enabled
 */
export async function GET() {
  const apiPassword = process.env.API_PASSWORD;
  return NextResponse.json({
    authEnabled: !!(apiPassword && apiPassword.trim() !== "")
  });
}

/**
 * DELETE /api/login - Logout
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("sb_session");
  response.cookies.delete("sb_api_key"); // clean up legacy cookie if present
  return response;
}
