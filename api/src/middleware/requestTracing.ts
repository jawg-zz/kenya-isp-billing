import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

// Extend Express Request type to include id
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

// Create a child logger with requestId
export const createChildLogger = (requestId: string) => {
  return logger.child({ requestId });
};

// Request tracing middleware
export const requestTracing = (req: Request, res: Response, next: NextFunction) => {
  // Generate or use existing request ID from header
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Set request ID on req object
  req.id = requestId;
  
  // Set response header
  res.setHeader('X-Request-ID', requestId);
  
  // Create child logger with request ID
  (req as any).log = createChildLogger(requestId);
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
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
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });
  
  next();
};

export default requestTracing;
