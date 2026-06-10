import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getStorageConfig, isPathSafe } from "@/lib/storage-config";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "File path is required" }, { status: 400 });
  }

  const config = getStorageConfig();
  const tempDir = path.resolve(path.join(config.stagingDir, 'temp'));
  const safePath = path.resolve(path.join(tempDir, path.basename(filePath)));

  // Verify the resolved path is strictly within the temp directory
  if (!safePath.startsWith(tempDir + path.sep)) {
    return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
  }

  // Full security validation (null bytes, traversal, shell chars, staging dir prefix)
  if (!isPathSafe(safePath)) {
    return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
  }

  // lstat instead of existsSync: simultaneously checks existence AND rejects symlinks
  let fileStats: fs.Stats;
  try {
    fileStats = fs.lstatSync(safePath);
  } catch {
    return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
  }

  if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
    return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
  }

  try {
    const stream = fs.createReadStream(safePath);

    // Build a header-safe filename. Strip quotes/control chars from the ASCII
    // fallback, and provide an RFC 5987 UTF-8 variant for the real name.
    const rawName = path.basename(safePath);
    const asciiName = rawName.replace(/["\\\r\n]/g, "_");
    const encodedName = encodeURIComponent(rawName);

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        'Content-Type': 'video/mp4',
        'Content-Length': fileStats.size.toString(),
      },
    });

  } catch (error: unknown) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
