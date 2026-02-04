/**
 * L1 In-Memory Cache Service
 *
 * Two-tier caching strategy:
 * - L1: In-memory LRU cache (fastest, process-local)
 * - L2: Redis cache (distributed, persistent)
 *
 * Use this for frequently accessed, hot data.
 */

import { LRUCache } from 'lru-cache';
import { redis, CacheTTL } from './redis.service';

// L1 Cache configuration
const l1Cache = new LRUCache<string, unknown>({
  max: 500,              // Maximum 500 items
  ttl: 1000 * 10,        // 10 seconds default TTL
  updateAgeOnGet: true,  // Reset TTL on access
  updateAgeOnHas: false,
});

// Cache statistics
let stats = {
  l1Hits: 0,
  l1Misses: 0,
  l2Hits: 0,
  l2Misses: 0,
};

/**
 * Get value with two-tier caching (L1 -> L2 -> fetcher)
 */
export async function getWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    l1TtlMs?: number;     // L1 TTL in milliseconds
    l2TtlSeconds?: number; // L2 (Redis) TTL in seconds
  } = {}
): Promise<T> {
  const { l1TtlMs = 10000, l2TtlSeconds = 60 } = options;

  // Check L1 cache first
  if (l1Cache.has(key)) {
    stats.l1Hits++;
    return l1Cache.get(key) as T;
  }
  stats.l1Misses++;

  // Check L2 (Redis) cache
  const l2Value = await redis.get<T>(key);
  if (l2Value !== null) {
    stats.l2Hits++;
    // Populate L1 from L2
    l1Cache.set(key, l2Value, { ttl: l1TtlMs });
    return l2Value;
  }
  stats.l2Misses++;

  // Fetch from source
  const value = await fetcher();

  // Populate both caches
  l1Cache.set(key, value, { ttl: l1TtlMs });
  await redis.set(key, value, l2TtlSeconds);

  return value;
}

/**
 * Invalidate a key from both cache tiers
 */
export async function invalidateCache(key: string): Promise<void> {
  l1Cache.delete(key);
  await redis.del(key);
}

/**
 * Invalidate all keys matching a pattern (L2 only, clears L1 entirely)
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  // L1: Clear all (can't pattern match efficiently)
  l1Cache.clear();
  // L2: Pattern delete
  await redis.delPattern(pattern);
}

/**
 * Clear L1 cache only (useful for memory pressure)
 */
export function clearL1Cache(): void {
  l1Cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const total = stats.l1Hits + stats.l1Misses;
  const l1HitRate = total > 0 ? (stats.l1Hits / total * 100).toFixed(2) : '0.00';
  const l2HitRate = stats.l1Misses > 0
    ? (stats.l2Hits / stats.l1Misses * 100).toFixed(2)
    : '0.00';

  return {
    l1: {
      hits: stats.l1Hits,
      misses: stats.l1Misses,
      hitRate: `${l1HitRate}%`,
      size: l1Cache.size,
      maxSize: l1Cache.max,
    },
    l2: {
      hits: stats.l2Hits,
      misses: stats.l2Misses,
      hitRate: `${l2HitRate}%`,
    },
    total: {
      requests: total,
      cacheHitRate: total > 0
        ? `${((stats.l1Hits + stats.l2Hits) / total * 100).toFixed(2)}%`
        : '0.00%',
    },
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  stats = { l1Hits: 0, l1Misses: 0, l2Hits: 0, l2Misses: 0 };
}

// Pre-configured cache functions for common patterns
export const CachedData = {
  /**
   * Get project details with L1+L2 caching
   */
  projectDetails: async <T>(projectId: string, fetcher: () => Promise<T>) => {
    return getWithCache(
      `project:${projectId}`,
      fetcher,
      { l1TtlMs: 5000, l2TtlSeconds: CacheTTL.projectDetails }
    );
  },

  /**
   * Get container list with short L1 TTL
   */
  containerList: async <T>(fetcher: () => Promise<T>) => {
    return getWithCache(
      'containers:list',
      fetcher,
      { l1TtlMs: 5000, l2TtlSeconds: CacheTTL.containerList }
    );
  },

  /**
   * Get system metrics with very short L1 TTL
   */
  systemMetrics: async <T>(fetcher: () => Promise<T>) => {
    return getWithCache(
      'system_metrics',
      fetcher,
      { l1TtlMs: 3000, l2TtlSeconds: CacheTTL.systemMetrics }
    );
  },

  /**
   * Get user info with medium L1 TTL
   */
  userInfo: async <T>(userId: string, fetcher: () => Promise<T>) => {
    return getWithCache(
      `user:${userId}`,
      fetcher,
      { l1TtlMs: 30000, l2TtlSeconds: CacheTTL.userInfo }
    );
  },
};
