import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { cache } from '../config/redis';
import { Decimal } from '@prisma/client/runtime/library';
import { mpesaService } from '../services/mpesa.service';
import { airtelService } from '../services/airtel.service';
import { hotspotService } from '../services/hotspot.service';
import { smsService } from '../services/sms.service';
import { AuthenticatedRequest, ApiResponse, MpesaCallback, AirtelCallback } from '../types';
import { logger } from '../config/logger';

class PaymentController {
  // Initiate M-Pesa STK Push
  async initiateMpesaPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber, amount, accountReference, transactionDesc } = req.body;
      
      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid amount',
        });
        return;
      }

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

      // Generate payment reference
      const paymentNumber = `MP${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      // Create pending payment record
      const payment = await prisma.payment.create({
        data: {
          paymentNumber,
          customerId: customer.id,
          userId: req.user!.id,
          amount,
          currency: 'KES',
          method: 'MPESA',
          status: 'PENDING',
          metadata: {
            phoneNumber,
            accountReference,
            transactionDesc,
          },
        },
      });

      // Initiate STK Push
      const result = await mpesaService.initiateSTKPush({
        phoneNumber: phoneNumber || customer.user.phone,
        amount,
        accountReference: accountReference || paymentNumber,
        transactionDesc: transactionDesc || `ISP Payment ${paymentNumber}`,
      });

      // Update payment with M-Pesa request IDs
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          merchantRequestId: result.MerchantRequestID,
          checkoutRequestId: result.CheckoutRequestID,
          metadata: {
            ...((payment.metadata as object) || {}),
            merchantRequestId: result.MerchantRequestID,
            checkoutRequestId: result.CheckoutRequestID,
          },
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Payment initiated. Please check your phone for the M-Pesa prompt.',
        data: {
          paymentId: payment.id,
          checkoutRequestId: result.CheckoutRequestID,
          customerMessage: result.CustomerMessage,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // M-Pesa Callback
  async mpesaCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('M-Pesa callback received');

      const callback: MpesaCallback = req.body;

      if (!mpesaService.validateCallback(callback)) {
        logger.error('Invalid M-Pesa callback');
        res.status(400).json({ error: 'Invalid callback' });
        return;
      }

      await mpesaService.processCallback(callback);

      // Also check if this is a hotspot purchase
      if (callback?.Body?.stkCallback?.CheckoutRequestID) {
        const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback.Body.stkCallback;
        hotspotService.processPaymentCallback(CheckoutRequestID, ResultCode, CallbackMetadata)
          .catch(err => logger.error('Hotspot callback processing error:', err));
      }

      // Invalidate admin revenue/invoice caches on payment completion
      await cache.invalidatePattern('admin:revenue:*');
      await cache.del('admin:invoice-stats');

      // M-Pesa expects a specific response format
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error) {
      logger.error('M-Pesa callback error:', error);
      // Always return 200 to M-Pesa to prevent retries
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
  }

  // M-Pesa Timeout
  async mpesaTimeout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('M-Pesa timeout received');
      const { CheckoutRequestID } = req.body;

      // Update payment status to timeout
      await prisma.payment.updateMany({
        where: { checkoutRequestId: CheckoutRequestID },
        data: {
          status: 'TIMEOUT',
          resultDesc: 'Payment timeout',
        },
      });

      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error) {
      logger.error('M-Pesa timeout error:', error);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
  }

  // Check M-Pesa payment status
  async checkMpesaStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentId = req.params.paymentId as string;

      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          userId: req.user!.id,
          method: 'MPESA',
        },
      });

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
        return;
      }

      // If still pending, check with M-Pesa
      if (payment.status === 'PENDING' && payment.checkoutRequestId) {
        const status = await mpesaService.querySTKPushStatus(payment.checkoutRequestId);

        if (status.ResponseCode === '0') {
          // Update payment status
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'COMPLETED',
              processedAt: new Date(),
              reference: status.MpesaReceiptNumber,
            },
          });
        }
      }

      const response: ApiResponse = {
        success: true,
        data: { payment },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Initiate Airtel Money Payment
  async initiateAirtelPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber, amount, description } = req.body;
      
      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid amount',
        });
        return;
      }

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

      const paymentNumber = `AIR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const payment = await prisma.payment.create({
        data: {
          paymentNumber,
          customerId: customer.id,
          userId: req.user!.id,
          amount,
          currency: 'KES',
          method: 'AIREL_MONEY',
          status: 'PENDING',
          metadata: {
            phoneNumber,
            description,
          },
        },
      });

      const result = await airtelService.initiatePayment({
        phoneNumber: phoneNumber || customer.user.phone,
        amount,
        reference: paymentNumber,
        description: description || `ISP Payment ${paymentNumber}`,
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          reference: result.data.transaction.reference,
          metadata: {
            ...((payment.metadata as object) || {}),
            airtelTransactionId: result.data.transaction.id,
          },
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Payment initiated. Please check your phone for the Airtel Money prompt.',
        data: {
          paymentId: payment.id,
          reference: result.data.transaction.reference,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // Airtel Money Callback
  async airtelCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Airtel callback received');

      const callback: AirtelCallback = req.body;
      await airtelService.processCallback(callback);

      // Invalidate admin revenue/invoice caches on payment completion
      await cache.invalidatePattern('admin:revenue:*');
      await cache.del('admin:invoice-stats');

      res.status(200).json({ status: 'SUCCESS' });
    } catch (error) {
      logger.error('Airtel callback error:', error);
      res.status(200).json({ status: 'SUCCESS' });
    }
  }

  // Get payment history
  async getPaymentHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const method = req.query.method as string;

      const where: any = { userId: req.user!.id };
      if (status) where.status = status;
      if (method) where.method = method;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
              },
            },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          payments,
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
  }

  // Get single payment
  async getPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const payment = await prisma.payment.findFirst({
        where: {
          id,
          userId: req.user!.id,
        },
        include: {
          invoice: true,
          customer: {
            include: { user: true },
          },
        },
      });

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { payment },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get all payments (admin)
  async getAllPayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const method = req.query.method as string;
      const customerId = req.query.customerId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const where: any = {};
      if (status) where.status = status;
      if (method) where.method = method;
      if (customerId) where.customerId = customerId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            customer: {
              include: { user: { select: { firstName: true, lastName: true, phone: true } } },
            },
            invoice: { select: { invoiceNumber: true } },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          payments,
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
  }

  // Process cash payment (agent)
  async processCashPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerId, amount, reference, notes } = req.body;
      
      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid amount',
        });
        return;
      }
      const amountDecimal = new Decimal(amount);

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: { user: true },
      });

      if (!customer) {
        res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
        return;
      }

      const paymentNumber = `CSH${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const payment = await prisma.payment.create({
        data: {
          paymentNumber,
          customerId,
          userId: req.user!.id,
          amount: amountDecimal,
          currency: 'KES',
          method: 'CASH',
          status: 'COMPLETED',
          reference,
          processedAt: new Date(),
          metadata: { notes, processedBy: req.user!.id },
        },
      });

      // Update customer balance
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          balance: { increment: amountDecimal },
        },
      });

      // Send SMS confirmation
      if (customer.user.phone) {
        await smsService.sendPaymentConfirmation(
          customer.user.phone,
          amountDecimal.toNumber(),
          reference,
          customer.balance.plus(amountDecimal).toNumber()
        );
      }

      // Invalidate admin revenue/invoice caches
      await cache.invalidatePattern('admin:revenue:*');
      await cache.del('admin:invoice-stats');

      const response: ApiResponse = {
        success: true,
        message: 'Cash payment processed successfully',
        data: { payment },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get payment stats (admin) — cached 5 min
  async getPaymentStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const periodKey = `${startDate.toISOString()}_${endDate.toISOString()}`;
      const cacheKey = `admin:revenue:${periodKey}`;

      // Check cache
      const cached = await cache.get<any>(cacheKey);
      if (cached) {
        res.json({ success: true, data: cached });
        return;
      }

      const [totalRevenue, paymentsByMethod, paymentsByDay] = await Promise.all([
        prisma.payment.aggregate({
          where: {
            status: 'COMPLETED',
            processedAt: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.payment.groupBy({
          by: ['method'],
          where: {
            status: 'COMPLETED',
            processedAt: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.$queryRaw`
          SELECT
            DATE("processedAt") as date,
            SUM(amount) as "totalAmount",
            COUNT(*) as "count"
          FROM payments
          WHERE status = 'COMPLETED'
            AND "processedAt" >= ${startDate}
            AND "processedAt" <= ${endDate}
          GROUP BY DATE("processedAt")
          ORDER BY date ASC
        ` as Promise<any[]>,
      ]);

      const data = {
        totalRevenue: Number(totalRevenue._sum.amount) || 0,
        totalTransactions: totalRevenue._count,
        paymentsByMethod,
        paymentsByDay,
        period: { startDate, endDate },
      };

      // Cache for 5 minutes
      await cache.set(cacheKey, data, 300);

      const response: ApiResponse = {
        success: true,
        data,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
export default paymentController;
