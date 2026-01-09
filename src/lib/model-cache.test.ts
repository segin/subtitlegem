import { cacheModelResult, getCachedModelResult, checkModelAvailability } from './model-cache';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; }
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

global.fetch = jest.fn();

describe('model-cache', () => {
    beforeEach(() => {
        localStorageMock.clear();
        jest.clearAllMocks();
    });

    test('caches result', () => {
        cacheModelResult('gpt-4', true);
        const result = getCachedModelResult('gpt-4');
        expect(result).toBe(true);
    });

    test('expires cache', () => {
        cacheModelResult('gpt-4', true);
        
        // Mock Date.now
        const realNow = Date.now;
        global.Date.now = jest.fn(() => realNow() + 1000 * 60 * 60 * 25); // 25 hours later (default maxAge 24h)
        
        const result = getCachedModelResult('gpt-4');
        expect(result).toBeNull();
        
        global.Date.now = realNow;
    });

    test('checkModelAvailability uses cache', async () => {
        cacheModelResult('gpt-4', true);
        const avail = await checkModelAvailability('gpt-4');
        expect(avail).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    test('checkModelAvailability fetches if no cache', async () => {
        (fetch as jest.Mock).mockResolvedValue({
            json: async () => ({ success: true })
        });

        const avail = await checkModelAvailability('gpt-4');
        expect(avail).toBe(true);
        expect(fetch).toHaveBeenCalled();
        
        // Should be cached now
        expect(getCachedModelResult('gpt-4')).toBe(true);
    });
});
