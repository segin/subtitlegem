import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "@/lib/auth";
import { isSafeId } from "@/lib/path-utils";
import { markUploadCancelled } from "@/lib/upload-cancellations";

export const runtime = 'nodejs';

/**
 * POST /api/process/cancel - The user cancelled an upload; discard its result
 * instead of saving it as a draft when its connection closes.
 */
export async function POST(req: NextRequest) {
  if (!validateAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const uploadIds: unknown = body?.uploadIds;
  if (!Array.isArray(uploadIds) || uploadIds.length === 0 || uploadIds.length > 100 || !uploadIds.every(isSafeId)) {
    return NextResponse.json({ error: "uploadIds must be a list of upload IDs" }, { status: 400 });
  }

  for (const id of uploadIds) markUploadCancelled(id);
  console.log(`[Process] Cancelled upload(s): ${uploadIds.join(', ')}`);
  return NextResponse.json({ success: true });
}
