import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AppDataSource } from './database';
import { authRouter } from './auth/routes';
import { customerRouter } from './customer/routes';
import { subscriptionRouter } from './subscription/routes';
import { invoiceRouter } from './invoice/routes';
import { paymentRouter } from './payment/routes';
import { reportRouter } from './report/routes';
import { webhookRouter } from './webhook/routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/customers', customerRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);
app.use('/api/v1/invoices', invoiceRouter);
app.use('/api/v1/payments', paymentRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/webhooks', webhookRouter);

// Error handling
app.use(errorHandler);

// Database initialization and server start
async function bootstrap() {
  try {
    await AppDataSource.initialize();
    logger.info('Database connected successfully');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();

export default app;
