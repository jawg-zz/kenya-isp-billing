"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("./config"));
const database_1 = require("./config/database");
const redis_1 = __importDefault(require("./config/redis"));
const logger_1 = require("./config/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const validate_1 = require("./middleware/validate");
const rateLimiter_1 = require("./middleware/rateLimiter");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const plan_routes_1 = __importDefault(require("./routes/plan.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const invoice_routes_1 = __importDefault(require("./routes/invoice.routes"));
const usage_routes_1 = __importDefault(require("./routes/usage.routes"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const radius_routes_1 = __importDefault(require("./routes/radius.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const app = (0, express_1.default)();
// Trust proxy for rate limiting
app.set('trust proxy', 1);
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.default.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Radius-Secret'],
}));
// Logging
app.use((0, morgan_1.default)('combined', {
    stream: {
        write: (message) => logger_1.logger.info(message.trim()),
    },
}));
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static files
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Rate limiting
app.use(rateLimiter_1.rateLimiter);
// Input sanitization
app.use(validate_1.sanitize);
// Health check endpoints (legacy simple endpoint + detailed routes)
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config_1.default.env,
    });
});
app.use('/health', health_routes_1.default);
// Health endpoint at /api/v1/health
app.get(`${config_1.default.apiPrefix}/health`, async (_req, res) => {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';
    try {
        await database_1.prisma.$queryRaw `SELECT 1`;
        dbStatus = 'connected';
    }
    catch {
        // dbStatus stays disconnected
    }
    try {
        await redis_1.default.getInstance().ping();
        redisStatus = 'connected';
    }
    catch {
        // redisStatus stays disconnected
    }
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database: dbStatus,
            redis: redisStatus,
        },
    });
});
// API routes
app.use(`${config_1.default.apiPrefix}/auth`, auth_routes_1.default);
app.use(`${config_1.default.apiPrefix}/payments`, payment_routes_1.default);
app.use(`${config_1.default.apiPrefix}/plans`, plan_routes_1.default);
app.use(`${config_1.default.apiPrefix}/subscriptions`, subscription_routes_1.default);
app.use(`${config_1.default.apiPrefix}/invoices`, invoice_routes_1.default);
app.use(`${config_1.default.apiPrefix}/usage`, usage_routes_1.default);
app.use(`${config_1.default.apiPrefix}/customers`, customer_routes_1.default);
app.use(`${config_1.default.apiPrefix}/radius`, radius_routes_1.default);
app.use(`${config_1.default.apiPrefix}/audit`, audit_routes_1.default);
// Error handling
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
// Start server immediately, connect to services in background
const startServer = async () => {
    app.listen(config_1.default.port, () => {
        logger_1.logger.info(`Server running on port ${config_1.default.port} in ${config_1.default.env} mode`);
        logger_1.logger.info(`API available at http://localhost:${config_1.default.port}${config_1.default.apiPrefix}`);
    });
    // Connect to database (non-blocking)
    try {
        await database_1.prisma.$connect();
        logger_1.logger.info('Database connected successfully');
    }
    catch (error) {
        logger_1.logger.error('Database connection failed (will retry):', error);
    }
    // Connect to Redis (non-blocking)
    try {
        await redis_1.default.getInstance().ping();
        logger_1.logger.info('Redis connected successfully');
    }
    catch (error) {
        logger_1.logger.error('Redis connection failed (will retry):', error);
    }
};
// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`${signal} received. Shutting down gracefully...`);
    try {
        await database_1.prisma.$disconnect();
        await redis_1.default.disconnect();
        logger_1.logger.info('Database and Redis connections closed');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception:', error);
    process.exit(1);
});
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map