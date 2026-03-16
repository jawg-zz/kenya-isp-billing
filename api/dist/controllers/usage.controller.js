"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageController = void 0;
const usage_service_1 = require("../services/usage.service");
const types_1 = require("../types");
class UsageController {
    // Get current usage summary
    async getUsageSummary(req, res, next) {
        try {
            const customer = await require('../config/database').prisma.customer.findFirst({
                where: { userId: req.user.id },
            });
            if (!customer) {
                throw new types_1.NotFoundError('Customer not found');
            }
            const usage = await usage_service_1.usageService.getCustomerUsage(customer.id);
            const response = {
                success: true,
                data: { usage },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get real-time usage
    async getRealtimeUsage(req, res, next) {
        try {
            const customer = await require('../config/database').prisma.customer.findFirst({
                where: { userId: req.user.id },
            });
            if (!customer) {
                throw new types_1.NotFoundError('Customer not found');
            }
            const usage = await usage_service_1.usageService.getRealtimeUsage(customer.id);
            const response = {
                success: true,
                data: { usage },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get usage history
    async getUsageHistory(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 30;
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;
            const customer = await prisma.customer.findFirst({
                where: { userId: req.user.id },
            });
            if (!customer) {
                throw new types_1.NotFoundError('Customer not found');
            }
            const where = {
                customerId: customer.id,
            };
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate)
                    where.timestamp.gte = new Date(startDate);
                if (endDate)
                    where.timestamp.lte = new Date(endDate);
            }
            const [records, total] = await Promise.all([
                prisma.usageRecord.findMany({
                    where,
                    orderBy: { timestamp: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.usageRecord.count({ where }),
            ]);
            const response = {
                success: true,
                data: {
                    records,
                    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
                },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get usage analytics (admin)
    async getUsageAnalytics(req, res, next) {
        try {
            const startDate = req.query.startDate
                ? new Date(req.query.startDate)
                : undefined;
            const endDate = req.query.endDate
                ? new Date(req.query.endDate)
                : undefined;
            const analytics = await usage_service_1.usageService.getUsageAnalytics(startDate, endDate);
            const response = {
                success: true,
                data: { analytics },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Format bytes helper
    async formatBytes(req, res, next) {
        try {
            const bytes = parseInt(req.query.bytes) || 0;
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let value = bytes;
            let unitIndex = 0;
            while (value >= 1024 && unitIndex < units.length - 1) {
                value /= 1024;
                unitIndex++;
            }
            const response = {
                success: true,
                data: {
                    bytes,
                    formatted: `${value.toFixed(2)} ${units[unitIndex]}`,
                },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.usageController = new UsageController();
exports.default = exports.usageController;
//# sourceMappingURL=usage.controller.js.map