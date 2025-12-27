import { SubtitleLine } from '@/types/subtitle';
import { v4 as uuidv4 } from 'uuid';

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
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
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
  
  private config: QueueConfig = {
    stagingDir: '',
    maxConcurrent: 1, // Sequential by default
    autoStart: false,
  };

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
    
    return this.queue.delete(id);
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
    this.processNext();
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.paused = true;
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
  failItem(id: string, error: string, retry: boolean = true): void {
    if (retry) {
      // Keep in queue as failed for retry
      this.updateItem(id, {
        status: 'failed',
        error,
        completedAt: Date.now(),
      });
    } else {
      // Mark as failed and remove from processing
      this.updateItem(id, {
        status: 'failed',
        error,
        completedAt: Date.now(),
      });
    }
    
    this.processing.delete(id);
    this.processNext();
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
