"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitize = exports.validate = void 0;
const zod_1 = require("zod");
const types_1 = require("../types");
const validate = (schema, source = 'body') => {
    return (req, _res, next) => {
        try {
            const data = schema.parse(req[source]);
            req[source] = data;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errors = {};
                error.errors.forEach((err) => {
                    const path = err.path.join('.');
                    if (!errors[path]) {
                        errors[path] = [];
                    }
                    errors[path].push(err.message);
                });
                next(new types_1.ValidationError(errors));
            }
            else {
                next(error);
            }
        }
    };
};
exports.validate = validate;
// Sanitize input
const sanitize = (req, _res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string')
            return str;
        // Remove potential XSS
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    };
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return typeof obj === 'string' ? sanitizeString(obj) : obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        const sanitized = {};
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
exports.sanitize = sanitize;
//# sourceMappingURL=validate.js.map