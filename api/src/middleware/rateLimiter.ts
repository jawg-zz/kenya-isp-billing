import rateLimit from 'express-rate-limit';
import config from '../config';
import RedisClient from '../config/redis';

// Standard rate limiter
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment rate limiter
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 payment attempts
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API rate limiter for mobile apps
export const mobileApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    message: 'Rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Redis-based sliding window rate limiter (for distributed systems)
export const createRedisRateLimiter = (
  windowSeconds: number,
  maxRequests: number
) => {
  return async (req: any, res: any, next: any) => {
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
      next();
    }
  };
};
