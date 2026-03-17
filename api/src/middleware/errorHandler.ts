import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../types';
import { logger } from '../config/logger';
import config from '../config';

// Prisma error codes
const PRISMA_ERROR_CODES: Record<string, { status: number; defaultMessage: string }> = {
  P2002: { status: 409, defaultMessage: 'A record with this value already exists' },
  P2025: { status: 404, defaultMessage: 'Record not found' },
  P2003: { status: 400, defaultMessage: 'Invalid reference: related record does not exist' },
  P2014: { status: 400, defaultMessage: 'Invalid relation: required related record is missing' },
  P2021: { status: 400, defaultMessage: 'Required database table does not exist' },
  P2022: { status: 400, defaultMessage: 'Required database column does not exist' },
  P2024: { status: 408, defaultMessage: 'Database operation timed out' },
  P2028: { status: 408, defaultMessage: 'Database operation timed out' },
  P2034: { status: 409, defaultMessage: 'Transaction conflict: please retry' },
};

/**
 * Extract human-readable field names from Prisma meta.target
 */
function formatPrismaTarget(target: any): string[] {
  if (!target) return [];
  if (Array.isArray(target)) {
    return target.map((t: string) => {
      // Convert camelCase to snake_case, then title case
      return t
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
    });
  }
  if (typeof target === 'string') {
    return [target];
  }
  return [];
}

/**
 * Format a human-readable field name from a Prisma model field name
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the standardised error response body.
 */
function buildErrorResponse(
  statusCode: number,
  message: string,
  req: Request,
  errors?: Array<{ field: string; message: string }>
) {
  return {
    success: false,
    message,
    errors: errors && errors.length > 0 ? errors : undefined,
    requestId: req.id || 'unknown',
    timestamp: new Date().toISOString(),
  };
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Determine requestId early (may not exist if error before tracing middleware)
  const requestId = req.id || 'unknown';

  logger.error('Error:', {
    requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // ── Zod validation errors ──────────────────────────────────────────────
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e) => ({
      field: e.path.join('.') || 'unknown',
      message: e.message,
    }));

    const firstMessage =
      fieldErrors.length === 1
        ? `${fieldErrors[0].field}: ${fieldErrors[0].message}`
        : `Validation failed: ${fieldErrors.length} error(s)`;

    res
      .status(400)
      .json(buildErrorResponse(400, firstMessage, req, fieldErrors));
    return;
  }

  // ── AppError (operational errors) ──────────────────────────────────────
  if (err instanceof AppError) {
    let statusCode = err.statusCode;
    let message = err.message;
    const fieldErrors: Array<{ field: string; message: string }> = [];

    // Custom ValidationError carries field-level errors
    if (err instanceof ValidationError) {
      for (const [field, messages] of Object.entries(err.errors)) {
        for (const msg of messages) {
          fieldErrors.push({ field, message: msg });
        }
      }
    }

    // Never leak internal details in production for 500s
    if (statusCode >= 500 && config.env === 'production') {
      message = 'Internal server error';
    }

    res
      .status(statusCode)
      .json(buildErrorResponse(statusCode, message, req, fieldErrors.length ? fieldErrors : undefined));
    return;
  }

  // ── Prisma errors ──────────────────────────────────────────────────────
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    const code: string = prismaErr.code;
    const handler = PRISMA_ERROR_CODES[code];

    if (handler) {
      let message = handler.defaultMessage;
      const fieldErrors: Array<{ field: string; message: string }> = [];

      // P2002 – unique constraint violation
      if (code === 'P2002') {
        const fields = formatPrismaTarget(prismaErr.meta?.target);
        if (fields.length > 0) {
          const fieldList = fields.join(', ');
          message = `A record with this ${fieldList} already exists`;
          for (const f of fields) {
            fieldErrors.push({
              field: f,
              message: `This ${f.toLowerCase()} is already in use`,
            });
          }
        }
      }

      // P2003 – foreign key constraint violation
      if (code === 'P2003') {
        const field = prismaErr.meta?.field_name;
        const relation = prismaErr.meta?.relation_name;
        if (field) {
          message = `Invalid reference for field "${formatFieldName(field)}"`;
          fieldErrors.push({
            field: formatFieldName(field),
            message: `Related record does not exist`,
          });
        }
        if (relation) {
          message += ` (relation: ${relation})`;
        }
      }

      // P2025 – record not found
      if (code === 'P2025') {
        const cause = prismaErr.meta?.cause;
        if (cause) {
          message = cause;
        }
      }

      res
        .status(handler.status)
        .json(
          buildErrorResponse(handler.status, message, req, fieldErrors.length ? fieldErrors : undefined)
        );
      return;
    }

    // Unknown Prisma error code
    logger.error('Unknown Prisma error', { code: prismaErr.code, meta: prismaErr.meta });
    res
      .status(500)
      .json(
        buildErrorResponse(
          500,
          config.env === 'production'
            ? 'Internal server error'
            : `Database error: ${prismaErr.message}`,
          req
        )
      );
    return;
  }

  // ── Prisma validation / client errors (P2000-series thrown by client) ──
  if (err.constructor.name === 'PrismaClientValidationError') {
    // Don't leak SQL/field details in production
    const message =
      config.env === 'production'
        ? 'Invalid data provided'
        : `Data validation error: ${err.message}`;
    res.status(400).json(buildErrorResponse(400, message, req));
    return;
  }

  // ── JWT errors ─────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    res
      .status(401)
      .json(buildErrorResponse(401, 'Invalid or malformed token', req));
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res
      .status(401)
      .json(buildErrorResponse(401, 'Token has expired. Please log in again', req));
    return;
  }

  if (err.name === 'NotBeforeError') {
    res
      .status(401)
      .json(buildErrorResponse(401, 'Token is not yet active', req));
    return;
  }

  // ── SyntaxError (invalid JSON body) ────────────────────────────────────
  if (err instanceof SyntaxError && 'body' in err) {
    res
      .status(400)
      .json(buildErrorResponse(400, 'Invalid JSON in request body', req));
    return;
  }

  // ── Multer / file upload errors ────────────────────────────────────────
  if (err.constructor.name === 'MulterError') {
    const multerErr = err as any;
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'File too large',
      LIMIT_FILE_COUNT: 'Too many files',
      LIMIT_FIELD_KEY: 'Field name too long',
      LIMIT_FIELD_VALUE: 'Field value too long',
      LIMIT_FIELD_COUNT: 'Too many fields',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    const message = messages[multerErr.code] || `Upload error: ${multerErr.message}`;
    res.status(400).json(buildErrorResponse(400, message, req));
    return;
  }

  // ── Default: unknown error ─────────────────────────────────────────────
  const statusCode = 500;
  const message =
    config.env === 'production' ? 'Internal server error' : err.message;

  res.status(statusCode).json(buildErrorResponse(statusCode, message, req));
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response): void => {
  res
    .status(404)
    .json(
      buildErrorResponse(
        404,
        `Route ${req.method} ${req.path} not found`,
        req
      )
    );
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
