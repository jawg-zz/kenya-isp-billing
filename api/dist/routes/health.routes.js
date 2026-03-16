"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const redis_1 = __importDefault(require("../config/redis"));
const config_1 = __importDefault(require("../config"));
const router = (0, express_1.Router)();
// Basic health check
router.get('/', async (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config_1.default.env,
        version: process.env.npm_package_version || '1.0.0',
    });
});
// Detailed health check with service status
router.get('/detailed', async (_req, res) => {
    const checks = {};
    // Check PostgreSQL
    const dbStart = Date.now();
    try {
        await database_1.prisma.$queryRaw `SELECT 1`;
        checks.database = {
            status: 'ok',
            latencyMs: Date.now() - dbStart,
        };
    }
    catch (error) {
        checks.database = {
            status: 'error',
            latencyMs: Date.now() - dbStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
    // Check Redis
    const redisStart = Date.now();
    try {
        await redis_1.default.getInstance().ping();
        checks.redis = {
            status: 'ok',
            latencyMs: Date.now() - redisStart,
        };
    }
    catch (error) {
        checks.redis = {
            status: 'error',
            latencyMs: Date.now() - redisStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
    // Check M-Pesa config
    checks.mpesa = {
        status: config_1.default.mpesa.consumerKey && config_1.default.mpesa.consumerSecret ? 'configured' : 'not_configured',
    };
    // Check Airtel config
    checks.airtel = {
        status: config_1.default.airtel.clientId && config_1.default.airtel.clientSecret ? 'configured' : 'not_configured',
    };
    // Check SMS config
    checks.sms = {
        status: config_1.default.sms.apiKey && config_1.default.sms.username ? 'configured' : 'not_configured',
    };
    // Check RADIUS config
    checks.radius = {
        status: config_1.default.radius.secret ? 'configured' : 'not_configured',
    };
    const allHealthy = Object.values(checks).every((c) => c.status === 'ok' || c.status === 'configured');
    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        environment: config_1.default.env,
        version: process.env.npm_package_version || '1.0.0',
        services: checks,
    });
});
// Kubernetes/Docker health check endpoints
router.get('/ready', async (_req, res) => {
    // Readiness probe - is the app ready to serve traffic?
    try {
        await database_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: 'ready' });
    }
    catch {
        res.status(503).json({ status: 'not_ready', reason: 'database_unavailable' });
    }
});
router.get('/live', (_req, res) => {
    // Liveness probe - is the app alive?
    res.status(200).json({ status: 'alive' });
});
exports.default = router;
//# sourceMappingURL=health.routes.js.map