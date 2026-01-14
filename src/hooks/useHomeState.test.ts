import { renderHook, act, waitFor } from '@testing-library/react';
import { useHomeState } from './useHomeState';
import { DEFAULT_CONFIG, DEFAULT_PROJECT_CONFIG } from '@/types/subtitle';

// Setup Mock Fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useHomeState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();

    // Default fetch behavior
    mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/api/queue')) {
            if (url.includes('action')) { // PUT
               return { ok: true, json: async () => ({}) };
            }
            return { ok: true, json: async () => ({ items: [], isPaused: false }) };
        }
        if (url.includes('/api/drafts')) {
             if (url.includes('DELETE')) {
                 return { ok: true, json: async () => ({}) };
             }
             return { ok: true, json: async () => ({ drafts: [] }) };
        }
        if (url.includes('/api/video-info')) {
            return { ok: true, json: async () => ({ width: 1920, height: 1080 }) };
        }
        return { ok: true, json: async () => ({}) };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initializes with default values', () => {
    const { result } = renderHook(() => useHomeState());

    expect(result.current.videoUrl).toBeNull();
    expect(result.current.videoPath).toBeNull();
    expect(result.current.duration).toBe(0);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
    expect(result.current.projectConfig).toEqual(DEFAULT_PROJECT_CONFIG);
    expect(result.current.loading).toBe(false);
    expect(result.current.activeTab).toBe('list');
  });

  test('queue polling starts on mount', async () => {
    renderHook(() => useHomeState());
    
    // Initial fetch
    expect(mockFetch).toHaveBeenCalledWith('/api/queue');
    
    // Advance timers
    await act(async () => {
        jest.advanceTimersByTime(3000);
    });
    
    // Should have polled multiple times
    expect(mockFetch.mock.calls.filter(c => c[0] === '/api/queue').length).toBeGreaterThan(1);
  });

  test('queue pause toggle', async () => {
    const { result } = renderHook(() => useHomeState());
    
    // Wait for initial poll to settle so it doesn't overwrite our toggle
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/queue'));
    
    await act(async () => {
        await result.current.toggleQueuePause();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/queue', expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('pause')
    }));
    
    // We strictly check the boolean toggle logic
    expect(result.current.queuePaused).toBe(true);
  });

  test('drafts fetching', async () => {
     // Use persistent implementation to handle multiple fetch calls from different hooks
     mockFetch.mockImplementation(async (url) => {
         if (url.includes('/api/drafts')) return {
             ok: true,
             json: async () => ({ drafts: [{ id: '1', name: 'Draft 1' }] })
         };
         // Support other hooks
         if (url.includes('/api/queue')) return { ok: true, json: async () => ({ items: [], isPaused: false }) };
         return { ok: true, json: async () => ({}) }; 
     });

     const { result } = renderHook(() => useHomeState());
     
     await waitFor(() => {
         expect(result.current.drafts).toHaveLength(1);
         expect(result.current.drafts[0].name).toBe('Draft 1');
     });
  });

  test('delete draft', async () => {
      // Seed with initial draft
      mockFetch.mockImplementation(async (url) => {
          if (url === '/api/drafts') return {
              ok: true, 
              json: async () => ({ drafts: [{id: '1', name: 'Draft 1'}] }) 
          };
          if (url.includes('DELETE')) return { ok: true, json: async () => ({}) };
          if (url.includes('/api/queue')) return { ok: true, json: async () => ({ items: [] }) };
          return { ok: true, json: async () => ({ items: [] }) };
      });

      const { result } = renderHook(() => useHomeState());

      await waitFor(() => expect(result.current.drafts).toHaveLength(1));

      await act(async () => {
          await result.current.handleDeleteDraft('1');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts?id=1', expect.objectContaining({ method: 'DELETE' }));
      expect(result.current.drafts).toHaveLength(0);
  });

  test('video properties loading', async () => {
      // Create a controlled promise
      let resolveFetch: Function;
      const fetchPromise = new Promise(resolve => { resolveFetch = resolve; });
      
      mockFetch.mockImplementation(async (url) => {
          if (url.includes('video-info')) {
              await fetchPromise;
              return { ok: true, json: async () => ({ width: 1920, height: 1080 }) };
          }
          return { ok: true, json: async () => ({}) };
      });

      const { result } = renderHook(() => useHomeState());

      let updatePromise: Promise<void>;
      act(() => {
          updatePromise = result.current.fetchVideoProperties('/test/vid.mp4');
      });

      // Should be loading now
      expect(result.current.videoPropsLoading).toBe(true);
      
      // Resolve fetch
      await act(async () => {
          resolveFetch!();
          await updatePromise;
      });

      expect(result.current.videoProperties).toEqual({ width: 1920, height: 1080 });
      expect(result.current.videoPropsLoading).toBe(false);
  });

  test('isMultiVideoMode calculation', () => {
    const { result } = renderHook(() => useHomeState());

    expect(result.current.isMultiVideoMode).toBe(false);

    act(() => {
      result.current.setVideoClips([{ id: '1', filePath: 'a.mp4', originalFilename: 'a.mp4', duration: 10, width: 1920, height: 1080, subtitles: [] }, { id: '2', filePath: 'b.mp4', originalFilename: 'b.mp4', duration: 10, width: 1920, height: 1080, subtitles: [] }]);
    });

    expect(result.current.isMultiVideoMode).toBe(true);
  });

  test('sidebar expansion state', () => {
      const { result } = renderHook(() => useHomeState());
      
      expect(result.current.isSidebarExpanded).toBe(false);
      
      act(() => {
          result.current.setIsSidebarExpanded(true);
      });
      
      expect(result.current.isSidebarExpanded).toBe(true);
  });
});
