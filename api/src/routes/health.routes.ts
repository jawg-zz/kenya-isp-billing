import { Router, Request, Response, IRouter } from 'express';
import { prisma } from '../config/database';
import RedisClient from '../config/redis';
import config from '../config';

const router: IRouter = Router();

// Basic health check
router.get('/', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Detailed health check with service status — restricted to non-production
router.get('/detailed', async (_req: Request, res: Response) => {
  // In production, hide detailed infrastructure info to avoid information leakage
  if (config.env === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Check PostgreSQL
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'ok',
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'error',
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await RedisClient.getInstance().ping();
    checks.redis = {
      status: 'ok',
      latencyMs: Date.now() - redisStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'error',
      latencyMs: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check M-Pesa config
  checks.mpesa = {
    status: config.mpesa.consumerKey && config.mpesa.consumerSecret ? 'configured' : 'not_configured',
  };

  // Check Airtel config
  checks.airtel = {
    status: config.airtel.clientId && config.airtel.clientSecret ? 'configured' : 'not_configured',
  };

  // Check SMS config
  checks.sms = {
    status: config.sms.apiKey && config.sms.username ? 'configured' : 'not_configured',
  };

  // Check RADIUS config
  checks.radius = {
    status: config.radius.secret ? 'configured' : 'not_configured',
  };

  const allHealthy = Object.values(checks).every(
    (c) => c.status === 'ok' || c.status === 'configured'
  );

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
    services: checks,
  });
});

// Kubernetes/Docker health check endpoints
router.get('/ready', async (_req: Request, res: Response) => {
  // Readiness probe - is the app ready to serve traffic?
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready', reason: 'database_unavailable' });
  }
});

router.get('/live', (_req: Request, res: Response) => {
  // Liveness probe - is the app alive?
  res.status(200).json({ status: 'alive' });
});

export default router;
