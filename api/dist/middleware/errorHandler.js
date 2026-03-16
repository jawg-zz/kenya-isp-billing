"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = void 0;
const types_1 = require("../types");
const logger_1 = require("../config/logger");
const config_1 = __importDefault(require("../config"));
const errorHandler = (err, req, res, _next) => {
    logger_1.logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    // AppError (operational errors)
    if (err instanceof types_1.AppError) {
        const response = {
            success: false,
            message: err.message,
        };
        // Include validation errors if present
        if (err instanceof types_1.ValidationError) {
            response.errors = err.errors;
        }
        res.status(err.statusCode).json(response);
        return;
    }
    // Prisma errors
    if (err.constructor.name === 'PrismaClientKnownRequestError') {
        const prismaError = err;
        // Unique constraint violation
        if (prismaError.code === 'P2002') {
            const field = prismaError.meta?.target?.[0] || 'field';
            res.status(409).json({
                success: false,
                message: `A record with this ${field} already exists`,
            });
            return;
        }
        // Record not found
        if (prismaError.code === 'P2025') {
            res.status(404).json({
                success: false,
                message: 'Record not found',
            });
            return;
        }
    }
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            success: false,
            message: 'Invalid token',
        });
        return;
    }
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            success: false,
            message: 'Token expired',
        });
        return;
    }
    // SyntaxError (invalid JSON)
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
            success: false,
            message: 'Invalid JSON payload',
        });
        return;
    }
    // Default error
    res.status(500).json({
        success: false,
        message: config_1.default.env === 'production' ? 'Internal server error' : err.message,
    });
};
exports.errorHandler = errorHandler;
// 404 handler for undefined routes
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
    });
};
exports.notFoundHandler = notFoundHandler;
// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map