
import fs from 'fs';
import path from 'path';
import { Draft, DraftV1, DraftV2 } from "@/lib/draft-store";
import { getStagingDir } from "@/lib/storage-config";
import { getDirectorySize } from "@/lib/storage-utils";

export interface DraftMetrics {
  sourceSize: number;
  renderedSize: number;
  sourceCount: number;
  subtitleCount: number;
  renderCount: number;
}

export interface ProjectMetadata {
  summary?: string;
  metrics?: DraftMetrics;
  lastUpdated?: number;
}

/**
 * Get the path to the project metadata file
 * @param draftId Project ID
 */
export function getMetadataPath(draftId: string): string {
  const stagingDir = getStagingDir();
  const metadataDir = path.join(stagingDir, 'metadata');
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }
  return path.join(metadataDir, `${draftId}.json`);
}

/**
 * Compute aggregate metrics for a draft
 * @param draft V1 or V2 draft object
 * @param stagingDir (Optional) Injection for testing. Defaults to live config.
 */
export function computeMetrics(draft: Draft, stagingDir?: string): DraftMetrics {
  const rootDir = stagingDir || getStagingDir();
  
  let sourceSize = 0;
  let renderedSize = 0;
  let sourceCount = 0;
  let subtitleCount = 0;
  let renderCount = 0;

  // 1. Source Metrics
  if ('version' in draft && draft.version === 2) {
    // V2: Multi-video
    const v2 = draft as DraftV2;
    if (v2.clips) {
      sourceCount = v2.clips.length;
      // Sum clip fileSizes
      sourceSize = v2.clips.reduce((acc, clip) => acc + (clip.fileSize || 0), 0);
    }
    // V2 Subtitle Count: Not easily accessible if not in top-level prop. 
    // We assume caller (API) might backfill it from other sources or leave as 0.
  } else {
    // V1: Single-video
    const v1 = draft as DraftV1;
    if (v1.videoPath) {
      sourceCount = 1;
      try {
        if (fs.existsSync(v1.videoPath)) {
          sourceSize = fs.statSync(v1.videoPath).size;
        }
      } catch {}
    }
    if (v1.subtitles) {
      subtitleCount = v1.subtitles.length;
    }
  }

  // 2. Render Metrics (Exports folder)
  // Expected: STAGING_DIR/exports/{draftId}
  const exportsDir = path.join(rootDir, 'exports', draft.id);
  
  if (fs.existsSync(exportsDir)) {
    try {
        renderedSize = getDirectorySize(exportsDir);
        // Count files in exports (excluding hidden/.files)
        const files = fs.readdirSync(exportsDir).filter(f => !f.startsWith('.'));
        renderCount = files.length;
    } catch (e) {
        // Warning suppressed for logic purity, but could log?
    }
  }

  return { sourceSize, renderedSize, sourceCount, subtitleCount, renderCount };
}
