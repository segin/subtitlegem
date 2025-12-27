import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "File path is required" }, { status: 400 });
  }

  // --- Security Check ---
  // Ensure the path is within the temporary directory to prevent path traversal attacks.
  const tempDir = os.tmpdir();
  const safePath = path.join(tempDir, path.basename(filePath));

  if (!safePath.startsWith(tempDir) || !fs.existsSync(safePath)) {
    return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
  }

  try {
    const stats = fs.statSync(safePath);
    const stream = fs.createReadStream(safePath);
    
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${path.basename(safePath)}"`,
        'Content-Type': 'video/mp4',
        'Content-Length': stats.size.toString(),
      },
    });

  } catch (error: any) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
