export interface ModelCacheEntry {
  success: boolean;
  timestamp: number;
}

const CACHE_KEY = 'subtitlegem_model_cache';

/**
 * Get the cache object from localStorage
 */
function getCache(): Record<string, ModelCacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to parse model cache', e);
    return {};
  }
}

/**
 * Save the cache object to localStorage
 */
function saveCache(cache: Record<string, ModelCacheEntry>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save model cache', e);
  }
}

/**
 * Update the cache with a test result
 */
export function cacheModelResult(model: string, success: boolean) {
  const cache = getCache();
  cache[model] = {
    success,
    timestamp: Date.now()
  };
  saveCache(cache);
}

/**
 * Get the cached result for a model.
 * Returns null if not cached or expired (optional expiration logic).
 */
export function getCachedModelResult(model: string, maxAgeMs = 1000 * 60 * 60 * 24): boolean | null {
  const cache = getCache();
  const entry = cache[model];
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > maxAgeMs) {
    // Expired
    return null; 
  }
  
  return entry.success;
}

/**
 * Check if a model is available directly (wraps API check + checks cache)
 */
export async function checkModelAvailability(model: string, bypassCache = false): Promise<boolean> {
  if (!bypassCache) {
    const cached = getCachedModelResult(model);
    if (cached !== null) return cached;
  }

  try {
    const res = await fetch(`/api/models?test=${encodeURIComponent(model)}`);
    const data = await res.json();
    const success = data.success === true;
    cacheModelResult(model, success);
    return success;
  } catch (err) {
    console.error(`Model check failed for ${model}`, err);
    cacheModelResult(model, false);
    return false;
  }
}
