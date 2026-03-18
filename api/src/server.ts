import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

// BigInt doesn't serialize to JSON natively (JSON.stringify throws TypeError).
// This polyfill converts BigInt values to strings so API responses remain valid JSON.
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
import { metricsMiddleware } from './middleware/metrics';

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
import hotspotRoutes from './routes/hotspot.routes';
import metricsRoutes from './routes/metrics.routes';
import { startScheduler, stopScheduler } from './workers/scheduler';

const app: Express = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Request tracing (must be first to capture timing for all downstream middleware)
app.use(requestTracing);

// Metrics collection middleware
app.use(metricsMiddleware);

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

// Compression middleware (exclude SSE endpoint which breaks streaming)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith(`${config.apiPrefix}/notifications/stream`)) {
    return next();
  }
  compression()(req, res, next);
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting (enabled for all environments except test; relaxed in non-production)
if (config.env !== 'test') {
  app.use(rateLimiter);
}

// Input sanitization
app.use(sanitize);

// Health check endpoints - use dedicated health routes at both paths
app.use('/health', healthRoutes);
app.use(`${config.apiPrefix}/health`, healthRoutes);

// Swagger UI - gated behind non-production
if (config.env !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ISP Billing API Documentation',
  }));
  // Serve raw OpenAPI spec as JSON
  app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });
} else {
  // In production, return 404 for docs endpoints
  app.use('/api/docs', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use('/api/docs.json', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

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
app.use(`${config.apiPrefix}/hotspot`, hotspotRoutes);
app.use(`${config.apiPrefix}/admin`, adminRoutes);
app.use(`${config.apiPrefix}/reports`, reportRoutes);
app.use(`${config.apiPrefix}/notifications/stream`, notificationSSERoutes);
app.use(`${config.apiPrefix}/metrics`, metricsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server immediately, connect to services in background
const startServer = async () => {
  const server = app.listen(config.port, () => {
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

  // Graceful shutdown with server.close()
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);

    // 1. Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server stopped accepting new connections');

      // 2. Stop the scheduler
      stopScheduler();

      // 3. Set a hard timeout for forceful shutdown
      const forceTimeout = setTimeout(() => {
        logger.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`);
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);

      try {
        // 4. Close database and Redis connections
        await prisma.$disconnect();
        await RedisClient.disconnect();
        logger.info('Database and Redis connections closed');
        clearTimeout(forceTimeout);
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        clearTimeout(forceTimeout);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

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
