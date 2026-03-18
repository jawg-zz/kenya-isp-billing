import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import filterXSS from 'xss';
import { ValidationError } from '../types';

/**
 * Validate request data against a Zod schema.
 * Optionally specify the source: 'body' (default), 'query', or 'params'.
 */
export const validate =
  (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};

        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });

        next(new ValidationError(errors));
      } else {
        next(error);
      }
    }
  };

/**
 * Sanitize input using the xss library to strip XSS vectors.
 * Handles encoded payloads, data: URIs, style-based attacks, etc.
 * Applied to body and query.
 */
export const sanitize = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    return filterXSS(str.trim());
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? sanitizeString(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};
