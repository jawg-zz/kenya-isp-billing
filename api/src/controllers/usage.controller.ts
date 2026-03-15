import { Response, NextFunction } from 'express';
import { usageService } from '../services/usage.service';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';

class UsageController {
  // Get current usage summary
  async getUsageSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = await require('../config/database').prisma.customer.findFirst({
        where: { userId: req.user!.id },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const usage = await usageService.getCustomerUsage(customer.id);

      const response: ApiResponse = {
        success: true,
        data: { usage },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get real-time usage
  async getRealtimeUsage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = await require('../config/database').prisma.customer.findFirst({
        where: { userId: req.user!.id },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const usage = await usageService.getRealtimeUsage(customer.id);

      const response: ApiResponse = {
        success: true,
        data: { usage },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get usage history
  async getUsageHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prisma } = require('../config/database');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const customer = await prisma.customer.findFirst({
        where: { userId: req.user!.id },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const where: any = {
        customerId: customer.id,
      };

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
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

      const response: ApiResponse = {
        success: true,
        data: {
          records,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get usage analytics (admin)
  async getUsageAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;

      const analytics = await usageService.getUsageAnalytics(startDate, endDate);

      const response: ApiResponse = {
        success: true,
        data: { analytics },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Format bytes helper
  async formatBytes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bytes = parseInt(req.query.bytes as string) || 0;
      
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let value = bytes;
      let unitIndex = 0;

      while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          bytes,
          formatted: `${value.toFixed(2)} ${units[unitIndex]}`,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const usageController = new UsageController();
export default usageController;
