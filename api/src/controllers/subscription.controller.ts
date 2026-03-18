import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { smsService } from '../services/sms.service';
import { radiusService } from '../services/radius.service';
import { mpesaService } from '../services/mpesa.service';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';
import { logger } from '../config/logger';
import crypto from 'crypto';

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
      const id = req.params.id as string;

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

      // Check for existing active or pending subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          customerId: customer.id,
          status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
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

      // Check if customer has sufficient balance to activate immediately
      const planPrice = plan.price;
      const hasSufficientBalance = customer.balance.gte(planPrice);

      let subscription;

      if (hasSufficientBalance) {
        // Deduct balance and activate immediately
        await prisma.$transaction(async (tx) => {
          // Deduct from balance
          await tx.customer.update({
            where: { id: customer.id },
            data: { balance: { decrement: planPrice } },
          });

          // Create subscription as ACTIVE
          subscription = await tx.subscription.create({
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
            include: { plan: true },
          });

          // Create payment record
          const paymentNumber = `BAL-${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          await tx.payment.create({
            data: {
              paymentNumber,
              customerId: customer.id,
              subscriptionId: subscription.id,
              userId: req.user!.id,
              amount: planPrice,
              currency: 'KES',
              method: 'BALANCE',
              status: 'COMPLETED',
              processedAt: new Date(),
              reference: `SUB-${subscription.id}`,
              metadata: {
                subscriptionId: subscription.id,
                planId: plan.id,
                type: 'SUBSCRIPTION_PURCHASE',
                balanceDeduction: true,
              },
            },
          });
        });

        // Create RADIUS user
        await radiusService.createRadiusUser(customer.id);

        // Create in-app notification (matches M-Pesa callback path)
        await prisma.notification.create({
          data: {
            userId: customer.userId,
            type: 'SUBSCRIPTION_ACTIVATED',
            title: 'Subscription Activated',
            message: `Your ${plan.name} subscription has been activated. Valid until ${endDate.toLocaleDateString('en-KE')}`,
            channel: 'in_app',
          },
        });

        // Send SMS notification
        if (customer.user.phone) {
          await smsService.sendSubscriptionActivation(
            customer.user.phone,
            plan.name,
            endDate.toLocaleDateString('en-KE')
          );
        }

        logger.info(`Subscription created (balance-paid): ${subscription.id} for customer ${customer.id}`);

        const response: ApiResponse = {
          success: true,
          message: 'Subscription activated successfully',
          data: { subscription },
        };
        res.status(201).json(response);
      } else {
        // Insufficient balance — create as PENDING_PAYMENT and initiate M-Pesa STK Push
        subscription = await prisma.subscription.create({
          data: {
            customerId: customer.id,
            planId,
            type: plan.type,
            status: 'PENDING_PAYMENT',
            startDate,
            endDate,
            autoRenew,
            dataRemaining: plan.dataAllowance,
          },
          include: { plan: true },
        });

        // Create pending payment record
        const paymentNumber = `MP-${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const payment = await prisma.payment.create({
          data: {
            paymentNumber,
            customerId: customer.id,
            subscriptionId: subscription.id,
            userId: req.user!.id,
            amount: Number(planPrice),
            currency: 'KES',
            method: 'MPESA',
            status: 'PENDING',
            metadata: {
              subscriptionId: subscription.id,
              planId: plan.id,
              type: 'SUBSCRIPTION_PURCHASE',
            },
          },
        });

        // Initiate M-Pesa STK Push
        let mpesaResult;
        try {
          mpesaResult = await mpesaService.initiateSTKPush({
            phoneNumber: customer.user.phone,
            amount: Number(planPrice),
            accountReference: paymentNumber,
            transactionDesc: `Subscription: ${plan.name}`,
          });

          // Update payment with M-Pesa request IDs
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              merchantRequestId: mpesaResult.MerchantRequestID,
              checkoutRequestId: mpesaResult.CheckoutRequestID,
              metadata: {
                ...((payment.metadata as object) || {}),
                merchantRequestId: mpesaResult.MerchantRequestID,
                checkoutRequestId: mpesaResult.CheckoutRequestID,
              },
            },
          });
        } catch (mpesaError) {
          logger.error('M-Pesa STK Push failed for subscription:', mpesaError);
          // Update payment as failed
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          });

          // Update subscription as failed
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'TERMINATED' },
          });

          res.status(500).json({
            success: false,
            message: 'Failed to initiate M-Pesa payment. Please try again.',
          });
          return;
        }

        logger.info(`Subscription created (pending payment): ${subscription.id} for customer ${customer.id}`);

        const response: ApiResponse = {
          success: true,
          message: 'Subscription pending payment. Please check your phone for the M-Pesa prompt.',
          data: {
            subscription,
            checkoutRequestId: mpesaResult!.CheckoutRequestID,
            paymentId: payment.id,
          },
        };
        res.status(201).json(response);
      }
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

      // Check customer balance before renewing
      const planPrice = subscription.plan.price;
      const customerBalance = subscription.customer.balance;

      if (customerBalance.lessThan(planPrice)) {
        res.status(400).json({
          success: false,
          message: 'Insufficient balance',
        });
        return;
      }

      // Deduct plan price from customer balance
      const updatedCustomer = await prisma.customer.update({
        where: { id: subscription.customerId },
        data: {
          balance: { decrement: planPrice },
        },
      });

      // Create payment record for the deduction
      const paymentNumber = `BAL-${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      await prisma.payment.create({
        data: {
          paymentNumber,
          customerId: subscription.customerId,
          amount: planPrice,
          currency: 'KES',
          method: 'BALANCE',
          status: 'COMPLETED',
          processedAt: new Date(),
          reference: `RENEW-${subscriptionId}`,
          metadata: {
            subscriptionId: subscription.id,
            planId: subscription.planId,
            type: 'SUBSCRIPTION_RENEWAL',
            balanceDeduction: true,
            balanceBefore: customerBalance,
            balanceAfter: updatedCustomer.balance,
          },
        },
      });

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

      // Invalidate RADIUS cache so auth picks up renewed subscription
      await radiusService.invalidateCacheForCustomer(subscription.customerId);

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
