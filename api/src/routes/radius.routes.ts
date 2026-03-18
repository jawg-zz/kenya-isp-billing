import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { radiusService } from '../services/radius.service';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import config from '../config';
import { logger } from '../config/logger';
import { radiusRateLimiter } from '../middleware/rateLimiter';

const router: IRouter = Router();

// Log HTTPS warning on startup if not behind TLS
if (process.env.NODE_ENV === 'production' && !process.env.TRUST_PROXY) {
  logger.warn('⚠️  RADIUS shared secrets are transmitted in headers. Ensure the API is behind HTTPS/TLS termination (e.g., nginx, load balancer).');
}

/**
 * IP allowlist middleware for RADIUS endpoints.
 * Checks req.ip or X-Forwarded-For against the configured RADIUS_ALLOWED_IPS list.
 */
const radiusIpAllowlist = (req: Request, res: Response, next: NextFunction): void => {
  const allowedIps = config.radius.allowedIps;
  if (allowedIps.length === 0) {
    // No allowlist configured — warn and allow (fail-open for usability, but log loudly)
    logger.warn('RADIUS_ALLOWED_IPS is not configured. RADIUS endpoints are accessible from any IP. Configure this for production security.');
    next();
    return;
  }

  // Use X-Forwarded-For if behind proxy, otherwise req.ip
  const forwardedFor = req.headers['x-forwarded-for'] as string | undefined;
  const clientIp = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : req.ip || req.socket.remoteAddress || '';

  // Clean IPv6-mapped IPv4
  const cleanIp = clientIp.replace(/^::ffff:/, '');

  if (allowedIps.includes(cleanIp)) {
    next();
  } else {
    logger.warn(`RADIUS endpoint accessed from unauthorized IP: ${cleanIp}`);
    res.status(403).json({ error: 'Forbidden: IP not allowed' });
  }
};

// Admin routes - get RADIUS sessions
router.get('/sessions', authenticate, authorize('ADMIN', 'SUPPORT'), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = String(status).toUpperCase();
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

// RADIUS authentication endpoint (rate limited + IP allowlisted)
router.post('/auth', radiusRateLimiter, radiusIpAllowlist, async (req: Request, res: Response, next: NextFunction) => {
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

// RADIUS accounting endpoint (rate limited + IP allowlisted)
router.post('/accounting', radiusRateLimiter, radiusIpAllowlist, async (req: Request, res: Response, next: NextFunction) => {
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

// RADIUS CoA (Change of Authorization) endpoint (rate limited + IP allowlisted)
router.post('/coa', radiusRateLimiter, radiusIpAllowlist, async (req: Request, res: Response, next: NextFunction) => {
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

// ============================================================
// NAS (Network Access Server) Management Routes
// ============================================================

// List all NAS devices (paginated)
router.get('/nas', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const isActive = req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : undefined;

    const result = await radiusService.listNas({ page, limit, isActive });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('List NAS error:', error);
    res.status(500).json({ success: false, error: 'Failed to list NAS devices' });
  }
});

// Add a new NAS device
router.post('/nas', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { nasname, shortname, type, ports, secret, server, description } = req.body;

    if (!nasname || !secret) {
      res.status(400).json({ success: false, error: 'nasname and secret are required' });
      return;
    }

    const nas = await radiusService.createNas({
      nasname,
      shortname,
      type,
      ports: ports ? parseInt(ports, 10) : undefined,
      secret,
      server,
      description,
    });

    res.status(201).json({ success: true, data: nas });
  } catch (error) {
    logger.error('Create NAS error:', error);
    const message = (error as any)?.message || 'Failed to create NAS device';
    res.status(500).json({ success: false, error: message });
  }
});

// Update a NAS device
router.put('/nas/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { nasname, shortname, type, ports, secret, server, description, isActive } = req.body;

    const nas = await radiusService.updateNas(id, {
      nasname,
      shortname,
      type,
      ports: ports ? parseInt(ports, 10) : undefined,
      secret,
      server,
      description,
      isActive,
    });

    res.json({ success: true, data: nas });
  } catch (error) {
    logger.error('Update NAS error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to update NAS device';
    res.status(status).json({ success: false, error: message });
  }
});

// Delete a NAS device
router.delete('/nas/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    await radiusService.deleteNas(req.params.id as string);

    res.json({ success: true, message: 'NAS device deleted' });
  } catch (error) {
    logger.error('Delete NAS error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to delete NAS device';
    res.status(status).json({ success: false, error: message });
  }
});

// Get active sessions on a specific NAS
router.get('/nas/:id/sessions', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const result = await radiusService.getNasSessions(id, { page, limit });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get NAS sessions error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to fetch NAS sessions';
    res.status(status).json({ success: false, error: message });
  }
});

// ============================================================
// Customer RADIUS Credential Management Routes
// ============================================================

// Get customer's RADIUS config and active sessions
router.get('/customers/:customerId', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;
    const result = await radiusService.getCustomerRadiusConfig(customerId);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get customer RADIUS config error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to fetch customer RADIUS config';
    res.status(status).json({ success: false, error: message });
  }
});

// Reset customer's RADIUS password
router.post('/customers/:customerId/reset-password', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;
    const newPassword = await radiusService.resetCustomerRadiusPassword(customerId);

    res.json({
      success: true,
      data: {
        message: 'RADIUS password reset successfully',
        password: newPassword,
      },
    });
  } catch (error) {
    logger.error('Reset customer RADIUS password error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to reset RADIUS password';
    res.status(status).json({ success: false, error: message });
  }
});

// Force disconnect customer's active sessions
router.post('/customers/:customerId/disconnect', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;
    const count = await radiusService.disconnectCustomerSessions(customerId);

    res.json({
      success: true,
      data: {
        message: `Disconnected ${count} active session(s)`,
        sessionsDisconnected: count,
      },
    });
  } catch (error) {
    logger.error('Disconnect customer sessions error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to disconnect sessions';
    res.status(status).json({ success: false, error: message });
  }
});

// Enable RADIUS access for customer
router.post('/customers/:customerId/enable', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;
    await radiusService.enableRadiusUser(customerId);

    res.json({ success: true, data: { message: 'RADIUS access enabled' } });
  } catch (error) {
    logger.error('Enable RADIUS access error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to enable RADIUS access';
    res.status(status).json({ success: false, error: message });
  }
});

// Disable RADIUS access for customer
router.post('/customers/:customerId/disable', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;
    await radiusService.disableRadiusUser(customerId);

    res.json({ success: true, data: { message: 'RADIUS access disabled' } });
  } catch (error) {
    logger.error('Disable RADIUS access error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to disable RADIUS access';
    res.status(status).json({ success: false, error: message });
  }
});

// ============================================================
// Speed Plan RADIUS Attribute Sync Routes
// ============================================================

// Sync a plan's speed attributes to FreeRADIUS radgroupreply
router.post('/plans/:planId/sync', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const planId = req.params.planId as string;
    const result = await radiusService.syncPlanToRadius(planId);

    res.json({
      success: true,
      data: {
        message: `Plan '${result.plan}' synced to FreeRADIUS`,
        plan: result.plan,
        attributes: result.attributes,
      },
    });
  } catch (error) {
    logger.error('Sync plan RADIUS attributes error:', error);
    const status = (error as any)?.statusCode || 500;
    const message = (error as any)?.message || 'Failed to sync plan attributes';
    res.status(status).json({ success: false, error: message });
  }
});

// Sync all active plans to FreeRADIUS
router.post('/plans/sync-all', authenticate, authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const results = await radiusService.syncAllPlansToRadius();

    res.json({
      success: true,
      data: {
        message: `Synced ${results.length} active plan(s) to FreeRADIUS`,
        plans: results,
      },
    });
  } catch (error) {
    logger.error('Sync all plans RADIUS attributes error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync all plans' });
  }
});

export default router;
