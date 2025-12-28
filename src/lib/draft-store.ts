/**
 * Draft Store - SQLite-based storage for incomplete projects
 * 
 * Stores drafts that were started but not submitted for processing.
 * Users can resume or delete these drafts from the upload screen.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { SubtitleLine, SubtitleConfig } from "@/types/subtitle";
import { getStagingDir, ensureStagingStructure } from './storage-config';

const stagingDir = getStagingDir();
ensureStagingStructure(stagingDir);

const dbPath = path.join(stagingDir, "drafts.db");
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create drafts table
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

export interface Draft {
  id: string;
  name: string;
  videoPath?: string;
  subtitles?: SubtitleLine[];
  config?: SubtitleConfig;
  createdAt: Date;
  updatedAt: Date;
}

interface DraftRow {
  id: string;
  name: string;
  video_path: string | null;
  subtitles: string | null;
  config: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Save or update a draft
 */
export function saveDraft(draft: {
  id?: string;
  name: string;
  videoPath?: string;
  subtitles?: SubtitleLine[];
  config?: SubtitleConfig;
}): Draft {
  const now = Date.now();
  const id = draft.id || uuidv4();
  
  const existing = db.prepare("SELECT id FROM drafts WHERE id = ?").get(id);
  
  if (existing) {
    // Update existing draft
    db.prepare(`
      UPDATE drafts SET
        name = ?,
        video_path = ?,
        subtitles = ?,
        config = ?,
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
    // Insert new draft
    db.prepare(`
      INSERT INTO drafts (id, name, video_path, subtitles, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
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
  
  return loadDraft(id)!;
}

/**
 * Load a single draft by ID
 */
export function loadDraft(id: string): Draft | null {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(id) as DraftRow | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
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
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    videoPath: row.video_path || undefined,
    subtitles: row.subtitles ? JSON.parse(row.subtitles) : undefined,
    config: row.config ? JSON.parse(row.config) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Delete a draft by ID
 * Also cleans up any associated video files
 */
export function deleteDraft(id: string): boolean {
  const draft = loadDraft(id);
  
  if (!draft) return false;
  
  // Delete associated video file if exists
  if (draft.videoPath && fs.existsSync(draft.videoPath)) {
    try {
      fs.unlinkSync(draft.videoPath);
      console.log(`[DraftStore] Deleted video file: ${draft.videoPath}`);
    } catch (err) {
      console.error(`[DraftStore] Failed to delete video file: ${draft.videoPath}`, err);
    }
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
    if (row.video_path && fs.existsSync(row.video_path)) {
      try {
        fs.unlinkSync(row.video_path);
      } catch (err) {
        console.error(`[DraftStore] Failed to delete video file: ${row.video_path}`, err);
      }
    }
  }
  
  // Delete from database
  const result = db.prepare("DELETE FROM drafts WHERE updated_at < ?").run(cutoff);
  return result.changes;
}

/**
 * Close the database connection
 */
export function close(): void {
  db.close();
}
