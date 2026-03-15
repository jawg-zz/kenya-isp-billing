import crypto from 'crypto';
import { prisma } from '../config/database';
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

      const data: AirtelTokenResponse = await response.json();
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

      const data: AirtelPaymentResponse = await response.json();

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

      const data: AirtelTransactionStatus = await response.json();
      logger.info('Airtel transaction status check:', data);
      return data;
    } catch (error) {
      logger.error('Airtel status check error:', error);
      throw new AppError('Failed to check transaction status', 500);
    }
  }

  // Process callback
  async processCallback(callback: AirtelCallback): Promise<void> {
    const { transaction } = callback;

    logger.info('Airtel callback received:', {
      transactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
    });

    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        reference: transaction.reference,
      },
      include: {
        customer: true,
        subscription: true,
      },
    });

    if (!payment) {
      logger.error('Payment not found for callback:', {
        reference: transaction.reference,
      });
      return;
    }

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

      await prisma.payment.update({
        where: { id: payment.id },
        data: updateData,
      });

      // Process successful payment
      await this.handleSuccessfulPayment(payment);
    } else if (transaction.status === 'FAILED') {
      updateData.status = 'FAILED';
      updateData.resultDesc = transaction.status;

      await prisma.payment.update({
        where: { id: payment.id },
        data: updateData,
      });

      logger.warn('Airtel payment failed:', {
        paymentId: payment.id,
        status: transaction.status,
      });

      // Notify customer
      await prisma.notification.create({
        data: {
          userId: payment.customer.userId,
          type: 'PAYMENT_FAILED',
          title: 'Payment Failed',
          message: `Your Airtel Money payment of KES ${payment.amount} failed.`,
          channel: 'in_app',
        },
      });
    }
  }

  // Handle successful payment (same logic as M-Pesa)
  private async handleSuccessfulPayment(payment: any): Promise<void> {
    try {
      // Update customer balance
      await prisma.customer.update({
        where: { id: payment.customerId },
        data: {
          balance: {
            increment: payment.amount,
          },
        },
      });

      // Update invoice if exists
      if (payment.invoiceId) {
        await prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });
      }

      // Activate or renew subscription if exists
      if (payment.subscriptionId) {
        const subscription = await prisma.subscription.findUnique({
          where: { id: payment.subscriptionId },
          include: { plan: true },
        });

        if (subscription) {
          const plan = subscription.plan;
          const now = new Date();
          const newEndDate = new Date(now);
          newEndDate.setDate(newEndDate.getDate() + plan.validityDays);

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE',
              startDate: now,
              endDate: newEndDate,
              dataUsed: 0,
              dataRemaining: plan.dataAllowance,
            },
          });

          await prisma.notification.create({
            data: {
              userId: payment.customer.userId,
              type: 'SUBSCRIPTION_ACTIVATED',
              title: 'Subscription Activated',
              message: `Your ${plan.name} subscription has been activated.`,
              channel: 'in_app',
            },
          });
        }
      }

      // Create notification
      await prisma.notification.create({
        data: {
          userId: payment.customer.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Received',
          message: `Your Airtel Money payment of KES ${payment.amount} has been received.`,
          channel: 'in_app',
        },
      });

      logger.info('Airtel payment processed successfully:', { paymentId: payment.id });
    } catch (error) {
      logger.error('Error processing Airtel payment:', error);
    }
  }
}

export const airtelService = new AirtelService();
export default airtelService;
