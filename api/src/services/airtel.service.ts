import crypto from 'crypto';
import { prisma } from '../config/database';
import { cache } from '../config/redis';
import config from '../config';
import { logger } from '../config/logger';
import { AppError, PaymentError, AirtelPaymentRequest, AirtelCallback } from '../types';

interface AirtelTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AirtelPaymentResponse {
  data: {
    transaction: {
      id: string;
      reference: string;
      status: string;
      subscriber: {
        country: string;
        msisdn: string;
      };
    };
  };
}

interface AirtelTransactionStatus {
  data: {
    transaction: {
      id: string;
      reference: string;
      status: string;
      amount: {
        value: number;
        currency: string;
      };
      result_code: string;
      result_description: string;
    };
  };
}

class AirtelService {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.baseUrl = config.airtel.environment === 'production'
      ? 'https://openapi.airtel.africa'
      : 'https://openapi.airtel.africa'; // Sandbox uses same URL
  }

  // Get OAuth token
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const payload = {
      client_id: config.airtel.clientId,
      client_secret: config.airtel.clientSecret,
      grant_type: 'client_credentials',
    };

    try {
      const response = await fetch(`${this.baseUrl}/auth/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to get Airtel access token: ${response.statusText}`);
      }

      const data = await response.json() as AirtelTokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000);

      return this.accessToken;
    } catch (error) {
      logger.error('Airtel token error:', error);
      throw new AppError('Failed to authenticate with Airtel Money', 500);
    }
  }

  // Format phone number for Airtel
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return `254${cleaned.substring(1)}`;
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return `254${cleaned}`;
    }

    return cleaned;
  }

  // Generate reference number
  private generateReference(): string {
    return `AIR${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  // Initiate C2B payment (Collection - Customer to Business)
  async initiatePayment(request: AirtelPaymentRequest): Promise<AirtelPaymentResponse> {
    const accessToken = await this.getAccessToken();
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
    const reference = request.reference || this.generateReference();

    // Validate phone number format
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
      throw new PaymentError('Invalid phone number format');
    }

    const payload = {
      reference: reference,
      subscriber: {
        country: 'KE',
        msisdn: formattedPhone,
      },
      transaction: {
        amount: request.amount,
        country: 'KE',
        currency: 'KES',
        description: request.description || `Payment for ISP Services`,
      },
      payment: {
        type: 'MOBILE_MONEY',
      },
    };

    logger.info('Initiating Airtel Money payment:', {
      phone: formattedPhone,
      amount: request.amount,
      reference,
    });

    try {
      const response = await fetch(
        `${this.baseUrl}/merchant/v1/payments/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-country': 'KE',
            'X-currency': 'KES',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json() as AirtelPaymentResponse;

      if (data.data.transaction.status !== 'PENDING') {
        logger.error('Airtel payment initiation failed:', data);
        throw new PaymentError('Failed to initiate Airtel payment');
      }

      logger.info('Airtel payment initiated:', {
        transactionId: data.data.transaction.id,
        reference: data.data.transaction.reference,
      });

      return data;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      logger.error('Airtel payment error:', error);
      throw new PaymentError('Failed to initiate payment');
    }
  }

  // Check transaction status
  async checkTransactionStatus(transactionId: string): Promise<AirtelTransactionStatus> {
    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(
        `${this.baseUrl}/transaction/v3/transactions/${transactionId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-country': 'KE',
            'X-currency': 'KES',
          },
        }
      );

      const data = await response.json() as AirtelTransactionStatus;
      logger.info('Airtel transaction status check:', data);
      return data;
    } catch (error) {
      logger.error('Airtel status check error:', error);
      throw new AppError('Failed to check transaction status', 500);
    }
  }

  // Process callback
  async processCallback(callback: AirtelCallback): Promise<void> {
    // Validate callback payload
    if (!callback?.transaction?.id) {
      logger.error('Airtel callback rejected: missing transaction.id', { callback: JSON.stringify(callback) });
      throw new AppError('Invalid callback: missing transaction.id', 400);
    }

    if (!callback.transaction.reference) {
      logger.error('Airtel callback rejected: missing transaction.reference', { transactionId: callback.transaction.id });
      throw new AppError('Invalid callback: missing transaction.reference', 400);
    }

    if (!callback.transaction.status) {
      logger.error('Airtel callback rejected: missing transaction.status', { transactionId: callback.transaction.id });
      throw new AppError('Invalid callback: missing transaction.status', 400);
    }

    const { transaction } = callback;
    const callbackId = transaction.id || transaction.reference;
    const idempotencyKey = `airtel:callback:${callbackId}`;

    logger.info('Airtel callback received:', {
      transactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
    });

    // Variables to capture from inside the transaction for post-transaction use
    let processedPayment: { subscriptionId: string | null; customerId: string } | null = null;

    try {
      // Use transaction with row-level locking to prevent race conditions.
      // Two concurrent callbacks can both see status=PENDING without FOR UPDATE,
      // causing double-credit of the customer balance.
      await prisma.$transaction(async (tx) => {
        // Lock the payment row with SELECT ... FOR UPDATE before checking status.
        // This serializes concurrent callbacks targeting the same payment.
        const lockedPayments = await tx.$queryRaw<any[]>`
          SELECT * FROM "Payment" WHERE "reference" = ${transaction.reference} FOR UPDATE
        `;

        const lockedPayment = lockedPayments?.[0];

        if (!lockedPayment) {
          logger.error('Payment not found for callback:', {
            reference: transaction.reference,
          });
          return;
        }

        // If payment already processed, skip (safe now because row is locked)
        if (lockedPayment.status === 'COMPLETED' || lockedPayment.status === 'FAILED') {
          logger.warn(`Payment ${lockedPayment.id} already processed with status ${lockedPayment.status}`);
          return;
        }

        // Fetch related data for processing
        const payment = await tx.payment.findUnique({
          where: { id: lockedPayment.id },
          include: {
            customer: true,
            subscription: true,
          },
        });

        if (!payment) return;

        // Capture for post-transaction use
        processedPayment = { subscriptionId: payment.subscriptionId, customerId: payment.customerId };

        // Update payment based on status
        const updateData: any = {
          metadata: {
            ...((payment.metadata as object) || {}),
            airtelTransactionId: transaction.id,
            airtelStatus: transaction.status,
          },
        };

        if (transaction.status === 'SUCCESS') {
          updateData.status = 'COMPLETED';
          updateData.processedAt = new Date();

          await tx.payment.update({
            where: { id: payment.id },
            data: updateData,
          });

          // Process successful payment within same transaction
          await this.handleSuccessfulPaymentWithinTransaction(tx, payment);
        } else if (transaction.status === 'FAILED') {
          updateData.status = 'FAILED';
          updateData.resultDesc = transaction.status;

          await tx.payment.update({
            where: { id: payment.id },
            data: updateData,
          });

          logger.warn('Airtel payment failed:', {
            paymentId: payment.id,
            status: transaction.status,
          });

          // Notify customer
          await tx.notification.create({
            data: {
              userId: payment.customer.userId,
              type: 'PAYMENT_FAILED',
              title: 'Payment Failed',
              message: `Your Airtel Money payment of KES ${payment.amount} failed.`,
              channel: 'in_app',
            },
          });
        }
      });

      // Transaction succeeded — set the idempotency key NOW (after successful processing)
      // so that duplicate callbacks are correctly rejected.
      try {
        await cache.set(idempotencyKey, { processedAt: new Date().toISOString() }, 86400);
      } catch (redisError) {
        logger.error('Failed to set idempotency key after successful Airtel callback processing:', redisError);
      }

      // Invalidate RADIUS cache if subscription was activated/renewed
      if (processedPayment?.subscriptionId) {
        try {
          const { radiusService } = await import('./radius.service');
          await radiusService.invalidateCacheForCustomer(processedPayment.customerId);
        } catch (err) {
          logger.error('Failed to invalidate RADIUS cache after Airtel payment:', err);
        }
      }
    } catch (error) {
      // Processing failed — delete the idempotency key so retry is allowed.
      // Without this, the retry would be blocked by the middleware's
      // "already processed" check even though processing never completed.
      try {
        await cache.del(idempotencyKey);
        logger.info(`Idempotency key deleted for failed Airtel callback, retry will be allowed: ${callbackId}`);
      } catch (redisError) {
        logger.error('Failed to delete idempotency key after Airtel callback processing failure:', redisError);
      }

      throw error;
    }
  }

  // Handle successful payment (within transaction)
  private async handleSuccessfulPaymentWithinTransaction(tx: any, payment: any): Promise<void> {
    // Update customer balance
    await tx.customer.update({
      where: { id: payment.customerId },
      data: {
        balance: {
          increment: payment.amount,
        },
      },
    });

    // Update invoice if exists
    if (payment.invoiceId) {
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    }

    // Activate or renew subscription if exists
    if (payment.subscriptionId) {
      const subscription = await tx.subscription.findUnique({
        where: { id: payment.subscriptionId },
        include: { plan: true },
      });

      if (subscription) {
        const plan = subscription.plan;
        const now = new Date();

        // Only allow activation/extension for PENDING_PAYMENT or ACTIVE subscriptions.
        // TERMINATED, EXPIRED, and SUSPENDED subscriptions should NOT be reactivated
        // by a payment callback — the customer needs to create a new subscription.
        if (subscription.status !== 'PENDING_PAYMENT' && subscription.status !== 'ACTIVE') {
          logger.warn(`Airtel payment received for ${subscription.status} subscription ${subscription.id}, not activating. Customer ${payment.customerId} needs to create a new subscription.`, {
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            paymentId: payment.id,
          });

          // Notify customer that their payment can't activate this subscription
          await tx.notification.create({
            data: {
              userId: payment.customer.userId,
              type: 'PAYMENT_RECEIVED',
              title: 'Payment Received — Action Required',
              message: `Your Airtel Money payment of KES ${payment.amount} was received, but your ${plan.name} subscription is ${subscription.status.toLowerCase()} and cannot be reactivated. Please create a new subscription to activate your service.`,
              channel: 'in_app',
            },
          });

          return;
        }

        let newEndDate = new Date(now);

        // If subscription already active, extend from existing end date
        if (subscription.status === 'ACTIVE' && subscription.endDate > now) {
          newEndDate = new Date(subscription.endDate);
          newEndDate.setDate(newEndDate.getDate() + plan.validityDays);
        } else {
          newEndDate.setDate(newEndDate.getDate() + plan.validityDays);
        }

        const updateData: any = {
          status: 'ACTIVE',
          startDate: now,
          endDate: newEndDate,
          dataUsed: 0,
          dataRemaining: plan.dataAllowance,
          voiceMinutesUsed: 0,
          smsUsed: 0,
        };

        await tx.subscription.update({
          where: { id: subscription.id },
          data: updateData,
        });

        await tx.notification.create({
          data: {
            userId: payment.customer.userId,
            type: 'SUBSCRIPTION_ACTIVATED',
            title: 'Subscription Activated',
            message: `Your ${plan.name} subscription has been activated. Valid until ${newEndDate.toLocaleDateString('en-KE')}`,
            channel: 'in_app',
          },
        });
      }
    }

    // Create payment notification
    await tx.notification.create({
      data: {
        userId: payment.customer.userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        message: `Your Airtel Money payment of KES ${payment.amount} has been received successfully.`,
        channel: 'in_app',
      },
    });

    logger.info('Airtel payment processed successfully:', { paymentId: payment.id });
  }

  // Handle successful payment (non-transaction wrapper for external calls)
  private async handleSuccessfulPayment(payment: any): Promise<void> {
    try {
      await this.handleSuccessfulPaymentWithinTransaction(prisma, payment);
    } catch (error) {
      logger.error('Error processing Airtel payment:', error);
    }
  }
}

export const airtelService = new AirtelService();
export default airtelService;
