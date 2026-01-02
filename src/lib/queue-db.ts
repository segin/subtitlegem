/**
 * SQLite-based Queue Database
 * 
 * Replaces the JSON file-based persistence for the queue manager.
 * Uses better-sqlite3 for synchronous, performant SQLite access.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { getStagingDir, ensureStagingStructure } from './storage-config';
import { QueueItem, QueueItemStatus } from './queue-manager';

let db: Database.Database | null = null;

/**
 * Initialize the database and create tables if needed
 */
function getDb(): Database.Database {
  if (db) return db;
  
  const stagingDir = getStagingDir();
  ensureStagingStructure(stagingDir);
  const dbPath = path.join(stagingDir, 'queue.db');

  
  db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_items (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      error TEXT,
      failure_reason TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      result_video_path TEXT,
      result_srt_path TEXT,
      metadata TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_items(status);
    CREATE INDEX IF NOT EXISTS idx_queue_created ON queue_items(created_at);
    
    CREATE TABLE IF NOT EXISTS queue_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  

  return db;
}

/**
 * Save a queue item to the database
 */
export function saveItem(item: QueueItem): void {
  const database = getDb();
  
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO queue_items (
      id, status, progress, file_name, file_size, file_type,
      created_at, started_at, completed_at, error, failure_reason,
      retry_count, result_video_path, result_srt_path, metadata
    ) VALUES (
      @id, @status, @progress, @fileName, @fileSize, @fileType,
      @createdAt, @startedAt, @completedAt, @error, @failureReason,
      @retryCount, @resultVideoPath, @resultSrtPath, @metadata
    )
  `);
  
  stmt.run({
    id: item.id,
    status: item.status,
    progress: item.progress,
    fileName: item.file.name,
    fileSize: item.file.size,
    fileType: item.file.type || null,
    createdAt: item.createdAt,
    startedAt: item.startedAt || null,
    completedAt: item.completedAt || null,
    error: item.error || null,
    failureReason: item.failureReason || null,
    retryCount: item.retryCount || 0,
    resultVideoPath: item.result?.videoPath || null,
    resultSrtPath: item.result?.srtPath || null,
    metadata: item.metadata ? JSON.stringify(item.metadata) : null,
  });
}

/**
 * Load all queue items from the database
 */
export function loadAllItems(): QueueItem[] {
  const database = getDb();
  
  const rows = database.prepare(`
    SELECT * FROM queue_items ORDER BY created_at ASC
  `).all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    status: row.status as QueueItemStatus,
    progress: row.progress,
    file: {
      name: row.file_name,
      size: row.file_size,
      type: row.file_type,
    },
    createdAt: row.created_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
    error: row.error || undefined,
    failureReason: row.failure_reason || undefined,
    retryCount: row.retry_count || undefined,
    result: row.result_video_path ? {
      videoPath: row.result_video_path,
      srtPath: row.result_srt_path,
    } : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Delete a queue item by ID
 */
export function deleteItem(id: string): boolean {
  const database = getDb();
  const result = database.prepare('DELETE FROM queue_items WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Update item status
 */
export function updateStatus(id: string, status: QueueItemStatus, progress: number = 0): void {
  const database = getDb();
  
  const updates: any = { id, status, progress };
  let sql = 'UPDATE queue_items SET status = @status, progress = @progress';
  
  if (status === 'processing') {
    sql += ', started_at = @startedAt';
    updates.startedAt = Date.now();
  } else if (status === 'completed' || status === 'failed') {
    sql += ', completed_at = @completedAt';
    updates.completedAt = Date.now();
  }
  
  sql += ' WHERE id = @id';
  database.prepare(sql).run(updates);
}

/**
 * Update item error
 */
export function updateError(id: string, error: string, failureReason?: string): void {
  const database = getDb();
  database.prepare(`
    UPDATE queue_items SET error = ?, failure_reason = ? WHERE id = ?
  `).run(error, failureReason || null, id);
}

/**
 * Increment retry count
 */
export function incrementRetryCount(id: string): void {
  const database = getDb();
  database.prepare(`
    UPDATE queue_items SET retry_count = retry_count + 1 WHERE id = ?
  `).run(id);
}

/**
 * Update item result
 */
export function updateResult(id: string, videoPath: string, srtPath?: string): void {
  const database = getDb();
  database.prepare(`
    UPDATE queue_items SET result_video_path = ?, result_srt_path = ? WHERE id = ?
  `).run(videoPath, srtPath || null, id);
}

/**
 * Get paused state
 */
export function isPaused(): boolean {
  const database = getDb();
  const row = database.prepare(`
    SELECT value FROM queue_state WHERE key = 'paused'
  `).get() as any;
  return row?.value === 'true';
}

/**
 * Set paused state
 */
export function setPaused(paused: boolean): void {
  const database = getDb();
  database.prepare(`
    INSERT OR REPLACE INTO queue_state (key, value) VALUES ('paused', ?)
  `).run(paused ? 'true' : 'false');
}

/**
 * Get items by status
 */
export function getItemsByStatus(status: QueueItemStatus): QueueItem[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM queue_items WHERE status = ? ORDER BY created_at ASC
  `).all(status) as any[];
  
  return rows.map(row => ({
    id: row.id,
    status: row.status as QueueItemStatus,
    progress: row.progress,
    file: {
      name: row.file_name,
      size: row.file_size,
      type: row.file_type,
    },
    createdAt: row.created_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
    error: row.error || undefined,
    failureReason: row.failure_reason || undefined,
    retryCount: row.retry_count || undefined,
    result: row.result_video_path ? {
      videoPath: row.result_video_path,
      srtPath: row.result_srt_path,
    } : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Mark interrupted processing jobs as failed (for crash recovery)
 */
export function markInterruptedAsFailed(): number {
  const database = getDb();
  const result = database.prepare(`
    UPDATE queue_items 
    SET status = 'failed', 
        error = 'Process interrupted - server restart',
        failure_reason = 'crash'
    WHERE status = 'processing'
  `).run();
  return result.changes;
}

/**
 * Clear completed items
 */
export function clearCompleted(): number {
  const database = getDb();
  const result = database.prepare(`
    DELETE FROM queue_items WHERE status = 'completed'
  `).run();
  return result.changes;
}

/**
 * Get a single item by ID
 */
export function getItem(id: string): QueueItem | null {
  const database = getDb();
  const row = database.prepare(`
    SELECT * FROM queue_items WHERE id = ?
  `).get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    status: row.status as QueueItemStatus,
    progress: row.progress,
    file: {
      name: row.file_name,
      size: row.file_size,
      type: row.file_type,
    },
    createdAt: row.created_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
    error: row.error || undefined,
    failureReason: row.failure_reason || undefined,
    retryCount: row.retry_count || undefined,
    result: row.result_video_path ? {
      videoPath: row.result_video_path,
      srtPath: row.result_srt_path,
    } : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

/**
 * Close the database connection
 */
export function close(): void {
  if (db) {
    db.close();
    db = null;
  // console.log('[SQLite] Database closed');
  }
}
