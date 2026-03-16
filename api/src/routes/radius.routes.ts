import { Router, Request, Response, NextFunction } from 'express';
import { radiusService } from '../services/radius.service';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import config from '../config';
import { logger } from '../config/logger';

const router = Router();

// Admin routes - get RADIUS sessions
router.get('/sessions', authenticate, authorize('ADMIN', 'SUPPORT'), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [sessions, total] = await Promise.all([
      prisma.radiusSession.findMany({
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
      prisma.radiusSession.count({ where }),
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
  } catch (error) {
    logger.error('Get RADIUS sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

// Admin routes - get RADIUS session stats
router.get('/sessions/stats', authenticate, authorize('ADMIN', 'SUPPORT'), async (req: Request, res: Response) => {
  try {
    const [activeCount, totalBandwidth, recentDisconnects] = await Promise.all([
      prisma.radiusSession.count({ where: { status: 'ACTIVE' } }),
      prisma.radiusSession.aggregate({
        where: { status: 'ACTIVE' },
        _sum: {
          inputOctets: true,
          outputOctets: true,
        },
      }),
      prisma.radiusSession.count({
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
  } catch (error) {
    logger.error('Get RADIUS session stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session stats' });
  }
});

// Admin routes - get recent RADIUS events
router.get('/sessions/events', authenticate, authorize('ADMIN', 'SUPPORT'), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const events = await prisma.radiusSession.findMany({
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
  } catch (error) {
    logger.error('Get RADIUS events error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// RADIUS authentication endpoint
router.post('/auth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, nasIpAddress, nasPortId, nasPortType } = req.body;

    // Simple shared secret validation
    const sharedSecret = req.headers['x-radius-secret'];
    if (sharedSecret !== config.radius.secret) {
      logger.warn('RADIUS auth: Invalid shared secret');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await radiusService.handleAccessRequest({
      username,
      password,
      nasIpAddress,
      nasPortId,
      nasPortType,
    });

    res.json(result);
  } catch (error) {
    logger.error('RADIUS auth error:', error);
    res.status(200).json({ accept: false });
  }
});

// RADIUS accounting endpoint
router.post('/accounting', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharedSecret = req.headers['x-radius-secret'];
    if (sharedSecret !== config.radius.secret) {
      logger.warn('RADIUS accounting: Invalid shared secret');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      sessionId,
      username,
      nasIpAddress,
      nasPortId,
      framedIpAddress,
      inputOctets,
      outputOctets,
      inputPackets,
      outputPackets,
      sessionTime,
      terminateCause,
    } = req.body;

    await radiusService.handleAccountingRequest({
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
  } catch (error) {
    logger.error('RADIUS accounting error:', error);
    res.json({ success: true });
  }
});

// RADIUS CoA (Change of Authorization) endpoint
router.post('/coa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharedSecret = req.headers['x-radius-secret'];
    if (sharedSecret !== config.radius.secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { username, attributes } = req.body;

    // In production, this would send a CoA request to the NAS
    logger.info(`CoA request for ${username}:`, attributes);

    res.json({ success: true });
  } catch (error) {
    logger.error('RADIUS CoA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
