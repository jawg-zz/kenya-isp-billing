import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { smsService } from '../services/sms.service';
import { radiusService } from '../services/radius.service';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';
import { logger } from '../config/logger';

class SubscriptionController {
  // Get customer's subscriptions
  async getSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const where: any = {
        customer: { userId: req.user!.id },
      };
      if (status) where.status = status;

      const [subscriptions, total] = await Promise.all([
        prisma.subscription.findMany({
          where,
          include: {
            plan: {
              include: { planPrices: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.subscription.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptions,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get single subscription
  async getSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const subscription = await prisma.subscription.findFirst({
        where: {
          id,
          customer: { userId: req.user!.id },
        },
        include: {
          plan: {
            include: { planPrices: true },
          },
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!subscription) {
        throw new NotFoundError('Subscription not found');
      }

      const response: ApiResponse = {
        success: true,
        data: { subscription },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Create subscription (purchase plan)
  async createSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { planId, autoRenew = true } = req.body;

      // Get customer
      const customer = await prisma.customer.findFirst({
        where: { userId: req.user!.id },
        include: { user: true },
      });

      if (!customer) {
        res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
        return;
      }

      // Get plan
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
      });

      if (!plan || !plan.isActive) {
        throw new NotFoundError('Plan not found or inactive');
      }

      // Check for existing active subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          customerId: customer.id,
          status: 'ACTIVE',
        },
      });

      if (existingSubscription) {
        res.status(400).json({
          success: false,
          message: 'You already have an active subscription. Please renew or change your plan.',
        });
        return;
      }

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.validityDays);

      // Create subscription
      const subscription = await prisma.subscription.create({
        data: {
          customerId: customer.id,
          planId,
          type: plan.type,
          status: 'ACTIVE',
          startDate,
          endDate,
          autoRenew,
          dataRemaining: plan.dataAllowance,
        },
        include: {
          plan: true,
        },
      });

      // Create RADIUS user if not exists
      await radiusService.createRadiusUser(customer.id);

      // Send SMS notification
      if (customer.user.phone) {
        await smsService.sendSubscriptionActivation(
          customer.user.phone,
          plan.name,
          endDate.toLocaleDateString('en-KE')
        );
      }

      // Create notification
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          type: 'SUBSCRIPTION_ACTIVATED',
          title: 'Subscription Activated',
          message: `Your ${plan.name} subscription has been activated. Valid until ${endDate.toLocaleDateString('en-KE')}.`,
          channel: 'in_app',
        },
      });

      logger.info(`Subscription created: ${subscription.id} for customer ${customer.id}`);

      const response: ApiResponse = {
        success: true,
        message: 'Subscription activated successfully',
        data: { subscription },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // Renew subscription
  async renewSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId } = req.body;

      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          customer: { userId: req.user!.id },
        },
        include: {
          plan: true,
          customer: { include: { user: true } },
        },
      });

      if (!subscription) {
        throw new NotFoundError('Subscription not found');
      }

      // Calculate new dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + subscription.plan.validityDays);

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'ACTIVE',
          startDate,
          endDate,
          dataUsed: 0,
          dataRemaining: subscription.plan.dataAllowance,
          voiceMinutesUsed: 0,
          smsUsed: 0,
        },
        include: {
          plan: true,
        },
      });

      // Send SMS notification
      if (subscription.customer.user.phone) {
        await smsService.sendSubscriptionActivation(
          subscription.customer.user.phone,
          subscription.plan.name,
          endDate.toLocaleDateString('en-KE')
        );
      }

      const response: ApiResponse = {
        success: true,
        message: 'Subscription renewed successfully',
        data: { subscription: updatedSubscription },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Cancel subscription
  async cancelSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId, reason, immediate = false } = req.body;

      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          customer: { userId: req.user!.id },
          status: 'ACTIVE',
        },
        include: {
          plan: true,
          customer: { include: { user: true } },
        },
      });

      if (!subscription) {
        throw new NotFoundError('Active subscription not found');
      }

      const endDate = immediate ? new Date() : subscription.endDate;

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'TERMINATED',
          endDate,
          metadata: {
            ...((subscription.metadata as object) || {}),
            cancellationReason: reason,
            cancelledAt: new Date().toISOString(),
            immediate,
          },
        },
      });

      // If immediate, disable RADIUS user
      if (immediate) {
        await radiusService.disableUser(subscription.customerId);
      }

      // Send notification
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          type: 'SUBSCRIPTION_EXPIRED',
          title: 'Subscription Cancelled',
          message: `Your ${subscription.plan.name} subscription has been cancelled.${immediate ? ' Your internet access has been stopped.' : ''}`,
          channel: 'in_app',
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Subscription cancelled successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Toggle auto-renew
  async toggleAutoRenew(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subscriptionId, autoRenew } = req.body;

      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          customer: { userId: req.user!.id },
        },
      });

      if (!subscription) {
        throw new NotFoundError('Subscription not found');
      }

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { autoRenew },
      });

      const response: ApiResponse = {
        success: true,
        message: `Auto-renew ${autoRenew ? 'enabled' : 'disabled'}`,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get all subscriptions (admin)
  async getAllSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const type = req.query.type as string;
      const customerId = req.query.customerId as string;

      const where: any = {};
      if (status) where.status = status;
      if (type) where.type = type;
      if (customerId) where.customerId = customerId;

      const [subscriptions, total] = await Promise.all([
        prisma.subscription.findMany({
          where,
          include: {
            plan: { select: { name: true, code: true } },
            customer: {
              include: { user: { select: { firstName: true, lastName: true, phone: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.subscription.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptions,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get expiring subscriptions (admin)
  async getExpiringSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 3;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            lte: futureDate,
            gte: new Date(),
          },
        },
        include: {
          plan: { select: { name: true } },
          customer: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
        },
        orderBy: { endDate: 'asc' },
      });

      const response: ApiResponse = {
        success: true,
        data: { subscriptions },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionController = new SubscriptionController();
export default subscriptionController;
