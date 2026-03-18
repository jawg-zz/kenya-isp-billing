import Redis from 'ioredis';
import config from './index';
import { logger } from './logger';

class RedisClient {
  private static instance: Redis;
  private static subscriber: Redis;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      });

      RedisClient.instance.on('connect', () => {
        logger.info('Redis client connected');
      });

      RedisClient.instance.on('error', (err) => {
        logger.error('Redis client error:', err);
      });
    }

    return RedisClient.instance;
  }

  static getSubscriber(): Redis {
    if (!RedisClient.subscriber) {
      RedisClient.subscriber = new Redis(config.redis.url);
    }
    return RedisClient.subscriber;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
    }
    if (RedisClient.subscriber) {
      await RedisClient.subscriber.quit();
    }
  }
}

// Cache helper functions
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await RedisClient.getInstance().get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await RedisClient.getInstance().setex(key, ttlSeconds, data);
    } else {
      await RedisClient.getInstance().set(key, data);
    }
  },

  async del(key: string): Promise<void> {
    await RedisClient.getInstance().del(key);
  },

  async invalidatePattern(pattern: string): Promise<void> {
    const redis = RedisClient.getInstance();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '100'
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  },

  // Session management
  async setSession(sessionId: string, data: unknown, ttlSeconds: number = 86400): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttlSeconds);
  },

  async getSession<T>(sessionId: string): Promise<T | null> {
    const data = await RedisClient.getInstance().get(`session:${sessionId}`);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  },

  // Rate limiting
  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const redis = RedisClient.getInstance();
    const multi = redis.multi();
    multi.incr(key);
    multi.expire(key, windowSeconds);
    const results = await multi.exec();
    return results?.[0]?.[1] as number || 0;
  },
};

export default RedisClient;
