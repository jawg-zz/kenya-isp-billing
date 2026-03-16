import { Router, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get audit logs (admin only)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check admin role
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPPORT') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;
    const userId = req.query.userId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build where clause
    const where: any = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const response: ApiResponse = {
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
  } catch (error) {
    next(error);
  }
});

// Get audit log statistics
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check admin role
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
      return;
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Get action counts
    const actionCounts = await prisma.auditLog.groupBy({
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
    const recentLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        actionCounts: actionCounts.map((a) => ({
          action: a.action,
          count: a._count.id,
        })),
        recentActivity: recentLogs,
        totalLogs: await prisma.auditLog.count({ where }),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
