"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = __importDefault(require("./index"));
class RedisClient {
    static instance;
    static subscriber;
    static getInstance() {
        if (!RedisClient.instance) {
            RedisClient.instance = new ioredis_1.default(index_1.default.redis.url, {
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
                console.log('Redis client connected');
            });
            RedisClient.instance.on('error', (err) => {
                console.error('Redis client error:', err);
            });
        }
        return RedisClient.instance;
    }
    static getSubscriber() {
        if (!RedisClient.subscriber) {
            RedisClient.subscriber = new ioredis_1.default(index_1.default.redis.url);
        }
        return RedisClient.subscriber;
    }
    static async disconnect() {
        if (RedisClient.instance) {
            await RedisClient.instance.quit();
        }
        if (RedisClient.subscriber) {
            await RedisClient.subscriber.quit();
        }
    }
}
// Cache helper functions
exports.cache = {
    async get(key) {
        const data = await RedisClient.getInstance().get(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    },
    async set(key, value, ttlSeconds) {
        const data = JSON.stringify(value);
        if (ttlSeconds) {
            await RedisClient.getInstance().setex(key, ttlSeconds, data);
        }
        else {
            await RedisClient.getInstance().set(key, data);
        }
    },
    async del(key) {
        await RedisClient.getInstance().del(key);
    },
    async invalidatePattern(pattern) {
        const keys = await RedisClient.getInstance().keys(pattern);
        if (keys.length > 0) {
            await RedisClient.getInstance().del(...keys);
        }
    },
    // Session management
    async setSession(sessionId, data, ttlSeconds = 86400) {
        await this.set(`session:${sessionId}`, data, ttlSeconds);
    },
    async getSession(sessionId) {
        const data = await RedisClient.getInstance().get(`session:${sessionId}`);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    },
    async deleteSession(sessionId) {
        await this.del(`session:${sessionId}`);
    },
    // Rate limiting
    async incrementRateLimit(key, windowSeconds) {
        const redis = RedisClient.getInstance();
        const multi = redis.multi();
        multi.incr(key);
        multi.expire(key, windowSeconds);
        const results = await multi.exec();
        return results?.[0]?.[1] || 0;
    },
};
exports.default = RedisClient;
//# sourceMappingURL=redis.js.map