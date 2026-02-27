import { NextRequest, NextResponse } from "next/server";
import { saveDraft, loadDraft, listDrafts, deleteDraft, Draft, DraftV1, DraftV2, DraftSummary } from "@/lib/draft-store";
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
    let draft = loadDraft(id);
    if (draft) {
      // Auto-migrate V1 projects to V2 for unified multi-track UI
      if (!('version' in draft) || draft.version === 1) {
        console.log(`[DraftAPI] Auto-migrating V1 draft ${id} to V2 format`);
        const { migrateDraftToV2 } = await import("@/lib/draft-store");
        const v2Draft = migrateDraftToV2(id);
        if (v2Draft) {
          draft = v2Draft;
        }
      }
      
      // Perform integrity check on load (Existing Logic)
      if ('version' in draft && draft.version === 2) {
         const v2 = draft as DraftV2;
         const clips = await Promise.all(v2.clips.map(async (clip) => {
           let measuredSize: number | null = null;
           try {
             const stats = await fs.promises.stat(clip.filePath);
             measuredSize = stats.size;
           } catch (e) { }

           const status = checkClipIntegrity(clip, measuredSize);
           
           if (status === IntegrityStatus.MISSING || status === IntegrityStatus.MISMATCH) {
              return { ...clip, missing: true };
           } else if (status === IntegrityStatus.OK && measuredSize !== null && clip.fileSize !== measuredSize) {
              return { ...clip, fileSize: measuredSize, missing: false };
           }
           
           return { ...clip, missing: false };
         }));
         (draft as any).clips = clips; // Cast to update readonly/typed property if needed
      } 
      
      return NextResponse.json(draft);
    }
    
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  
  // List all drafts with hydrated metrics
  const drafts = await Promise.all(listDrafts().map(async (draft: DraftSummary) => {
    try {
      const metaPath = getMetadataPath(draft.id);
      let metadata: ProjectMetadata = {};
      
      // Load cached metadata
      try {
        const metaStr = await fs.promises.readFile(metaPath, 'utf-8');
        metadata = JSON.parse(metaStr);
      } catch { /* missing or corrupted metadata */ }
      
      // computeMetrics will only compute what it can from the summary (mostly render metrics)
      const metrics = await computeMetrics(draft);

      // Backfill source-related metrics from cached metadata since DraftSummary excludes them
      if (metadata.metrics) {
        if (metrics.sourceSize === 0 && metadata.metrics.sourceSize > 0) {
          metrics.sourceSize = metadata.metrics.sourceSize;
        }
        if (metrics.sourceCount === 0 && metadata.metrics.sourceCount > 0) {
          metrics.sourceCount = metadata.metrics.sourceCount;
        }
        if (metrics.subtitleCount === 0 && metadata.metrics.subtitleCount > 0) {
          metrics.subtitleCount = metadata.metrics.subtitleCount;
        }

        // Always preserve lifetimeRenderCount (it's only incremented on export, never recomputed from disk)
        if (metadata.metrics.lifetimeRenderCount > 0) {
          metrics.lifetimeRenderCount = metadata.metrics.lifetimeRenderCount;
        }
      }
      
      // Update cache with fresh render metrics while preserving source metrics
      const newMetadata = {
        ...metadata,
        metrics,
        lastUpdated: Date.now()
      };
      
      try {
        await fs.promises.writeFile(metaPath, JSON.stringify(newMetadata, null, 2));
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
  }));
  
  return NextResponse.json({ drafts });
}

/**
 * POST /api/drafts - Save a new draft or update existing (Supports V1 and V2)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { isPathSafe } = await import("@/lib/storage-config");
    
    const { id, name, videoPath, subtitles, config, version, clips, timeline, projectConfig, subtitleConfig } = body;
    
    if (!name) {
      return NextResponse.json({ error: "Draft name is required" }, { status: 400 });
    }

    let draft;

    if (version === 2 || (clips && timeline)) {
        // Handle V2 Draft
        const { saveDraftV2 } = await import("@/lib/draft-store");
        
        // Security Check: Validate all clip paths
        if (clips) {
            for (const clip of clips) {
                if (!isPathSafe(clip.filePath)) {
                    console.warn(`[DraftAPI] Blocked unauthorized clip path: ${clip.filePath}`);
                    return NextResponse.json({ error: "Unauthorized path in clips" }, { status: 403 });
                }
            }
        }

        draft = saveDraftV2({
            id,
            name,
            clips: clips || [],
            timeline: timeline || [],
            projectConfig: projectConfig || {},
            subtitleConfig: subtitleConfig || config || {},
        });
    } else {
        // Handle V1 Draft
        if (videoPath && !isPathSafe(videoPath)) {
            console.warn(`[DraftAPI] Blocked unauthorized videoPath: ${videoPath}`);
            return NextResponse.json({ error: "Unauthorized video path" }, { status: 403 });
        }

        draft = saveDraft({
            id,
            name,
            videoPath,
            subtitles,
            config,
        });
    }
    
    // Invalidate/Update metadata on save
    try {
         const metaPath = getMetadataPath(draft.id);
         const metrics = await computeMetrics(draft); // Recalc new metrics
         
         // Fix subtitle count using incoming body (as V2 draft object might not have it populated)
         const incomingSubtitles = subtitles || subtitleConfig?.subtitles || config?.subtitles;
         if (incomingSubtitles && Array.isArray(incomingSubtitles)) {
            metrics.subtitleCount = incomingSubtitles.length;
         }

         let currentMeta: ProjectMetadata = {};
         try {
             const metaStr = await fs.promises.readFile(metaPath, 'utf8');
             currentMeta = JSON.parse(metaStr);
         } catch { /* missing or corrupted */ }
         
         const newMeta = {
             ...currentMeta,
             metrics,
             lastUpdated: Date.now()
         };
         
         await fs.promises.writeFile(metaPath, JSON.stringify(newMeta, null, 2));

         // Background: Generate Summary if missing
         const finalSubtitles = subtitles || (draft.version === 1 ? draft.subtitles : []); // V2 might need more complex extraction if not in body
         if (!newMeta.summary && finalSubtitles && (finalSubtitles as any[]).length > 0) {
           console.log(`[DraftAPI] Triggering summary generation for ${draft.id}`);
           generateProjectSummary(draft.id, finalSubtitles as any[]).catch(err => {
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
    if (draft) {
      // V1: Clean up single config.fileId
      if ('config' in draft && draft.config?.fileId) {
        await deleteFileFromGemini(draft.config.fileId);
        console.log(`[DraftAPI] Deleted Gemini file for V1 draft: ${draft.config.fileId}`);
      }
      
      // V2: Clean up all clip Gemini files
      if ('version' in draft && draft.version === 2) {
        const v2 = draft as DraftV2;
        for (const clip of v2.clips) {
          if (clip.geminiFileUri) {
            try {
              // Extract file ID from URI (format: files/{fileId})
              const fileId = clip.fileId || clip.geminiFileUri.split('/').pop();
              if (fileId) {
                await deleteFileFromGemini(fileId);
                console.log(`[DraftAPI] Deleted Gemini file for clip ${clip.id}: ${fileId}`);
              }
            } catch (clipErr) {
              console.error(`[DraftAPI] Failed to delete Gemini file for clip ${clip.id}`, clipErr);
            }
          }
        }
      }
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

/**
 * PATCH /api/drafts - Rename a draft
 */
export async function PATCH(req: NextRequest) {
  try {
    const { id, name } = await req.json();
    
    if (!id || !name) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 });
    }
    
    const { renameDraft } = await import("@/lib/draft-store");
    const success = renameDraft(id, name);
    
    if (!success) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Drafts API] Error renaming draft:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

