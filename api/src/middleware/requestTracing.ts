import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

// Extend Express Request type to include id
declare global {
  namespace Express {
    interface Request {
      id: string;
      userId?: string;
      userRole?: string;
    }
  }
}

// Module-level storage for current request context (used by withRequestId)
let _currentRequestId: string | undefined;
let _currentUserId: string | undefined;

/**
 * Get the current request ID from async context.
 */
export function getCurrentRequestId(): string | undefined {
  return _currentRequestId;
}

/**
 * Get the current user ID from async context.
 */
export function getCurrentUserId(): string | undefined {
  return _currentUserId;
}

/**
 * Create a child logger with requestId context.
 * Use this in services that need explicit request correlation.
 */
export const createChildLogger = (requestId: string, userId?: string) => {
  const meta: Record<string, string> = { requestId };
  if (userId) meta.userId = userId;
  return logger.child(meta);
};

// Request tracing middleware
export const requestTracing = (req: Request, res: Response, next: NextFunction) => {
  // Generate or use existing request ID from header
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // Set request ID on req object
  req.id = requestId;

  // Set response header
  res.setHeader('X-Request-ID', requestId);

  // Store in module-level for async context access
  _currentRequestId = requestId;
  _currentUserId = undefined;

  // Patch logger.defaultMeta so ALL log calls include requestId automatically
  const previousDefaultMeta = { ...(logger.defaultMeta as Record<string, unknown>) };
  logger.defaultMeta = { ...previousDefaultMeta, requestId };

  // Create child logger with request ID
  (req as any).log = createChildLogger(requestId);

  // Log incoming request
  (req as any).log.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Track response time
  const start = Date.now();

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    (req as any).log.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });

    // Restore previous defaultMeta
    logger.defaultMeta = previousDefaultMeta;
    _currentRequestId = undefined;
    _currentUserId = undefined;
  });

  next();
};

/**
 * Middleware to add userId to request logs after authentication.
 * This should run after the auth middleware.
 */
export const addUserContext = (req: Request, _res: Response, next: NextFunction) => {
  // Extract user info from the authenticated request (set by auth middleware)
  const user = (req as any).user;
  if (user) {
    req.userId = user.id;
    req.userRole = user.role;
    _currentUserId = user.id;

    // Update the child logger with userId
    if ((req as any).log) {
      (req as any).log = createChildLogger(req.id, user.id);
    }

    // Update defaultMeta to include userId for all subsequent logs in this request
    if (logger.defaultMeta && typeof logger.defaultMeta === 'object') {
      (logger.defaultMeta as Record<string, unknown>).userId = user.id;
    }
  }

  next();
};

export default requestTracing;
