import { SubtitleLine } from '@/types/subtitle';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface QueueItem {
  id: string;
  file: {
    name: string;
    size: number;
    path: string; // Path in staging directory
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  model: string;
  secondaryLanguage: string;
  sampleDuration?: number; // Optional: 2, 5, or 10 seconds for sample jobs
  result?: {
    subtitles: SubtitleLine[];
    videoPath: string;
  };
  error?: string;
  failureReason?: 'crash' | 'api_error' | 'user_cancelled' | 'unknown'; // Type of failure
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount?: number; // Number of times this job has been retried
}

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
  private persistencePath: string;
  
  private config: QueueConfig = {
    stagingDir: '',
    maxConcurrent: 1, // Sequential by default
    autoStart: false,
  };

  constructor() {
    // Set persistence path to staging directory or temp
    const baseDir = process.env.STAGING_DIR || path.join(os.tmpdir(), 'subtitlegem');
    this.persistencePath = path.join(baseDir, 'queue-state.json');
    
    // Register shutdown handlers to save state on exit
    if (typeof process !== 'undefined') {
      process.on('SIGINT', () => {
        console.log('[Queue] SIGINT received - saving state...');
        this.saveState();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('[Queue] SIGTERM received - saving state...');
        this.saveState();
        process.exit(0);
      });
      
      process.on('exit', () => {
        console.log('[Queue] Process exiting - saving state...');
        this.saveState();
      });
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (err) => {
        console.error('[Queue] Uncaught exception - saving state...', err);
        this.saveState();
        process.exit(1);
      });
    }
  }

  /**
   * Save queue state to disk for crash recovery
   */
  private saveState(): void {
    try {
      const state = {
        items: Array.from(this.queue.entries()),
        processing: Array.from(this.processing),
        paused: this.paused,
        config: this.config,
        savedAt: Date.now(),
      };
      
      // Ensure directory exists
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.persistencePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('[Queue] Failed to save state:', error);
    }
  }

  /**
   * Load queue state from disk
   */
  private loadState(): void {
    try {
      if (!fs.existsSync(this.persistencePath)) {
        return;
      }
      
      const data = fs.readFileSync(this.persistencePath, 'utf-8');
      const state = JSON.parse(data);
      
      // Restore queue items
      this.queue = new Map(state.items);
      this.processing = new Set(state.processing);
      this.paused = state.paused || false;
      
      if (state.config) {
        this.config = { ...this.config, ...state.config };
      }
      
      console.log(`[Queue] Loaded ${this.queue.size} items from disk (saved at ${new Date(state.savedAt).toISOString()})`);
    } catch (error) {
      console.error('[Queue] Failed to load state:', error);
    }
  }

  /**
   * Initialize queue manager and recover from crashes
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Load persisted state from disk
    this.loadState();
    
    // Check for any items that were processing when server stopped
    const processingItems = Array.from(this.queue.values())
      .filter(item => item.status === 'processing');
    
    let wasInterrupted = processingItems.length > 0;
    
    if (processingItems.length > 0) {
      console.log(`[Queue Recovery] Found ${processingItems.length} interrupted jobs`);
      
      // Mark as failed with crash reason and requeue at top
      processingItems.forEach(item => {
        this.updateItem(item.id, {
          status: 'failed',
          error: 'Server was restarted during processing',
          failureReason: 'crash',
          progress: 0,
          completedAt: Date.now(),
        });
        
        this.processing.delete(item.id);
        
        // Requeue at the top (will be processed first)
        this.requeueItem(item.id, true);
      });
      
      console.log('[Queue Recovery] Interrupted jobs requeued with crash status');
    }
    
    // ALWAYS pause queue after any restart if there were jobs
    // (whether shutdown was clean or crash)
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
    this.saveState(); // Save after recovery
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
    this.saveState(); // Persist to disk
    
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
      this.saveState(); // Persist to disk
    }
  }

   /**
   * Remove an item from the queue (allow removing even if processing)
   */
  removeItem(id: string, force: boolean = false): boolean {
    const item = this.queue.get(id);
    
    // Don't remove if currently processing unless forced
    if (item?.status === 'processing' && !force) {
      return false;
    }
    
    // If removing a processing item, remove from processing set
    if (item?.status === 'processing') {
      this.processing.delete(id);
      this.processNext(); // Start next item
    }
    
    const removed = this.queue.delete(id);
    if (removed) {
      this.saveState(); // Persist to disk
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
    
    // Auto-start if not paused
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
    this.saveState(); // Persist pause state
    this.processNext();
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.paused = true;
    this.saveState(); // Persist pause state
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
    // Don't start new items if paused
    if (this.paused) {
      return;
    }
    
    // Check if we can process more items
    const canProcessMore = this.processing.size < this.config.maxConcurrent;
    
    if (!canProcessMore) {
      return;
    }
    
    // Get next pending item
    const pendingItems = this.getItemsByStatus('pending');
    
    if (pendingItems.length === 0) {
      return;
    }
    
    // Take as many items as we can process concurrently
    const itemsToProcess = pendingItems.slice(0, this.config.maxConcurrent - this.processing.size);
    
    itemsToProcess.forEach(item => {
      this.processing.add(item.id);
      this.updateItem(item.id, {
        status: 'processing',
        startedAt: Date.now(),
      });
      
      // The actual processing is handled externally via the API
      // This just marks items as ready to process
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
      // Keep in queue as failed for retry
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
      // Mark as failed and remove from processing
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
    
    // Reset to pending state
    this.updateItem(id, {
      status: 'pending',
      progress: 0,
      error: undefined,
      completedAt: undefined,
      startedAt: undefined,
    });
    
    // If prioritizing (e.g., crash recovery), adjust creation time to be earliest
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
    
    // Auto-start if not paused
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
    
    // Calculate average processing time
    const avgTime = completedItems.reduce((sum, item) => {
      const duration = (item.completedAt || 0) - (item.startedAt || 0);
      return sum + duration;
    }, 0) / completedItems.length;
    
    const pendingCount = this.getItemsByStatus('pending').length;
    const processingCount = this.processing.size;
    
    // Estimate: (pending items * avg time) + (processing items * remaining avg time)
    const estimatedMs = (pendingCount * avgTime) + (processingCount * avgTime * 0.5);
    
    return estimatedMs;
  }
}

// Export singleton instance
export const queueManager = new QueueManager();
