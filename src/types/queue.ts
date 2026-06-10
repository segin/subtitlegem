import { SubtitleLine, FFmpegConfig, MultiVideoProjectState } from '@/types/subtitle';

/** Job-specific data attached to a queue item (e.g. for export/burn jobs). */
export interface QueueItemMetadata {
  type?: string; // e.g. 'multi-export'
  videoPath?: string;
  assPath?: string;
  outputPath?: string;
  sampleDuration?: number;
  ffmpegConfig?: FFmpegConfig;
  projectState?: MultiVideoProjectState;
}

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
  metadata?: QueueItemMetadata; // Additional job-specific metadata
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
