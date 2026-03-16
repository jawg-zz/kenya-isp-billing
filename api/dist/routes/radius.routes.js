"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const radius_service_1 = require("../services/radius.service");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
// Admin routes - get RADIUS sessions
router.get('/sessions', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'SUPPORT'), async (req, res) => {
    try {
        const { status, page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (status && status !== 'all') {
            where.status = status;
        }
        const [sessions, total] = await Promise.all([
            database_1.prisma.radiusSession.findMany({
                where,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                            customer: {
                                select: {
                                    accountNumber: true,
                                    customerCode: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { startTime: 'desc' },
                skip,
                take: limitNum,
            }),
            database_1.prisma.radiusSession.count({ where }),
        ]);
        res.json({
            success: true,
            data: {
                sessions,
                meta: {
                    total,
                    page: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Get RADIUS sessions error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
    }
});
// Admin routes - get RADIUS session stats
router.get('/sessions/stats', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'SUPPORT'), async (req, res) => {
    try {
        const [activeCount, totalBandwidth, recentDisconnects] = await Promise.all([
            database_1.prisma.radiusSession.count({ where: { status: 'ACTIVE' } }),
            database_1.prisma.radiusSession.aggregate({
                where: { status: 'ACTIVE' },
                _sum: {
                    inputOctets: true,
                    outputOctets: true,
                },
            }),
            database_1.prisma.radiusSession.count({
                where: {
                    status: 'CLOSED',
                    stopTime: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                    },
                },
            }),
        ]);
        res.json({
            success: true,
            data: {
                activeSessions: activeCount,
                totalBandwidth: {
                    input: totalBandwidth._sum.inputOctets || 0,
                    output: totalBandwidth._sum.outputOctets || 0,
                },
                recentDisconnects,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Get RADIUS session stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch session stats' });
    }
});
// Admin routes - get recent RADIUS events
router.get('/sessions/events', auth_1.authenticate, (0, auth_1.authorize)('ADMIN', 'SUPPORT'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const events = await database_1.prisma.radiusSession.findMany({
            where: {
                OR: [
                    { status: 'ACTIVE' },
                    {
                        status: 'CLOSED',
                        stopTime: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                        },
                    },
                ],
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        customer: {
                            select: {
                                accountNumber: true,
                            },
                        },
                    },
                },
            },
            orderBy: { startTime: 'desc' },
            take: limit,
        });
        res.json({
            success: true,
            data: { events },
        });
    }
    catch (error) {
        logger_1.logger.error('Get RADIUS events error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch events' });
    }
});
// RADIUS authentication endpoint
router.post('/auth', async (req, res, next) => {
    try {
        const { username, password, nasIpAddress, nasPortId, nasPortType } = req.body;
        // Simple shared secret validation
        const sharedSecret = req.headers['x-radius-secret'];
        if (sharedSecret !== config_1.default.radius.secret) {
            logger_1.logger.warn('RADIUS auth: Invalid shared secret');
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await radius_service_1.radiusService.handleAccessRequest({
            username,
            password,
            nasIpAddress,
            nasPortId,
            nasPortType,
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('RADIUS auth error:', error);
        res.status(200).json({ accept: false });
    }
});
// RADIUS accounting endpoint
router.post('/accounting', async (req, res, next) => {
    try {
        const sharedSecret = req.headers['x-radius-secret'];
        if (sharedSecret !== config_1.default.radius.secret) {
            logger_1.logger.warn('RADIUS accounting: Invalid shared secret');
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { sessionId, username, nasIpAddress, nasPortId, framedIpAddress, inputOctets, outputOctets, inputPackets, outputPackets, sessionTime, terminateCause, } = req.body;
        await radius_service_1.radiusService.handleAccountingRequest({
            sessionId,
            username,
            nasIpAddress,
            nasPortId,
            framedIpAddress,
            inputOctets: inputOctets || 0,
            outputOctets: outputOctets || 0,
            inputPackets: inputPackets || 0,
            outputPackets: outputPackets || 0,
            sessionTime: sessionTime || 0,
            terminateCause,
        });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('RADIUS accounting error:', error);
        res.json({ success: true });
    }
});
// RADIUS CoA (Change of Authorization) endpoint
router.post('/coa', async (req, res, next) => {
    try {
        const sharedSecret = req.headers['x-radius-secret'];
        if (sharedSecret !== config_1.default.radius.secret) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { username, attributes } = req.body;
        // In production, this would send a CoA request to the NAS
        logger_1.logger.info(`CoA request for ${username}:`, attributes);
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('RADIUS CoA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=radius.routes.js.map