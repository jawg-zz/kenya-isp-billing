import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import config from './config';
import { prisma } from './config/database';
import RedisClient from './config/redis';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sanitize } from './middleware/validate';
import { rateLimiter } from './middleware/rateLimiter';

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

const app: Express = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

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

// Rate limiting
app.use(rateLimiter);

// Input sanitization
app.use(sanitize);

// Health check endpoints (legacy simple endpoint + detailed routes)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});
app.use('/health', healthRoutes);

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
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

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
