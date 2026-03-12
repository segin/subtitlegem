import { NextRequest, NextResponse } from "next/server";

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

      // Set secure cookie
      response.cookies.set("sb_api_key", apiPassword, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    }

    return NextResponse.json({
      success: false,
      error: "Invalid password"
    }, { status: 401 });

  } catch (error) {
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
  response.cookies.delete("sb_api_key");
  return response;
}
