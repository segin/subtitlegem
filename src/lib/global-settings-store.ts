/**
 * Global Settings Store - SQLite-based storage for app-wide defaults
 * 
 * Persists user preferences for:
 * - Default subtitle styles (font size, margins)
 * - Default languages (primary, secondary)
 * - Default FFmpeg settings (hwaccel, preset, crf)
 * - Default Gemini model
 */

import Database from "better-sqlite3";
import path from "path";
import { GlobalSettings, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { getStagingDir, ensureStagingStructure } from './storage-config';

const stagingDir = getStagingDir();
ensureStagingStructure(stagingDir);

const dbPath = path.join(stagingDir, "settings.db");
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create settings table (single row)
db.exec(`
  CREATE TABLE IF NOT EXISTS global_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    settings_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

/**
 * Get current global settings. Returns defaults if none saved.
 */
export function getGlobalSettings(): GlobalSettings {
  const row = db.prepare("SELECT settings_json FROM global_settings WHERE id = 1").get() as { settings_json: string } | undefined;
  
  if (!row) {
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
  
  try {
    const saved = JSON.parse(row.settings_json);
    // Merge with defaults to ensure all fields exist (for upgrades)
    return { ...DEFAULT_GLOBAL_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
}

/**
 * Save global settings
 */
export function saveGlobalSettings(settings: GlobalSettings): void {
  const json = JSON.stringify(settings);
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO global_settings (id, settings_json, updated_at) 
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET settings_json = ?, updated_at = ?
  `).run(json, now, json, now);
}

/**
 * Reset to default settings
 */
export function resetGlobalSettings(): GlobalSettings {
  saveGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
  return { ...DEFAULT_GLOBAL_SETTINGS };
}
