import { NextRequest, NextResponse } from "next/server";
import { saveDraft, loadDraft, listDrafts, deleteDraft, Draft } from "@/lib/draft-store";
import fs from 'fs';
import { checkClipIntegrity, IntegrityStatus } from "@/lib/integrity-utils";

export const runtime = 'nodejs';

/**
 * GET /api/drafts - List all drafts or get a single draft by ID
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  
  if (id) {
    const draft = loadDraft(id);
    if (draft) {
      // Perform integrity check on load
      let hasChanges = false;

      if (draft.version === 2) {
        // Check all clips
        draft.clips = draft.clips.map(clip => {
          let measuredSize: number | null = null;
          try {
            if (fs.existsSync(clip.filePath)) {
               const stats = fs.statSync(clip.filePath);
               measuredSize = stats.size;
            }
          } catch (e) {
            console.error(`[DraftAPI] Failed to stat file ${clip.filePath}`, e);
          }

          const status = checkClipIntegrity(clip, measuredSize);
          
          if (status === IntegrityStatus.MISSING || status === IntegrityStatus.MISMATCH) {
             console.warn(`[DraftAPI] Integrity check failed for clip ${clip.id}: ${status}`);
             return { ...clip, missing: true };
          } else if (status === IntegrityStatus.OK && measuredSize !== null && clip.fileSize !== measuredSize) {
             // Self-heal: If size was undefined but file exists and is valid (legacy), update it
             // BUT, checkClipIntegrity returns OK for undefined fileSize. 
             // If we want to backfill fileSize, we can do it here.
             return { ...clip, fileSize: measuredSize, missing: false };
          }
          
          return { ...clip, missing: false };
        });
      } else if (draft.version === 1 && draft.videoPath) {
         // Basic V1 check
         if (!fs.existsSync(draft.videoPath)) {
            // We can't easily flag V1 structure as missing without changing type, 
            // but we can pass a transient error or just let it fail later.
            // Or migrate to V2?
            console.warn(`[DraftAPI] V1 Draft video missing: ${draft.videoPath}`);
         }
      }
      
      return NextResponse.json(draft);
    }
    
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
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
