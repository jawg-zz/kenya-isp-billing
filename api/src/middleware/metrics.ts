import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Collect default metrics (event loop lag, memory, GC, etc.)
client.collectDefaultMetrics({
  prefix: 'isp_billing_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Request count by method, path, status
export const httpRequestCounter = new client.Counter({
  name: 'isp_billing_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
});

// Request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'isp_billing_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Active connections gauge
export const activeConnections = new client.Gauge({
  name: 'isp_billing_active_connections',
  help: 'Number of active HTTP connections',
});

// Database connection pool stats
export const dbPoolStats = new client.Gauge({
  name: 'isp_billing_database_pool_stats',
  help: 'Database connection pool statistics',
  labelNames: ['state'] as const,
});

// Redis connection status
export const redisConnectionStatus = new client.Gauge({
  name: 'isp_billing_redis_connected',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
});

/**
 * Middleware to collect per-request metrics (response time, status code).
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  activeConnections.inc();

  const start = process.hrtime.bigint();

  // Capture when response finishes
  res.on('finish', () => {
    activeConnections.dec();

    const duration = Number(process.hrtime.bigint() - start) / 1e9; // seconds

    // Normalize path: replace IDs and other dynamic segments
    const path = normalizePath(req.route?.path || req.path);

    const labels = {
      method: req.method,
      path,
      status: String(res.statusCode),
    };

    httpRequestCounter.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}

/**
 * Normalize route paths for metrics labels.
 * Replaces UUIDs and numeric IDs with a placeholder to avoid high cardinality.
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Update Redis connection status gauge. Call this after Redis connects/disconnects.
 */
export function updateRedisStatus(connected: boolean) {
  redisConnectionStatus.set(connected ? 1 : 0);
}

/**
 * Update database pool stats gauge.
 */
export function updateDbPoolStats(connected: number, idle: number, total: number) {
  dbPoolStats.set({ state: 'connected' }, connected);
  dbPoolStats.set({ state: 'idle' }, idle);
  dbPoolStats.set({ state: 'total' }, total);
}

export default metricsMiddleware;
