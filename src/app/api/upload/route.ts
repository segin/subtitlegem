import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  appendUploadChunk,
  deleteUploadSession,
  getUploadSession,
  MAX_CHUNK_BYTES,
  startUploadSession,
  UploadSessionError,
  UploadSessionStatus,
} from "@/lib/upload-sessions";
import { isSafeId } from "@/lib/path-utils";
import { getGlobalSettings } from "@/lib/global-settings-store";
import { describeError } from "@/lib/error-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resumable uploads (see src/lib/upload-sessions.ts). Authentication and
 * cross-site checks are done for all /api routes in src/proxy.ts.
 *
 *   POST   /api/upload                  {filename, size, mimeType, lastModified} → start or resume
 *   GET    /api/upload?id=…             → how much has arrived
 *   PUT    /api/upload?id=…&offset=N    raw bytes of the next piece
 *   DELETE /api/upload?id=…             cancel and delete
 *
 * A finished upload is processed with POST /api/process {mode: "uploaded", uploadId}.
 */

const status = (s: UploadSessionStatus) => ({ id: s.id, received: s.received, size: s.size });

function errorResponse(error: unknown) {
  if (error instanceof UploadSessionError) {
    return NextResponse.json({ error: error.message, received: error.received }, { status: error.status });
  }
  console.error(`[Upload] ${describeError(error)}`);
  return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
}

const StartSchema = z.object({
  filename: z.string().min(1).max(1024),
  size: z.number().int().positive(),
  mimeType: z.string().max(255).default(""),
  lastModified: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest) {
  const parsed = StartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  const maxFileSizeMB = getGlobalSettings().maxFileSizeMB ?? 51200;
  if (parsed.data.size > maxFileSizeMB * 1024 * 1024) {
    return NextResponse.json(
      { error: `File too large. Maximum allowed: ${maxFileSizeMB} MB. Adjust in Global Settings.` },
      { status: 413 },
    );
  }

  try {
    const session = await startUploadSession(parsed.data);
    if (session.received > 0) {
      console.log(`[Upload] Resuming ${session.filename} at ${session.received} of ${session.size} bytes (${session.id})`);
    }
    return NextResponse.json(status(session));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!isSafeId(id)) return NextResponse.json({ error: "Invalid upload id" }, { status: 400 });
  const session = await getUploadSession(id);
  if (!session) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  return NextResponse.json(status(session));
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const offset = Number(req.nextUrl.searchParams.get("offset"));
  if (!isSafeId(id) || !Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "Invalid upload id or offset" }, { status: 400 });
  }

  const declared = Number(req.headers.get("content-length"));
  if (declared > MAX_CHUNK_BYTES) {
    return NextResponse.json({ error: `Pieces can be at most ${MAX_CHUNK_BYTES} bytes` }, { status: 413 });
  }

  let data: Buffer;
  try {
    // The whole piece is read before anything is written, so a piece cut off
    // by a dropped connection is never stored
    data = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "The connection dropped during this piece" }, { status: 400 });
  }
  if (data.length > MAX_CHUNK_BYTES || (declared && data.length !== declared)) {
    return NextResponse.json({ error: "Incomplete or oversized piece" }, { status: 400 });
  }

  try {
    return NextResponse.json(status(await appendUploadChunk(id, offset, data)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!isSafeId(id)) return NextResponse.json({ error: "Invalid upload id" }, { status: 400 });
  try {
    const deleted = await deleteUploadSession(id);
    if (deleted) console.log(`[Upload] Cancelled and deleted upload ${id}`);
    return NextResponse.json({ deleted });
  } catch (error) {
    return errorResponse(error);
  }
}
