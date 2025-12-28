import { NextRequest, NextResponse } from "next/server";
import { saveDraft, loadDraft, listDrafts, deleteDraft, Draft } from "@/lib/draft-store";

export const runtime = 'nodejs';

/**
 * GET /api/drafts - List all drafts or get a single draft by ID
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  
  if (id) {
    const draft = loadDraft(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    return NextResponse.json(draft);
  }
  
  const drafts = listDrafts();
  return NextResponse.json({ drafts });
}

/**
 * POST /api/drafts - Save a new draft or update existing
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { id, name, videoPath, subtitles, config } = body;
    
    if (!name) {
      return NextResponse.json({ error: "Draft name is required" }, { status: 400 });
    }
    
    const draft = saveDraft({
      id,
      name,
      videoPath,
      subtitles,
      config,
    });
    
    return NextResponse.json(draft);
  } catch (error: any) {
    console.error("[Drafts API] Error saving draft:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/drafts - Delete a draft by ID
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  
  if (!id) {
    return NextResponse.json({ error: "Draft ID is required" }, { status: 400 });
  }
  
  const success = deleteDraft(id);
  
  if (!success) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  
  return NextResponse.json({ success: true });
}
