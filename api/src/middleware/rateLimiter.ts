import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import config from '../config';
import RedisClient from '../config/redis';
import { logger } from '../config/logger';

// Track Redis availability for graceful fallback
let redisAvailable = true;
let lastRedisCheck = 0;
const REDIS_CHECK_INTERVAL = 30000; // 30 seconds

// In-memory rate limit store for fallback when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries from the in-memory store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now >= entry.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 60000); // Every minute

// Check Redis availability
const isRedisAvailable = async (): Promise<boolean> => {
  const now = Date.now();
  if (now - lastRedisCheck < REDIS_CHECK_INTERVAL) {
    return redisAvailable;
  }
  
  try {
    await RedisClient.getInstance().ping();
    if (!redisAvailable) {
      logger.info('Redis is available again, switching back to Redis-based rate limiting');
    }
    redisAvailable = true;
  } catch (error) {
    if (redisAvailable) {
      logger.warn('Redis is unavailable, rate limiting will use in-memory fallback');
    }
    redisAvailable = false;
  }
  
  lastRedisCheck = now;
  return redisAvailable;
};

// Create a Redis store for rate limiting
const createRedisStore = () => {
  const client = RedisClient.getInstance();
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      client.call(command, ...args) as Promise<RedisReply>,
    prefix: 'rl:',
  });
};

// In-memory rate limiter fallback
const createMemoryRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: { success: boolean; message: string };
}) => {
  return (req: any, res: any, next: any) => {
    const key = `ratelimit:${req.ip}`;
    const now = Date.now();
    let entry = memoryStore.get(key);

    if (!entry || now >= entry.resetTime) {
      entry = { count: 0, resetTime: now + options.windowMs };
      memoryStore.set(key, entry);
    }

    entry.count++;

    res.set('X-RateLimit-Limit', options.max.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, options.max - entry.count).toString());

    if (entry.count > options.max) {
      res.status(429).json(
        options.message || {
          success: false,
          message: 'Too many requests, please try again later',
        }
      );
      return;
    }

    next();
  };
};

// Create a rate limiter with Redis store and graceful fallback
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: { success: boolean; message: string };
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}) => {
  return async (req: any, res: any, next: any) => {
    // Check if Redis is available
    const useRedis = await isRedisAvailable();
    
    if (useRedis) {
      try {
        const store = createRedisStore();
        const limiter = rateLimit({
          ...options,
          store,
          standardHeaders: options.standardHeaders ?? true,
          legacyHeaders: options.legacyHeaders ?? false,
        });
        return limiter(req, res, next);
      } catch (error) {
        // If Redis fails during execution, fall back to in-memory rate limiting
        logger.error('Redis rate limiter failed, falling back to in-memory:', error);
        return createMemoryRateLimiter(options)(req, res, next);
      }
    } else {
      // Redis is unavailable, use in-memory rate limiting
      logger.debug('Using in-memory rate limiter (Redis unavailable)');
      return createMemoryRateLimiter(options)(req, res, next);
    }
  };
};

// Standard rate limiter with Redis store
export const rateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints with Redis store
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment rate limiter with Redis store
export const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 payment attempts
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API rate limiter for mobile apps with Redis store
export const mobileApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    message: 'Rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// RADIUS rate limiter - strict limits for NAS device endpoints
export const radiusRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    success: false,
    message: 'Too many RADIUS requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Redis-based sliding window rate limiter with graceful fallback
export const createRedisRateLimiter = (
  windowSeconds: number,
  maxRequests: number
) => {
  return async (req: any, res: any, next: any) => {
    // Check if Redis is available
    const useRedis = await isRedisAvailable();
    
    if (!useRedis) {
      // Redis is unavailable, use in-memory rate limiting
      logger.debug('Using in-memory sliding window rate limiter (Redis unavailable)');
      const key = `ratelimit:${req.ip}:${req.path}`;
      const now = Date.now();
      let entry = memoryStore.get(key);

      if (!entry || now >= entry.resetTime) {
        entry = { count: 0, resetTime: now + windowSeconds * 1000 };
        memoryStore.set(key, entry);
      }

      entry.count++;

      if (entry.count > maxRequests) {
        res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later',
        });
        return;
      }

      next();
      return;
    }

    const key = `ratelimit:${req.ip}:${req.path}`;
    
    try {
      const count = await RedisClient.getInstance().incr(key);
      
      if (count === 1) {
        await RedisClient.getInstance().expire(key, windowSeconds);
      }

      if (count > maxRequests) {
        res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later',
        });
        return;
      }

      res.set('X-RateLimit-Limit', maxRequests.toString());
      res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      
      next();
    } catch (error) {
      // If Redis fails, fall back to in-memory rate limiting
      logger.error('Redis rate limiter error, falling back to in-memory:', error);
      const key = `ratelimit:${req.ip}:${req.path}`;
      const now = Date.now();
      let entry = memoryStore.get(key);

      if (!entry || now >= entry.resetTime) {
        entry = { count: 0, resetTime: now + windowSeconds * 1000 };
        memoryStore.set(key, entry);
      }

      entry.count++;

      if (entry.count > maxRequests) {
        res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later',
        });
        return;
      }

      next();
    }
  };
};
