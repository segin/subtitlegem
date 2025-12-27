// A simple in-memory store for tracking long-running job statuses.
// For production, this should be replaced with a persistent store like Redis.

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  resultPath?: string;
  createdAt: number;
  updatedAt: number;
}

const jobs = new Map<string, Job>();

export const createJob = (id: string): Job => {
  const job: Job = {
    id,
    status: 'pending',
    progress: 0,
    message: 'Job created and awaiting process.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
};

export const updateJob = (id: string, updates: Partial<Job>) => {
  if (jobs.has(id)) {
    const job = jobs.get(id)!;
    const updatedJob = { ...job, ...updates, updatedAt: Date.now() };
    jobs.set(id, updatedJob);
    return updatedJob;
  }
};

export const getJob = (id: string): Job | undefined => {
  return jobs.get(id);
};

// Simple cleanup for old jobs (run periodically or on startup)
export const cleanupJobs = () => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
        if (now - job.createdAt > 1000 * 60 * 60 * 24) { // 24 hours
            jobs.delete(id);
        }
    }
};
