import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';

class PlanController {
  // Get all plans (public)
  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.query.type as string;
      const dataType = req.query.dataType as string;

      const where: any = { isActive: true };
      if (type) where.type = type;
      if (dataType) where.dataType = dataType;

      const plans = await prisma.plan.findMany({
        where,
        include: {
          planPrices: { where: { isActive: true } },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { price: 'asc' },
        ],
      });

      const response: ApiResponse = {
        success: true,
        data: { plans },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get single plan
  async getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const plan = await prisma.plan.findUnique({
        where: { id },
        include: {
          planPrices: { where: { isActive: true } },
        },
      });

      if (!plan) {
        throw new NotFoundError('Plan not found');
      }

      const response: ApiResponse = {
        success: true,
        data: { plan },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Create plan (admin)
  async createPlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        name,
        description,
        code,
        type,
        dataType,
        price,
        dataAllowance,
        voiceMinutes,
        smsAllowance,
        speedLimit,
        billingCycle,
        validityDays,
        fupThreshold,
        fupSpeedLimit,
        isFeatured,
        sortOrder,
        prices,
      } = req.body;

      const plan = await prisma.plan.create({
        data: {
          name,
          description,
          code: code.toUpperCase(),
          type,
          dataType,
          price,
          dataAllowance: dataAllowance ? dataAllowance * 1024 * 1024 : null, // Convert MB to bytes
          voiceMinutes,
          smsAllowance,
          speedLimit,
          billingCycle,
          validityDays,
          fupThreshold: fupThreshold ? fupThreshold * 1024 * 1024 : null,
          fupSpeedLimit,
          isFeatured,
          sortOrder,
          planPrices: prices
            ? {
                create: prices.map((p: any) => ({
                  billingCycle: p.billingCycle,
                  price: p.price,
                })),
              }
            : undefined,
        },
        include: {
          planPrices: true,
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Plan created successfully',
        data: { plan },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // Update plan (admin)
  async updatePlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Convert MB to bytes if data fields are provided
      if (updateData.dataAllowance) {
        updateData.dataAllowance = updateData.dataAllowance * 1024 * 1024;
      }
      if (updateData.fupThreshold) {
        updateData.fupThreshold = updateData.fupThreshold * 1024 * 1024;
      }

      const plan = await prisma.plan.update({
        where: { id },
        data: updateData,
        include: {
          planPrices: true,
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Plan updated successfully',
        data: { plan },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Delete plan (admin)
  async deletePlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Check if plan has active subscriptions
      const activeSubscriptions = await prisma.subscription.count({
        where: {
          planId: id,
          status: 'ACTIVE',
        },
      });

      if (activeSubscriptions > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete plan with active subscriptions',
        });
        return;
      }

      await prisma.plan.update({
        where: { id },
        data: { isActive: false },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Plan deactivated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get featured plans
  async getFeaturedPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await prisma.plan.findMany({
        where: {
          isActive: true,
          isFeatured: true,
        },
        include: {
          planPrices: { where: { isActive: true } },
        },
        orderBy: { sortOrder: 'asc' },
        take: 6,
      });

      const response: ApiResponse = {
        success: true,
        data: { plans },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const planController = new PlanController();
export default planController;
