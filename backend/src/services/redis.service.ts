/**
 * Redis Service
 *
 * Centralized Redis client for caching and session management.
 * Features:
 * - Connection pooling
 * - Automatic reconnection
 * - JSON serialization helpers
 * - Cache TTL management
 * - Cache invalidation patterns
 */

import Redis from 'ioredis';
import { config } from '../config/env';
import log from '../services/logger.service';

class RedisService {
  private client: Redis | null = null;
  private isConnected = false;

  /**
   * Get or create Redis client connection
   */
  getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(config.REDIS_URL, {
        retryStrategy: (times) => {
          if (times > 3) {
            log.error('Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000);
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        log.info('Redis connected');
      });

      this.client.on('error', (err) => {
        log.error('Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    }
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client?.status === 'ready';
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = this.getClient();
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      log.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      log.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached value(s)
   */
  async del(...keys: string[]): Promise<number> {
    try {
      const client = this.getClient();
      return await client.del(...keys);
    } catch (error) {
      log.error(`Redis DEL error for keys ${keys.join(', ')}:`, error);
      return 0;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const client = this.getClient();
      const keys = await client.keys(pattern);
      if (keys.length === 0) return 0;
      return await client.del(...keys);
    } catch (error) {
      log.error(`Redis DEL pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = this.getClient();
      return (await client.exists(key)) === 1;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.ttl(key);
    } catch (_error) {
      return -1;
    }
  }

  /**
   * Get or set cached value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Increment a counter
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const client = this.getClient();
      const value = await client.incr(key);
      if (ttlSeconds && value === 1) {
        await client.expire(key, ttlSeconds);
      }
      return value;
    } catch (error) {
      log.error(`Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const redis = new RedisService();

// Cache key prefixes for organization
export const CacheKeys = {
  // Project access cache - invalidate on member add/remove
  accessibleProjects: (userId: string) => `accessible_projects:${userId}`,

  // Project details cache - invalidate on project update
  projectDetails: (projectId: string) => `project:${projectId}`,

  // Project list cache (all projects for a user)
  projectList: (userId: string) => `project_list:${userId}`,

  // User session cache
  userSession: (sessionId: string) => `session:${sessionId}`,

  // Docker stats cache (short TTL)
  dockerStats: (containerId: string) => `docker_stats:${containerId}`,

  // Container list cache
  containerList: () => `containers:list`,

  // System metrics cache
  systemMetrics: () => `system_metrics`,

  // System health cache
  systemHealth: () => `system_health`,

  // Database list cache
  databaseList: () => `databases:list`,

  // Domain list cache
  domainList: () => `domains:list`,

  // User info cache
  userInfo: (userId: string) => `user:${userId}`,

  // Activity logs cache
  activityLogs: (page: number, limit: number) => `activity_logs:${page}:${limit}`,

  // Rate limiting
  rateLimit: (ip: string, endpoint: string) => `rate_limit:${ip}:${endpoint}`,
};

// Default TTLs in seconds
export const CacheTTL = {
  accessibleProjects: 300,   // 5 minutes
  projectDetails: 60,        // 1 minute
  projectList: 60,           // 1 minute
  userSession: 86400,        // 24 hours
  dockerStats: 10,           // 10 seconds
  containerList: 15,         // 15 seconds
  systemMetrics: 30,         // 30 seconds
  systemHealth: 30,          // 30 seconds
  databaseList: 60,          // 1 minute
  domainList: 120,           // 2 minutes
  userInfo: 300,             // 5 minutes
  activityLogs: 30,          // 30 seconds
  rateLimit: 60,             // 1 minute window
};

// Cache invalidation helpers
export const CacheInvalidation = {
  /**
   * Invalidate all project-related caches
   */
  async project(projectId: string): Promise<void> {
    await redis.del(CacheKeys.projectDetails(projectId));
    await redis.delPattern('project_list:*');
    await redis.delPattern('accessible_projects:*');
  },

  /**
   * Invalidate container caches
   */
  async containers(): Promise<void> {
    await redis.del(CacheKeys.containerList());
    await redis.delPattern('docker_stats:*');
  },

  /**
   * Invalidate database caches
   */
  async databases(): Promise<void> {
    await redis.del(CacheKeys.databaseList());
  },

  /**
   * Invalidate domain caches
   */
  async domains(): Promise<void> {
    await redis.del(CacheKeys.domainList());
  },

  /**
   * Invalidate user caches
   */
  async user(userId: string): Promise<void> {
    await redis.del(CacheKeys.userInfo(userId));
    await redis.del(CacheKeys.accessibleProjects(userId));
    await redis.del(CacheKeys.projectList(userId));
  },

  /**
   * Invalidate all caches (use sparingly)
   */
  async all(): Promise<void> {
    await redis.delPattern('*');
  },
};
