import { Response, NextFunction } from 'express';
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
export declare function auditLog(entry: Partial<AuditLogEntry>): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Helper to create audit log entries manually
 */
export declare function logAuditAction(userId: string, action: string, entityType: string, options?: {
    entityId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void>;
/**
 * Audit actions enum for common admin operations
 */
export declare const AuditActions: {
    readonly USER_CREATE: "USER_CREATE";
    readonly USER_UPDATE: "USER_UPDATE";
    readonly USER_DELETE: "USER_DELETE";
    readonly USER_SUSPEND: "USER_SUSPEND";
    readonly USER_ACTIVATE: "USER_ACTIVATE";
    readonly PLAN_CREATE: "PLAN_CREATE";
    readonly PLAN_UPDATE: "PLAN_UPDATE";
    readonly PLAN_DELETE: "PLAN_DELETE";
    readonly INVOICE_CREATE: "INVOICE_CREATE";
    readonly INVOICE_UPDATE: "INVOICE_UPDATE";
    readonly INVOICE_VOID: "INVOICE_VOID";
    readonly INVOICE_SEND: "INVOICE_SEND";
    readonly PAYMENT_REFUND: "PAYMENT_REFUND";
    readonly PAYMENT_ADJUST: "PAYMENT_ADJUST";
    readonly SUBSCRIPTION_CREATE: "SUBSCRIPTION_CREATE";
    readonly SUBSCRIPTION_CANCEL: "SUBSCRIPTION_CANCEL";
    readonly SUBSCRIPTION_SUSPEND: "SUBSCRIPTION_SUSPEND";
    readonly SETTINGS_UPDATE: "SETTINGS_UPDATE";
    readonly LOGIN: "LOGIN";
    readonly LOGOUT: "LOGOUT";
    readonly PASSWORD_RESET: "PASSWORD_RESET";
    readonly PASSWORD_CHANGE: "PASSWORD_CHANGE";
};
export {};
//# sourceMappingURL=auditLog.d.ts.map