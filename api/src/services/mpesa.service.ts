import crypto from 'crypto';
import { prisma } from '../config/database';
import config from '../config';
import { logger } from '../config/logger';
import { AppError, PaymentError, MpesaSTKPushRequest, MpesaCallback } from '../types';

interface MpesaTokenResponse {
  access_token: string;
  expires_in: string;
}

interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

class MpesaService {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.baseUrl = config.mpesa.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  // Get OAuth token
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`
    ).toString('base64');

    try {
      const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get M-Pesa access token: ${response.statusText}`);
      }

      const data = await response.json() as MpesaTokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (parseInt(data.expires_in) * 1000) - 60000); // 1 min buffer

      return this.accessToken;
    } catch (error) {
      logger.error('M-Pesa token error:', error);
      throw new AppError('Failed to authenticate with M-Pesa', 500);
    }
  }

  // Generate password for STK Push
  private generatePassword(): string {
    const timestamp = this.getTimestamp();
    const password = Buffer.from(
      `${config.mpesa.shortcode}${config.mpesa.passkey}${timestamp}`
    ).toString('base64');
    return password;
  }

  // Get current timestamp
  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  // Format phone number to 254 format
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return `254${cleaned.substring(1)}`;
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return `254${cleaned}`;
    }

    return cleaned;
  }

  // Initiate STK Push
  async initiateSTKPush(request: MpesaSTKPushRequest): Promise<STKPushResponse> {
    const accessToken = await this.getAccessToken();
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);

    // Validate phone number format
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
      throw new PaymentError('Invalid phone number format');
    }

    const payload = {
      BusinessShortCode: config.mpesa.shortcode,
      Password: this.generatePassword(),
      Timestamp: this.getTimestamp(),
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(request.amount),
      PartyA: formattedPhone,
      PartyB: config.mpesa.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: config.mpesa.callbackUrl,
      AccountReference: request.accountReference.substring(0, 20),
      TransactionDesc: request.transactionDesc.substring(0, 100),
    };

    logger.info('Initiating M-Pesa STK Push:', {
      phone: formattedPhone,
      amount: request.amount,
      reference: request.accountReference,
    });

    try {
      const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as STKPushResponse;

      if (data.ResponseCode !== '0') {
        logger.error('M-Pesa STK Push failed:', data);
        throw new PaymentError(data.ResponseDescription || 'STK Push failed');
      }

      logger.info('M-Pesa STK Push initiated:', {
        merchantRequestId: data.MerchantRequestID,
        checkoutRequestId: data.CheckoutRequestID,
      });

      return data;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      logger.error('M-Pesa STK Push error:', error);
      throw new PaymentError('Failed to initiate payment');
    }
  }

  // Query STK Push status
  async querySTKPushStatus(checkoutRequestId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const payload = {
      BusinessShortCode: config.mpesa.shortcode,
      Password: this.generatePassword(),
      Timestamp: this.getTimestamp(),
      CheckoutRequestID: checkoutRequestId,
    };

    try {
      const response = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      logger.info('M-Pesa STK Push query:', data);
      return data;
    } catch (error) {
      logger.error('M-Pesa STK Push query error:', error);
      throw new AppError('Failed to query payment status', 500);
    }
  }

  // Process callback
  async processCallback(callback: MpesaCallback): Promise<void> {
    const { stkCallback } = callback.Body;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    logger.info('M-Pesa callback received:', {
      merchantRequestId: MerchantRequestID,
      checkoutRequestId: CheckoutRequestID,
      resultCode: ResultCode,
    });

    const callbackId = MerchantRequestID || CheckoutRequestID;
    const idempotencyKey = `mpesa:callback:${callbackId}`;

    let subscriptionId: string | undefined;
    let customerId: string | undefined;

    try {
      await prisma.$transaction(async (tx) => {
        const lockedPayments = await tx.$queryRaw<any[]>`
          SELECT p.*, c."balance" as "customer_balance"
          FROM "Payment" p
          JOIN "customers" c ON c.id = p."customerId"
          WHERE p."merchantRequestId" = ${MerchantRequestID}
             OR p."checkoutRequestId" = ${CheckoutRequestID}
          FOR UPDATE
        `;

        const lockedPayment = lockedPayments?.[0];

        if (!lockedPayment) {
          logger.error('Payment not found for callback:', {
            merchantRequestId: MerchantRequestID,
            checkoutRequestId: CheckoutRequestID,
          });
          return;
        }

        if (lockedPayment.status === 'COMPLETED' || lockedPayment.status === 'FAILED') {
          logger.warn(`Payment ${lockedPayment.id} already processed with status ${lockedPayment.status}`);
          return;
        }

        const payment = await tx.payment.findUnique({
          where: { id: lockedPayment.id },
          include: {
            customer: true,
            subscription: true,
          },
        });

        if (!payment) return;

        subscriptionId = payment.subscriptionId;
        customerId = payment.customerId;

        let mpesaReceiptNumber: string | undefined;
        let transactionDate: string | undefined;
        let phoneNumber: string | undefined;

        if (stkCallback.CallbackMetadata) {
          for (const item of stkCallback.CallbackMetadata.Item) {
            switch (item.Name) {
              case 'MpesaReceiptNumber':
                mpesaReceiptNumber = item.Value as string;
                break;
              case 'TransactionDate':
                transactionDate = item.Value as string;
                break;
              case 'PhoneNumber':
                phoneNumber = item.Value as string;
                break;
            }
          }
        }

        const updateData: any = {
          resultCode: ResultCode.toString(),
          resultDesc: ResultDesc,
          metadata: {
            ...((payment.metadata as object) || {}),
            mpesaReceiptNumber,
            transactionDate,
            phoneNumber,
          },
        };

        if (ResultCode === 0) {
          updateData.status = 'COMPLETED';
          updateData.reference = mpesaReceiptNumber;
          updateData.processedAt = new Date();

          await tx.payment.update({
            where: { id: payment.id },
            data: updateData,
          });

          await this.handleSuccessfulPaymentWithinTransaction(tx, payment);
        } else {
          updateData.status = 'FAILED';

          await tx.payment.update({
            where: { id: payment.id },
            data: updateData,
          });

          logger.warn('M-Pesa payment failed:', {
            paymentId: payment.id,
            resultCode: ResultCode,
            resultDesc: ResultDesc,
          });

          await tx.notification.create({
            data: {
              userId: payment.customer.userId,
              type: 'PAYMENT_FAILED',
              title: 'Payment Failed',
              message: `Your M-Pesa payment of KES ${payment.amount} failed: ${ResultDesc}`,
              channel: 'in_app',
            },
          });
        }
      });

      // Transaction succeeded — set the idempotency key NOW (after successful processing)
      try {
        const { cache } = await import('../config/redis');
        await cache.set(idempotencyKey, { processedAt: new Date().toISOString() }, 86400);
      } catch (redisError) {
        logger.error('Failed to set idempotency key after successful callback processing:', redisError);
      }

      // Invalidate RADIUS cache if subscription was activated/renewed
      if (subscriptionId && customerId) {
        try {
          const { radiusService } = await import('./radius.service');
          await radiusService.invalidateCacheForCustomer(customerId);
        } catch (err) {
          logger.error('Failed to invalidate RADIUS cache after M-Pesa payment:', err);
        }
      }

      logger.info('M-Pesa callback processed successfully:', {
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID,
      });
    } catch (error) {
      // Processing failed — delete the idempotency key so retry is allowed.
      // Without this, the retry would be blocked by the middleware's
      // "already processed" check even though processing never completed.
      try {
        const { cache } = await import('../config/redis');
        await cache.del(idempotencyKey);
        logger.info(`Idempotency key deleted for failed callback, retry will be allowed: ${callbackId}`);
      } catch (redisError) {
        logger.error('Failed to delete idempotency key after callback processing failure:', redisError);
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
          logger.warn(`M-Pesa payment received for ${subscription.status} subscription ${subscription.id}, not activating. Customer ${payment.customerId} needs to create a new subscription.`, {
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
              message: `Your M-Pesa payment of KES ${payment.amount} was received, but your ${plan.name} subscription is ${subscription.status.toLowerCase()} and cannot be reactivated. Please create a new subscription to activate your service.`,
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

        // Create notification
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
        message: `Your M-Pesa payment of KES ${payment.amount} has been received successfully.`,
        channel: 'in_app',
      },
    });

    logger.info('Payment processed successfully:', { paymentId: payment.id });
  }

  // Handle successful payment (non-transaction wrapper for external calls)
  private async handleSuccessfulPayment(payment: any): Promise<void> {
    try {
      await this.handleSuccessfulPaymentWithinTransaction(prisma, payment);
    } catch (error) {
      logger.error('Error processing successful payment:', error);
    }
  }

  // Validate callback signature
  validateCallback(body: any): boolean {
    // Check required fields
    if (!body?.Body?.stkCallback) return false;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = body.Body.stkCallback;
    if (!MerchantRequestID || !CheckoutRequestID || ResultCode == null || !ResultDesc) return false;
    // Ensure ResultCode is a number
    if (typeof ResultCode !== 'number') return false;
    return true;
  }
}

export const mpesaService = new MpesaService();
export default mpesaService;
