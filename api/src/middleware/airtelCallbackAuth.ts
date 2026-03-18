import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { cache } from '../config/redis';

/**
 * Airtel Money callback IP allowlist.
 * These are the known Airtel Money callback server IP ranges.
 * Update with real IPs from Airtel's developer documentation.
 */
const AIRTEL_ALLOWED_IPS: string[] = [
  '196.216.166.0/24',
  '41.222.0.0/18',
];

/**
 * Check if an IP address falls within a CIDR range.
 */
function ipInCIDR(ip: string, cidr: string): boolean {
  const [range, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  const ipParts = ip.split('.').map(Number);
  const rangeParts = range.split('.').map(Number);

  if (ipParts.length !== 4 || rangeParts.length !== 4 || isNaN(prefix)) {
    return false;
  }

  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Validate that the Airtel callback originates from an allowed IP.
 * In sandbox/development, allow localhost for testing.
 */
export const validateAirtelIP = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const environment = process.env.AIRTEL_ENVIRONMENT || 'sandbox';

  if (environment !== 'production') {
    logger.debug(`Airtel callback from ${clientIP} (non-production, IP check relaxed)`);
    next();
    return;
  }

  // Check configured allowed IPs first (env override)
  const envAllowedIPs = process.env.AIRTEL_ALLOWED_IPS
    ? process.env.AIRTEL_ALLOWED_IPS.split(',').map((s) => s.trim())
    : [];

  const allAllowed = [...envAllowedIPs, ...AIRTEL_ALLOWED_IPS];

  const isAllowed = allAllowed.some((entry) => {
    if (entry.includes('/')) {
      return ipInCIDR(clientIP, entry);
    }
    return clientIP === entry;
  });

  if (isAllowed) {
    logger.info(`Airtel callback accepted from IP: ${clientIP}`);
    next();
  } else {
    logger.warn(`Airtel callback REJECTED from unknown IP: ${clientIP}`);
    res.status(403).json({ error: 'Forbidden: Invalid source IP' });
  }
};

/**
 * Validate the Airtel callback Authorization header or callback token.
 * Airtel sends an Authorization header with a bearer token or a shared-secret signature.
 */
export const validateAirtelAuth = (req: Request, res: Response, next: NextFunction): void => {
  const callbackSecret = process.env.AIRTEL_CALLBACK_SECRET || '';

  // If no secret is configured, skip validation (with a warning)
  if (!callbackSecret) {
    logger.warn('AIRTEL_CALLBACK_SECRET not configured — skipping Airtel callback auth validation');
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const callbackToken = req.headers['x-airtel-callback-token'] as string | undefined;

  // Check Authorization header (Bearer token)
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Compare using timing-safe comparison to prevent timing attacks
    const expected = callbackSecret;
    const received = token;

    if (expected.length !== received.length) {
      logger.warn('Airtel callback rejected: Authorization token length mismatch');
      res.status(403).json({ error: 'Forbidden: Invalid authorization' });
      return;
    }

    const match = crypto.timingSafeEqual(
      Buffer.from(expected, 'utf-8'),
      Buffer.from(received, 'utf-8')
    );

    if (match) {
      logger.info('Airtel callback: Authorization token validated');
      next();
      return;
    } else {
      logger.warn('Airtel callback rejected: invalid Authorization token');
      res.status(403).json({ error: 'Forbidden: Invalid authorization' });
      return;
    }
  }

  // Check custom header fallback
  if (callbackToken) {
    const match = crypto.timingSafeEqual(
      Buffer.from(callbackSecret, 'utf-8'),
      Buffer.from(callbackToken, 'utf-8')
    );

    if (match) {
      logger.info('Airtel callback: X-Airtel-Callback-Token validated');
      next();
      return;
    } else {
      logger.warn('Airtel callback rejected: invalid X-Airtel-Callback-Token');
      res.status(403).json({ error: 'Forbidden: Invalid authorization' });
      return;
    }
  }

  logger.warn('Airtel callback rejected: missing Authorization header and callback token');
  res.status(403).json({ error: 'Forbidden: Missing authorization' });
};

/**
 * Idempotency check — prevent duplicate Airtel callback processing.
 * Uses Redis for distributed deduplication (TTL: 1 hour).
 */
export const validateAirtelIdempotency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Airtel sends transaction reference in the body
  const body = req.body || {};
  const callbackId =
    body?.transactionId ||
    body?.reference ||
    body?.data?.transaction?.id ||
    body?.data?.reference;

  if (!callbackId) {
    logger.warn('Airtel callback rejected: missing transaction identifier in payload');
    res.status(400).json({ error: 'Bad Request: Missing transaction identifier' });
    return;
  }

  const redisKey = `airtel:callback:${callbackId}`;

  try {
    const { cache } = await import('../config/redis');
    const alreadyProcessed = await cache.get(redisKey);

    if (alreadyProcessed) {
      logger.warn(`Duplicate Airtel callback ignored: ${callbackId}`);
      // Return success to prevent Airtel retries
      res.status(200).json({ status: 'success', message: 'Already processed' });
      return;
    }

    // Do NOT set the idempotency key here — it is set AFTER successful
    // transaction processing in airtelService.processCallback().  Setting
    // it here would permanently block retries if processing fails.
    next();
  } catch (error) {
    logger.error('Airtel idempotency check error:', error);
    // Fail-open: allow the callback through if Redis is unavailable
    // In production, you may prefer fail-closed
    logger.warn('Airtel idempotency check failed — allowing callback through');
    next();
  }
};
