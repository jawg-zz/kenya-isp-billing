import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

// Fix BigInt serialization for JSON responses
(BigInt.prototype as any).toJSON = function() { return this.toString(); };

import config from './config';
import { prisma } from './config/database';
import RedisClient from './config/redis';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sanitize } from './middleware/validate';
import { rateLimiter } from './middleware/rateLimiter';
import { requestTracing } from './middleware/requestTracing';

// Import routes
import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/payment.routes';
import planRoutes from './routes/plan.routes';
import subscriptionRoutes from './routes/subscription.routes';
import invoiceRoutes from './routes/invoice.routes';
import usageRoutes from './routes/usage.routes';
import customerRoutes from './routes/customer.routes';
import radiusRoutes from './routes/radius.routes';
import healthRoutes from './routes/health.routes';
import auditRoutes from './routes/audit.routes';
import settingsRoutes from './routes/settings.routes';
import adminRoutes from './routes/admin.routes';
import reportRoutes from './routes/report.routes';
import notificationSSERoutes from './routes/notificationSSE';
import { startScheduler, stopScheduler } from './workers/scheduler';

const app: Express = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Request tracing (must be first to capture timing for all downstream middleware)
app.use(requestTracing);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Radius-Secret'],
}));

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting (disabled during development)
// app.use(rateLimiter);

// Input sanitization
app.use(sanitize);

// Health check endpoints
app.get('/health', async (_req, res) => {
  const startTime = process.uptime();

  const checks: Record<string, { status: string; latencyMs: number }> = {};

  // Check PostgreSQL
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart };
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await RedisClient.getInstance().ping();
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
  } catch {
    checks.redis = { status: 'error', latencyMs: Date.now() - redisStart };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    uptime: startTime,
    services: checks,
  });
});
app.use('/health', healthRoutes);

// Health endpoint at /api/v1/health
app.get(`${config.apiPrefix}/health`, async (_req, res) => {
  let dbStatus = 'disconnected';
  let dbLatency = 0;
  let redisStatus = 'disconnected';
  let redisLatency = 0;

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
    dbLatency = Date.now() - dbStart;
  } catch {
    dbLatency = Date.now() - dbStart;
  }

  const redisStart = Date.now();
  try {
    await RedisClient.getInstance().ping();
    redisStatus = 'connected';
    redisLatency = Date.now() - redisStart;
  } catch {
    redisLatency = Date.now() - redisStart;
  }

  const overallStatus = dbStatus === 'connected' && redisStatus === 'connected' ? 'healthy' : 'degraded';

  res.json({
    status: overallStatus === 'healthy' ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: dbStatus, latencyMs: dbLatency },
      redis: { status: redisStatus, latencyMs: redisLatency },
      radius: { status: config.radius?.secret ? 'configured' : 'not_configured' },
    },
  });
});

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ISP Billing API Documentation',
}));
// Serve raw OpenAPI spec as JSON
app.get('/api/docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// API routes
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/payments`, paymentRoutes);
app.use(`${config.apiPrefix}/plans`, planRoutes);
app.use(`${config.apiPrefix}/subscriptions`, subscriptionRoutes);
app.use(`${config.apiPrefix}/invoices`, invoiceRoutes);
app.use(`${config.apiPrefix}/usage`, usageRoutes);
app.use(`${config.apiPrefix}/customers`, customerRoutes);
app.use(`${config.apiPrefix}/radius`, radiusRoutes);
app.use(`${config.apiPrefix}/audit`, auditRoutes);
app.use(`${config.apiPrefix}/settings`, settingsRoutes);
app.use(`${config.apiPrefix}/admin`, adminRoutes);
app.use(`${config.apiPrefix}/reports`, reportRoutes);
app.use(`${config.apiPrefix}/notifications/stream`, notificationSSERoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server immediately, connect to services in background
const startServer = async () => {
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.env} mode`);
    logger.info(`API available at http://localhost:${config.port}${config.apiPrefix}`);
  });

  // Connect to database (non-blocking)
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed (will retry):', error);
  }

  // Connect to Redis (non-blocking)
  try {
    await RedisClient.getInstance().ping();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Redis connection failed (will retry):', error);
  }

  // Start billing workers scheduler
  try {
    startScheduler();
    logger.info('Billing workers scheduler started');
  } catch (error) {
    logger.error('Failed to start billing workers scheduler:', error);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  // Stop the scheduler first
  stopScheduler();

  try {
    await prisma.$disconnect();
    await RedisClient.disconnect();
    logger.info('Database and Redis connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

export default app;
