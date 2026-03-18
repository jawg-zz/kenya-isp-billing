import { Router, Request, Response } from 'express';
import client from 'prom-client';
import { authenticate, authorize } from '../middleware/auth';
import { prisma } from '../config/database';
import RedisClient from '../config/redis';
import { dbPoolStats, redisConnectionStatus } from '../middleware/metrics';

const router = Router();

/**
 * GET /metrics
 * Exposes Prometheus-compatible metrics.
 * Protected behind admin authorization.
 */
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (_req: Request, res: Response) => {
  try {
    // Update DB pool stats before collecting
    try {
      // Prisma doesn't expose pool stats directly, but we can check connectivity
      await prisma.$queryRaw`SELECT 1`;
      dbPoolStats.set({ state: 'connected' }, 1);
    } catch {
      dbPoolStats.set({ state: 'connected' }, 0);
    }

    // Update Redis status
    try {
      await RedisClient.getInstance().ping();
      redisConnectionStatus.set(1);
    } catch {
      redisConnectionStatus.set(0);
    }

    // Collect all metrics
    const metrics = await client.register.metrics();

    res.set('Content-Type', client.register.contentType);
    res.status(200).send(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

/**
 * GET /metrics-summary
 * Human-readable metrics summary for dashboards/debugging.
 */
router.get('/summary', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (_req: Request, res: Response) => {
  try {
    const metrics = await client.register.getMetricsAsJSON();

    const summary: Record<string, any> = {};
    for (const metric of metrics) {
      summary[metric.name] = {
        type: metric.type,
        help: metric.help,
        values: metric.values,
      };
    }

    // Add service health
    let dbStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch { /* */ }

    let redisStatus = 'disconnected';
    try {
      await RedisClient.getInstance().ping();
      redisStatus = 'connected';
    } catch { /* */ }

    res.json({
      timestamp: new Date().toISOString(),
      services: { database: dbStatus, redis: redisStatus },
      metrics: summary,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics summary' });
  }
});

export default router;
