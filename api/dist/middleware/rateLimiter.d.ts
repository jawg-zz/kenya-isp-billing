export declare const rateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const paymentRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const mobileApiLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const createRedisRateLimiter: (windowSeconds: number, maxRequests: number) => (req: any, res: any, next: any) => Promise<void>;
//# sourceMappingURL=rateLimiter.d.ts.map