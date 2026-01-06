import { NextRequest, NextResponse } from "next/server";
import { saveDraft, loadDraft, listDrafts, deleteDraft, Draft, DraftV1, DraftV2 } from "@/lib/draft-store";
import { generateSummary, deleteFileFromGemini } from "@/lib/gemini";
import fs from 'fs';
import path from 'path';
import { checkClipIntegrity, IntegrityStatus } from "@/lib/integrity-utils";
import { getStagingDir } from "@/lib/storage-config";
import { getDirectorySize } from "@/lib/storage-utils";
import { generateProjectSummary } from "@/lib/summary-generator";

export const runtime = 'nodejs';

// Helper: Compute metrics (now delegated to utility)
import { computeMetrics, getMetadataPath, ProjectMetadata } from "@/lib/metrics-utils";

// Removed local implementations of computeMetrics and interfaces as they are now imported

/**
 * GET /api/drafts - List all drafts or get a single draft by ID
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  
  if (id) {
    const draft = loadDraft(id);
    if (draft) {
      // Perform integrity check on load (Existing Logic)
      if ('version' in draft && draft.version === 2) {
         const v2 = draft as DraftV2;
         const clips = v2.clips.map(clip => {
           let measuredSize: number | null = null;
           try {
             if (fs.existsSync(clip.filePath)) {
                const stats = fs.statSync(clip.filePath);
                measuredSize = stats.size;
             }
           } catch (e) { }

           const status = checkClipIntegrity(clip, measuredSize);
           
           if (status === IntegrityStatus.MISSING || status === IntegrityStatus.MISMATCH) {
              return { ...clip, missing: true };
           } else if (status === IntegrityStatus.OK && measuredSize !== null && clip.fileSize !== measuredSize) {
              return { ...clip, fileSize: measuredSize, missing: false };
           }
           
           return { ...clip, missing: false };
         });
         (draft as any).clips = clips; // Cast to update readonly/typed property if needed
      } 
      
      return NextResponse.json(draft);
    }
    
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  
  // List all drafts with hydrated metrics
  const drafts = listDrafts().map(draft => {
    try {
      const metaPath = getMetadataPath(draft.id);
      let metadata: ProjectMetadata = {};
      
      // Load cached metadata
      if (fs.existsSync(metaPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch { /* corrupted metadata */ }
      }
      
      const metrics = computeMetrics(draft);

      // Merge cached subtitle count if available (assuming POST updated it)
      if (metadata.metrics && metadata.metrics.subtitleCount > 0 && metrics.subtitleCount === 0) {
        metrics.subtitleCount = metadata.metrics.subtitleCount;
      }
      
      // Merge with cache (preserve summary and cache metrics)
      const newMetadata = {
        ...metadata,
        metrics,
        lastUpdated: Date.now()
      };
      
      try {
        fs.writeFileSync(metaPath, JSON.stringify(newMetadata, null, 2));
      } catch {}

      return {
        ...draft,
        metrics: metrics,
        cache_summary: newMetadata.summary || ''
      };
    } catch (e) {
      console.warn(`[DraftAPI] Failed to populate metrics for ${draft.id}`, e);
      return draft;
    }
  });
  
  return NextResponse.json({ drafts });
}

/**
 * POST /api/drafts - Save a new draft or update existing
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // ... existing save logic ...
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
    
    // Invalidate/Update metadata on save
    try {
         const metaPath = getMetadataPath(draft.id);
         const metrics = computeMetrics(draft); // Recalc new metrics
         
         // Fix subtitle count using incoming body (as V2 draft object might not have it populated)
         if (subtitles && Array.isArray(subtitles)) {
            metrics.subtitleCount = subtitles.length;
         }

         let currentMeta: ProjectMetadata = {};
         if (fs.existsSync(metaPath)) {
             currentMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
         }
         
         const newMeta = {
             ...currentMeta,
             metrics,
             lastUpdated: Date.now()
         };
         
         fs.writeFileSync(metaPath, JSON.stringify(newMeta, null, 2));

         // Background: Generate Summary if missing
         if (!newMeta.summary && subtitles && subtitles.length > 0) {
           console.log(`[DraftAPI] Triggering summary generation for ${draft.id}`);
           // Fire and forget - do not await
           generateProjectSummary(draft.id, subtitles).catch(err => {
             console.error(`[DraftAPI] Summary generation failed for ${draft.id}`, err);
           });
         }
    } catch (e) {
        console.error("Failed to update metadata on save", e);
    }
    
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
  
  // Cleanup remote files first
  try {
    const draft = loadDraft(id);
    // Safe access to config.fileId (works for V1 and V2 if available)
    if (draft && 'config' in draft && draft.config?.fileId) {
       // Fire and forget, or await? Await to ensure clean state.
       await deleteFileFromGemini(draft.config.fileId);
    }
  } catch (err) {
    console.error(`[DraftAPI] Failed to cleanup remote file for ${id}`, err);
  }

  const success = deleteDraft(id);
  
  if (!success) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  
  // Metadata/Export cleanup is now handled by deleteDraft in store
  
  return NextResponse.json({ success: true });
}
