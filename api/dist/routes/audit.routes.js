"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Get audit logs (admin only)
router.get('/', async (req, res, next) => {
    try {
        // Check admin role
        if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPPORT') {
            res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.',
            });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const action = req.query.action;
        const entityType = req.query.entityType;
        const userId = req.query.userId;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        // Build where clause
        const where = {};
        if (action)
            where.action = action;
        if (entityType)
            where.entityType = entityType;
        if (userId)
            where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [logs, total] = await Promise.all([
            database_1.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            database_1.prisma.auditLog.count({ where }),
        ]);
        const response = {
            success: true,
            data: {
                logs,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
// Get audit log statistics
router.get('/stats', async (req, res, next) => {
    try {
        // Check admin role
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.',
            });
            return;
        }
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        // Get action counts
        const actionCounts = await database_1.prisma.auditLog.groupBy({
            by: ['action'],
            where,
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: 'desc',
                },
            },
        });
        // Get recent activity
        const recentLogs = await database_1.prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        const response = {
            success: true,
            data: {
                actionCounts: actionCounts.map((a) => ({
                    action: a.action,
                    count: a._count.id,
                })),
                recentActivity: recentLogs,
                totalLogs: await database_1.prisma.auditLog.count({ where }),
            },
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=audit.routes.js.map