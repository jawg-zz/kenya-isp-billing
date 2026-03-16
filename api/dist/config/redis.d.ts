import Redis from 'ioredis';
declare class RedisClient {
    private static instance;
    private static subscriber;
    static getInstance(): Redis;
    static getSubscriber(): Redis;
    static disconnect(): Promise<void>;
}
export declare const cache: {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
    setSession(sessionId: string, data: unknown, ttlSeconds?: number): Promise<void>;
    getSession<T>(sessionId: string): Promise<T | null>;
    deleteSession(sessionId: string): Promise<void>;
    incrementRateLimit(key: string, windowSeconds: number): Promise<number>;
};
export default RedisClient;
//# sourceMappingURL=redis.d.ts.map