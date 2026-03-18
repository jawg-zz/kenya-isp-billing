import { cache } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Cache-aside with mutex pattern to prevent cache stampede.
 *
 * When multiple concurrent requests miss the same cache key,
 * only the first request queries the database; all others
 * wait for and share the result of that single query.
 */
const pendingRequests = new Map<string, Promise<any>>();

interface CacheMutexOptions<T> {
  /** Redis cache key */
  key: string;
  /** TTL in seconds for the cached value */
  ttlSeconds: number;
  /** Function that fetches the data from DB (only called on cache miss) */
  fetcher: () => Promise<T>;
}

export async function cacheAsideWithMutex<T>(options: CacheMutexOptions<T>): Promise<T> {
  const { key, ttlSeconds, fetcher } = options;

  // 1. Try cache first
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 2. Check if another request is already fetching this key
  const existing = pendingRequests.get(key);
  if (existing) {
    // Wait for the in-flight request to complete
    return existing as Promise<T>;
  }

  // 3. Create the fetch promise, store it, execute, clean up
  const fetchPromise = fetcher()
    .then(async (result) => {
      // Store in cache
      await cache.set(key, result, ttlSeconds);
      return result;
    })
    .catch((err) => {
      logger.error(`Cache mutex fetch error for key ${key}:`, err);
      throw err;
    })
    .finally(() => {
      // Remove from pending map regardless of outcome
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate a cache key and clear any pending fetch for it.
 */
export async function invalidateWithMutex(key: string): Promise<void> {
  pendingRequests.delete(key);
  await cache.del(key);
}
