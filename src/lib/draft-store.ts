/**
 * Draft Store - SQLite-based storage for incomplete projects
 * 
 * Stores drafts that were started but not submitted for processing.
 * Users can resume or delete these drafts from the upload screen.
 * 
 * Supports both V1 (single-video) and V2 (multi-video) project formats.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { 
  SubtitleLine, 
  SubtitleConfig, 
  VideoClip, 
  TimelineClip, 
  ProjectConfig,
  DEFAULT_PROJECT_CONFIG,
  migrateToMultiVideo,
  ProjectState,
} from "@/types/subtitle";
import { getMetadataPath } from "./metrics-utils";
import { getStagingDir, ensureStagingStructure } from './storage-config';

const stagingDir = getStagingDir();
ensureStagingStructure(stagingDir);

const dbPath = path.join(stagingDir, "drafts.db");
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create drafts table (V1 schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    video_path TEXT,
    subtitles TEXT,
    config TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

// Migrate to V2 schema if needed (add new columns)
try {
  db.exec(`ALTER TABLE drafts ADD COLUMN version INTEGER DEFAULT 1`);
} catch {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE drafts ADD COLUMN clips TEXT`);
} catch {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE drafts ADD COLUMN timeline TEXT`);
} catch {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE drafts ADD COLUMN project_config TEXT`);
} catch {
  // Column already exists
}

// V1 Draft (single video - legacy)
export interface DraftV1 {
  id: string;
  name: string;
  version: 1;
  videoPath?: string;
  subtitles?: SubtitleLine[];
  config?: SubtitleConfig;
  createdAt: Date;
  updatedAt: Date;
}

// V2 Draft (multi-video)
export interface DraftV2 {
  id: string;
  name: string;
  version: 2;
  clips: VideoClip[];
  timeline: TimelineClip[];
  projectConfig: ProjectConfig;
  subtitleConfig: SubtitleConfig;
  createdAt: Date;
  updatedAt: Date;
}

// Union type for drafts
export type Draft = DraftV1 | DraftV2;

interface DraftRow {
  id: string;
  name: string;
  version: number | null;
  video_path: string | null;
  subtitles: string | null;
  config: string | null;
  clips: string | null;
  timeline: string | null;
  project_config: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Save or update a V1 draft (legacy single-video)
 */
export function saveDraftV1(draft: {
  id?: string;
  name: string;
  videoPath?: string;
  subtitles?: SubtitleLine[];
  config?: SubtitleConfig;
}): DraftV1 {
  const now = Date.now();
  const id = draft.id || uuidv4();
  
  const existing = db.prepare("SELECT id FROM drafts WHERE id = ?").get(id);
  
  if (existing) {
    db.prepare(`
      UPDATE drafts SET
        name = ?,
        version = 1,
        video_path = ?,
        subtitles = ?,
        config = ?,
        clips = NULL,
        timeline = NULL,
        project_config = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(
      draft.name,
      draft.videoPath || null,
      draft.subtitles ? JSON.stringify(draft.subtitles) : null,
      draft.config ? JSON.stringify(draft.config) : null,
      now,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO drafts (id, name, version, video_path, subtitles, config, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
    `).run(
      id,
      draft.name,
      draft.videoPath || null,
      draft.subtitles ? JSON.stringify(draft.subtitles) : null,
      draft.config ? JSON.stringify(draft.config) : null,
      now,
      now
    );
  }
  
  return loadDraft(id) as DraftV1;
}

/**
 * Save or update a V2 draft (multi-video)
 */
export function saveDraftV2(draft: {
  id?: string;
  name: string;
  clips: VideoClip[];
  timeline: TimelineClip[];
  projectConfig: ProjectConfig;
  subtitleConfig: SubtitleConfig;
}): DraftV2 {
  const now = Date.now();
  const id = draft.id || uuidv4();
  
  const existing = db.prepare("SELECT id FROM drafts WHERE id = ?").get(id);
  
  if (existing) {
    db.prepare(`
      UPDATE drafts SET
        name = ?,
        version = 2,
        video_path = NULL,
        subtitles = NULL,
        config = ?,
        clips = ?,
        timeline = ?,
        project_config = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      draft.name,
      JSON.stringify(draft.subtitleConfig),
      JSON.stringify(draft.clips),
      JSON.stringify(draft.timeline),
      JSON.stringify(draft.projectConfig),
      now,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO drafts (id, name, version, config, clips, timeline, project_config, created_at, updated_at)
      VALUES (?, ?, 2, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      draft.name,
      JSON.stringify(draft.subtitleConfig),
      JSON.stringify(draft.clips),
      JSON.stringify(draft.timeline),
      JSON.stringify(draft.projectConfig),
      now,
      now
    );
  }
  
  return loadDraft(id) as DraftV2;
}

/**
 * Save a draft (auto-detect version based on structure)
 * @deprecated Use saveDraftV1 or saveDraftV2 directly
 */
export function saveDraft(draft: {
  id?: string;
  name: string;
  videoPath?: string;
  subtitles?: SubtitleLine[];
  config?: SubtitleConfig;
}): DraftV1 {
  return saveDraftV1(draft);
}

/**
 * Load a single draft by ID
 * Automatically detects V1/V2 format
 */
export function loadDraft(id: string): Draft | null {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(id) as DraftRow | undefined;
  
  if (!row) return null;
  
  return rowToDraft(row);
}

/**
 * Convert database row to Draft object
 */
function rowToDraft(row: DraftRow): Draft {
  const version = row.version || 1;
  
  if (version === 2 && row.clips && row.timeline) {
    return {
      id: row.id,
      name: row.name,
      version: 2,
      clips: JSON.parse(row.clips),
      timeline: JSON.parse(row.timeline),
      projectConfig: row.project_config ? JSON.parse(row.project_config) : DEFAULT_PROJECT_CONFIG,
      subtitleConfig: row.config ? JSON.parse(row.config) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
  
  return {
    id: row.id,
    name: row.name,
    version: 1,
    videoPath: row.video_path || undefined,
    subtitles: row.subtitles ? JSON.parse(row.subtitles) : undefined,
    config: row.config ? JSON.parse(row.config) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * List all drafts, most recent first
 */
export function listDrafts(): Draft[] {
  const rows = db.prepare("SELECT * FROM drafts ORDER BY updated_at DESC").all() as DraftRow[];
  return rows.map(rowToDraft);
}

/**
 * Migrate a V1 draft to V2 format
 */
export function migrateDraftToV2(id: string): DraftV2 | null {
  const draft = loadDraft(id);
  if (!draft) return null;
  
  if (draft.version === 2) {
    return draft as DraftV2;
  }
  
  // Convert V1 to V2 using the migration function
  const v1 = draft as DraftV1;
  const v1State: ProjectState = {
    version: 1,
    timestamp: draft.updatedAt.getTime(),
    videoPath: v1.videoPath || null,
    subtitles: v1.subtitles || [],
    config: v1.config || { ffmpeg: { hwaccel: 'none', preset: 'veryfast', crf: 23, resolution: 'original' } },
  };
  
  const v2State = migrateToMultiVideo(v1State);
  
  return saveDraftV2({
    id: draft.id,
    name: draft.name,
    clips: v2State.clips,
    timeline: v2State.timeline,
    projectConfig: v2State.projectConfig,
    subtitleConfig: v2State.subtitleConfig,
  });
}

/**
 * Delete a draft by ID
 * Also cleans up any associated video files
 */
export function deleteDraft(id: string): boolean {
  const draft = loadDraft(id);
  
  if (!draft) return false;
  
  // Delete associated video files
  if (draft.version === 1 && draft.videoPath && fs.existsSync(draft.videoPath)) {
    try {
      fs.unlinkSync(draft.videoPath);
      console.log(`[DraftStore] Deleted video file: ${draft.videoPath}`);
    } catch (err) {
      console.error(`[DraftStore] Failed to delete video file: ${draft.videoPath}`, err);
    }
  } else if (draft.version === 2) {
    // Delete all clip video files
    for (const clip of draft.clips) {
      if (clip.filePath && fs.existsSync(clip.filePath)) {
        try {
          fs.unlinkSync(clip.filePath);
          console.log(`[DraftStore] Deleted clip file: ${clip.filePath}`);
        } catch (err) {
          console.error(`[DraftStore] Failed to delete clip file: ${clip.filePath}`, err);
        }
      }
    }
  }
  
  // Delete metadata sidecar
  try {
    const metaPath = getMetadataPath(id);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      console.log(`[DraftStore] Deleted metadata: ${metaPath}`);
    }
  } catch (err) {
    console.error(`[DraftStore] Failed to delete metadata for ${id}`, err);
  }

  // Delete export directory
  try {
    const stagingDir = getStagingDir();
    const exportsDir = path.join(stagingDir, 'exports', id);
    if (fs.existsSync(exportsDir)) {
      fs.rmSync(exportsDir, { recursive: true, force: true });
      console.log(`[DraftStore] Deleted exports directory: ${exportsDir}`);
    }
  } catch (err) {
    console.error(`[DraftStore] Failed to delete exports for ${id}`, err);
  }
  
  // Delete from database
  const result = db.prepare("DELETE FROM drafts WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Delete drafts older than a certain age
 */
export function cleanupOldDrafts(maxAgeDays: number = 30): number {
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  
  // Get drafts to delete for file cleanup
  const oldDrafts = db.prepare("SELECT * FROM drafts WHERE updated_at < ?").all(cutoff) as DraftRow[];
  
  // Delete video files
  for (const row of oldDrafts) {
    const draft = rowToDraft(row);
    
    if (draft.version === 1 && draft.videoPath && fs.existsSync(draft.videoPath)) {
      try {
        fs.unlinkSync(draft.videoPath);
      } catch (err) {
        console.error(`[DraftStore] Failed to delete video file: ${draft.videoPath}`, err);
      }
    } else if (draft.version === 2) {
      for (const clip of draft.clips) {
        if (clip.filePath && fs.existsSync(clip.filePath)) {
          try {
            fs.unlinkSync(clip.filePath);
          } catch (err) {
            console.error(`[DraftStore] Failed to delete clip file: ${clip.filePath}`, err);
          }
        }
      }
    }
  }
  
  // Delete from database
  const result = db.prepare("DELETE FROM drafts WHERE updated_at < ?").run(cutoff);
  return result.changes;
}

/**
 * Check if a draft is V2 format
 */
export function isV2Draft(draft: Draft): draft is DraftV2 {
  return draft.version === 2;
}

/**
 * Close the database connection
 */
export function close(): void {
  db.close();
}

