import { createJob, updateJob, getJob, cleanupOldJobs } from './job-store';

describe('job-store', () => {
    beforeEach(() => {
        // Since job-store is a module with side-effects (map), we can't easily reset it without re-require or export a reset function.
        // Assuming we rely on creating unique IDs for isolation or we accept shared state if tests run sequentially.
        // Or we just add a 'clear' method to job-store for testing?
        // job-store.ts doesn't export clear.
        // We'll use unique IDs.
    });

    test('createJob adds a job to the store', () => {
        const job = createJob('job-1');
        expect(job.id).toBe('job-1');
        expect(job.status).toBe('pending');
        expect(getJob('job-1')).toEqual(job);
    });

    test('updateJob modifies existing job', () => {
        createJob('job-2');
        const updated = updateJob('job-2', { status: 'processing', progress: 50 });
        
        expect(updated?.status).toBe('processing');
        expect(updated?.progress).toBe(50);
        
        const stored = getJob('job-2');
        expect(stored?.status).toBe('processing');
    });

    test('updateJob returns undefined for non-existent job', () => {
        const result = updateJob('non-existent', { progress: 100 });
        expect(result).toBeUndefined();
    });

    test('cleanupOldJobs removes expired jobs', () => {
        const jobRecent = createJob('recent');
        const jobOld = createJob('old');
        
        // Manually tamper timestamps if possible? 
        // job-store exports objects directly.
        (jobOld as any).createdAt = Date.now() - 10000;
        
        // Cleanup with maxAge = 10ms
        cleanupOldJobs(100); // 100ms
        
        expect(getJob('recent')).toBeDefined();
        // createJob sets timestamp to Date.now().
        // If test runs fast, recent is < 100ms.
        // jobOld set to -10000ms. > 100ms.
        expect(getJob('old')).toBeUndefined();
    });
});
