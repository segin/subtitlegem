import { SubtitleLine } from '@/types/subtitle';

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
