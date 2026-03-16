"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisRateLimiter = exports.mobileApiLimiter = exports.paymentRateLimiter = exports.authRateLimiter = exports.rateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = __importDefault(require("../config"));
const redis_1 = require("../config/redis");
// Standard rate limiter
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.default.rateLimit.windowMs,
    max: config_1.default.rateLimit.maxRequests,
    message: {
        success: false,
        message: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Strict rate limiter for auth endpoints
exports.authRateLimiter = (0, express_rate_limit_1.default)({
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
exports.paymentRateLimiter = (0, express_rate_limit_1.default)({
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
exports.mobileApiLimiter = (0, express_rate_limit_1.default)({
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
const createRedisRateLimiter = (windowSeconds, maxRequests) => {
    return async (req, res, next) => {
        const key = `ratelimit:${req.ip}:${req.path}`;
        try {
            const count = await redis_1.RedisClient.getInstance().incr(key);
            if (count === 1) {
                await redis_1.RedisClient.getInstance().expire(key, windowSeconds);
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
        }
        catch (error) {
            // If Redis fails, allow the request
            next();
        }
    };
};
exports.createRedisRateLimiter = createRedisRateLimiter;
//# sourceMappingURL=rateLimiter.js.map