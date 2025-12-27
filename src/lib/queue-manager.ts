import { SubtitleLine } from '@/types/subtitle';
import { v4 as uuidv4 } from 'uuid';
import * as queueDb from './queue-db';
import path from 'path';
import os from 'os';

export interface QueueItem {
  id: string;
  file: {
    name: string;
    size: number;
    path?: string; // Path in staging directory (optional for export jobs)
    type?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  model?: string;
  secondaryLanguage?: string;
  sampleDuration?: number; // Optional: 2, 5, or 10 seconds for sample jobs
  result?: {
    subtitles?: SubtitleLine[];
    videoPath?: string;
    srtPath?: string;
  };
  error?: string;
  failureReason?: 'crash' | 'api_error' | 'user_cancelled' | 'unknown'; // Type of failure
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount?: number; // Number of times this job has been retried
  metadata?: Record<string, any>; // Additional metadata
}

export type QueueItemStatus = QueueItem['status'];

export interface QueueConfig {
  stagingDir: string;
  maxConcurrent: number; // 1 for sequential, >1 for parallel
  autoStart: boolean;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

class QueueManager {
  private queue: Map<string, QueueItem> = new Map();
  private processing: Set<string> = new Set();
  private paused: boolean = false;
  private initialized: boolean = false;
  
  private config: QueueConfig = {
    stagingDir: '',
    maxConcurrent: 1, // Sequential by default
    autoStart: false,
  };

  constructor() {
    if (typeof process !== 'undefined') {
      process.on('SIGINT', () => {
        console.log('[Queue] SIGINT received - closing database...');
        queueDb.close();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('[Queue] SIGTERM received - closing database...');
        queueDb.close();
        process.exit(0);
      });
    }
  }

  /**
   * Save a single item to SQLite (replaces saveState for individual updates)
   */
  private persistItem(item: QueueItem): void {
    try {
      queueDb.saveItem(item);
    } catch (error) {
      console.error('[Queue] Failed to persist item:', error);
    }
  }

  /**
   * Load queue state from SQLite
   */
  private loadState(): void {
    try {
      const items = queueDb.loadAllItems();
      this.queue = new Map(items.map(item => [item.id, item]));
      this.paused = queueDb.isPaused();
      
      console.log(`[Queue] Loaded ${this.queue.size} items from SQLite`);
    } catch (error) {
      console.error('[Queue] Failed to load state from SQLite:', error);
    }
  }

  /**
   * Initialize queue manager and recover from crashes
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.loadState();
    
    const processingItems = Array.from(this.queue.values())
      .filter(item => item.status === 'processing');
    
    let wasInterrupted = processingItems.length > 0;
    
    if (processingItems.length > 0) {
      console.log(`[Queue Recovery] Found ${processingItems.length} interrupted jobs`);
      
      processingItems.forEach(item => {
        this.updateItem(item.id, {
          status: 'failed',
          error: 'Server was restarted during processing',
          failureReason: 'crash',
          progress: 0,
          completedAt: Date.now(),
        });
        
        this.processing.delete(item.id);
        
        this.requeueItem(item.id, true);
      });
      
      console.log('[Queue Recovery] Interrupted jobs requeued with crash status');
    }
    
    if (this.queue.size > 0) {
      this.paused = true;
      if (wasInterrupted) {
        console.log('[Queue Recovery] Queue PAUSED - interrupted jobs detected');
      } else {
        console.log('[Queue Recovery] Queue PAUSED - server was restarted');
      }
      console.log('[Queue] User must manually resume processing');
    }
    
    this.initialized = true;
    queueDb.setPaused(this.paused); // Persist paused state to SQLite
  }

  /**
   * Add a new item to the queue
   */
  addItem(item: Omit<QueueItem, 'id' | 'status' | 'progress' | 'createdAt'>): QueueItem {
    const queueItem: QueueItem = {
      ...item,
      id: uuidv4(),
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
    };
    
    this.queue.set(queueItem.id, queueItem);
    this.persistItem(queueItem); // Persist to SQLite
    
    if (this.config.autoStart && !this.paused) {
      this.processNext();
    }
    
    return queueItem;
  }

  /**
   * Get a queue item by ID
   */
  getItem(id: string): QueueItem | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all queue items
   */
  getAllItems(): QueueItem[] {
    return Array.from(this.queue.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get items by status
   */
  getItemsByStatus(status: QueueItem['status']): QueueItem[] {
    return this.getAllItems().filter(item => item.status === status);
  }

  /**
   * Update a queue item
   */
  updateItem(id: string, updates: Partial<QueueItem>): void {
    const item = this.queue.get(id);
    if (item) {
      Object.assign(item, updates);
      this.persistItem(item); // Persist to SQLite
    }
  }

   /**
   * Remove an item from the queue (allow removing even if processing)
   */
  removeItem(id: string, force: boolean = false): boolean {
    const item = this.queue.get(id);
    
    if (item?.status === 'processing' && !force) {
      return false;
    }
    
    if (item?.status === 'processing') {
      this.processing.delete(id);
      this.processNext(); // Start next item
    }
    
    const removed = this.queue.delete(id);
    if (removed) {
      queueDb.deleteItem(id); // Remove from SQLite
    }
    
    return removed;
  }

  /**
   * Cancel the currently processing item and return it to queue
   */
  cancelCurrent(): boolean {
    const processingItems = Array.from(this.processing);
    
    if (processingItems.length === 0) {
      return false;
    }
    
    const currentId = processingItems[0];
    this.updateItem(currentId, {
      status: 'pending',
      progress: 0,
      startedAt: undefined,
    });
    
    this.processing.delete(currentId);
    return true;
  }

  /**
   * Retry a failed item (reset to pending)
   */
  retryItem(id: string): boolean {
    const item = this.queue.get(id);
    
    if (!item || item.status !== 'failed') {
      return false;
    }
    
    this.updateItem(id, {
      status: 'pending',
      progress: 0,
      error: undefined,
      completedAt: undefined,
    });
    
    if (!this.paused) {
      this.processNext();
    }
    
    return true;
  }

  /**
   * Clear all completed and failed items
   */
  clearCompleted(): number {
    let count = 0;
    
    for (const [id, item] of this.queue.entries()) {
      if (item.status === 'completed' || item.status === 'failed') {
        this.queue.delete(id);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Clear all items (except processing)
   */
  clearAll(): number {
    let count = 0;
    
    for (const [id, item] of this.queue.entries()) {
      if (item.status !== 'processing') {
        this.queue.delete(id);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const items = this.getAllItems();
    
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      processing: items.filter(i => i.status === 'processing').length,
      completed: items.filter(i => i.status === 'completed').length,
      failed: items.filter(i => i.status === 'failed').length,
    };
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<void> {
    this.paused = false;
    queueDb.setPaused(false); // Persist pause state to SQLite
    this.processNext();
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.paused = true;
    queueDb.setPaused(true); // Persist pause state to SQLite
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.start();
  }

  /**
   * Check if queue is paused
   */
  getPausedState(): boolean {
    return this.paused;
  }

  /**
   * Check if queue is actively processing
   */
  isProcessing(): boolean {
    return this.processing.size > 0;
  }

  /**
   * Process the next item(s) in the queue
   */
  private processNext(): void {
    if (this.paused) {
      return;
    }
    
    const canProcessMore = this.processing.size < this.config.maxConcurrent;
    
    if (!canProcessMore) {
      return;
    }
    
    const pendingItems = this.getItemsByStatus('pending');
    
    if (pendingItems.length === 0) {
      return;
    }
    
    const itemsToProcess = pendingItems.slice(0, this.config.maxConcurrent - this.processing.size);
    
    itemsToProcess.forEach(item => {
      this.processing.add(item.id);
      this.updateItem(item.id, {
        status: 'processing',
        startedAt: Date.now(),
      });
      
    });
  }

  /**
   * Mark an item as completed
   */
  completeItem(id: string, result: QueueItem['result']): void {
    this.updateItem(id, {
      status: 'completed',
      progress: 100,
      result,
      completedAt: Date.now(),
    });
    
    this.processing.delete(id);
    this.processNext();
  }

  /**
   * Mark an item as failed and optionally keep in queue for retry
   */
  failItem(id: string, error: string, retry: boolean = true, reason: QueueItem['failureReason'] = 'unknown'): void {
    if (retry) {
      const item = this.queue.get(id);
      const retryCount = (item?.retryCount || 0) + 1;
      
      this.updateItem(id, {
        status: 'failed',
        error,
        failureReason: reason,
        completedAt: Date.now(),
        retryCount,
      });
    } else {
      this.updateItem(id, {
        status: 'failed',
        error,
        failureReason: reason,
        completedAt: Date.now(),
      });
    }
    
    this.processing.delete(id);
    this.processNext();
  }

  /**
   * Requeue a failed item (optionally at the top for crash recovery)
   */
  requeueItem(id: string, prioritize: boolean = false): boolean {
    const item = this.queue.get(id);
    
    if (!item || (item.status !== 'failed' && item.status !== 'pending')) {
      return false;
    }
    
    this.updateItem(id, {
      status: 'pending',
      progress: 0,
      error: undefined,
      completedAt: undefined,
      startedAt: undefined,
    });
    
    if (prioritize) {
      const earliestTime = Math.min(
        ...Array.from(this.queue.values())
          .filter(i => i.status === 'pending')
          .map(i => i.createdAt),
        Date.now()
      );
      
      this.updateItem(id, {
        createdAt: earliestTime - 1, // Ensure it's first
      });
    }
    
    if (!this.paused) {
      this.processNext();
    }
    
    return true;
  }

  /**
   * Update item progress
   */
  updateProgress(id: string, progress: number): void {
    this.updateItem(id, { progress });
  }

  /**
   * Set queue configuration
   */
  setConfig(config: Partial<QueueConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get queue configuration
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * Get next item to process (for external processors)
   */
  getNextToProcess(): QueueItem | null {
    const processing = Array.from(this.processing);
    
    if (processing.length === 0) {
      return null;
    }
    
    const item = this.queue.get(processing[0]);
    return item || null;
  }

  /**
   * Estimate time remaining for queue
   */
  getEstimatedTimeRemaining(): number | null {
    const completedItems = this.getItemsByStatus('completed');
    
    if (completedItems.length === 0) {
      return null;
    }
    
    const avgTime = completedItems.reduce((sum, item) => {
      const duration = (item.completedAt || 0) - (item.startedAt || 0);
      return sum + duration;
    }, 0) / completedItems.length;
    
    const pendingCount = this.getItemsByStatus('pending').length;
    const processingCount = this.processing.size;
    
    const estimatedMs = (pendingCount * avgTime) + (processingCount * avgTime * 0.5);
    
    return estimatedMs;
  }
}

export const queueManager = new QueueManager();
