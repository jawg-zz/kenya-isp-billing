import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit log middleware for tracking admin actions
 */
export function auditLog(entry: Partial<AuditLogEntry>) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalEnd = res.end;

    // Capture response to determine success/failure
    res.end = function (...args: unknown[]) {
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 400;

      // Only log successful admin actions
      if (success && req.user) {
        const logEntry: AuditLogEntry = {
          userId: req.user.id,
          action: entry.action || req.method,
          entityType: entry.entityType || req.path,
          entityId: entry.resourceId || req.params?.id,
          newValues: {
            ...entry.newValues,
            statusCode,
            query: req.query,
          },
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
        };

        // Don't await - fire and forget
        createAuditLog(logEntry).catch((err) => {
          logger.error('Failed to create audit log:', err);
        });
      }

      // Call original end
      return originalEnd.apply(res, args as Parameters<typeof originalEnd>);
    };

    next();
  };
}

/**
 * Create an audit log entry in the database
 */
async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : undefined,
        newValues: entry.newValues ? JSON.stringify(entry.newValues) : undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    // If something fails, just log to file
    logger.warn('Audit log entry (db error):', entry);
  }
}

/**
 * Helper to create audit log entries manually
 */
export async function logAuditAction(
  userId: string,
  action: string,
  entityType: string,
  options?: {
    entityId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    action,
    entityType,
    entityId: options?.entityId,
    oldValues: options?.oldValues,
    newValues: options?.newValues,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  });
}

/**
 * Audit actions enum for common admin operations
 */
export const AuditActions = {
  // User management
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_SUSPEND: 'USER_SUSPEND',
  USER_ACTIVATE: 'USER_ACTIVATE',

  // Plan management
  PLAN_CREATE: 'PLAN_CREATE',
  PLAN_UPDATE: 'PLAN_UPDATE',
  PLAN_DELETE: 'PLAN_DELETE',

  // Invoice management
  INVOICE_CREATE: 'INVOICE_CREATE',
  INVOICE_UPDATE: 'INVOICE_UPDATE',
  INVOICE_VOID: 'INVOICE_VOID',
  INVOICE_SEND: 'INVOICE_SEND',

  // Payment management
  PAYMENT_REFUND: 'PAYMENT_REFUND',
  PAYMENT_ADJUST: 'PAYMENT_ADJUST',

  // Subscription management
  SUBSCRIPTION_CREATE: 'SUBSCRIPTION_CREATE',
  SUBSCRIPTION_CANCEL: 'SUBSCRIPTION_CANCEL',
  SUBSCRIPTION_SUSPEND: 'SUBSCRIPTION_SUSPEND',

  // Settings
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',

  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
} as const;
