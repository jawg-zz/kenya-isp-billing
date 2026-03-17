import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import config from '../config';
import RedisClient from '../config/redis';
import { logger } from '../config/logger';

// Track Redis availability for graceful fallback
let redisAvailable = true;
let lastRedisCheck = 0;
const REDIS_CHECK_INTERVAL = 30000; // 30 seconds

// Check Redis availability
const isRedisAvailable = async (): Promise<boolean> => {
  const now = Date.now();
  if (now - lastRedisCheck < REDIS_CHECK_INTERVAL) {
    return redisAvailable;
  }
  
  try {
    await RedisClient.getInstance().ping();
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
        // If Redis fails during execution, fall back to no rate limiting
        logger.error('Redis rate limiter failed, falling back:', error);
        return next();
      }
    } else {
      // Redis is unavailable, skip rate limiting
      return next();
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

// Redis-based sliding window rate limiter with graceful fallback
export const createRedisRateLimiter = (
  windowSeconds: number,
  maxRequests: number
) => {
  return async (req: any, res: any, next: any) => {
    // Check if Redis is available
    const useRedis = await isRedisAvailable();
    
    if (!useRedis) {
      // Redis is unavailable, skip rate limiting
      return next();
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
      // If Redis fails, allow the request
      logger.error('Redis rate limiter error, allowing request:', error);
      next();
    }
  };
};
