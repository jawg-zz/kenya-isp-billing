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

    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { merchantRequestId: MerchantRequestID },
          { checkoutRequestId: CheckoutRequestID },
        ],
      },
      include: {
        customer: true,
        subscription: true,
      },
    });

    if (!payment) {
      logger.error('Payment not found for callback:', {
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID,
      });
      return;
    }

    // Extract callback metadata
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

    // Update payment based on result code
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
      // Payment successful
      updateData.status = 'COMPLETED';
      updateData.reference = mpesaReceiptNumber;
      updateData.processedAt = new Date();

      await prisma.payment.update({
        where: { id: payment.id },
        data: updateData,
      });

      // Process successful payment
      await this.handleSuccessfulPayment(payment);
    } else {
      // Payment failed
      updateData.status = 'FAILED';

      await prisma.payment.update({
        where: { id: payment.id },
        data: updateData,
      });

      logger.warn('M-Pesa payment failed:', {
        paymentId: payment.id,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      });

      // Notify customer of failed payment
      await prisma.notification.create({
        data: {
          userId: payment.customer.userId,
          type: 'PAYMENT_FAILED',
          title: 'Payment Failed',
          message: `Your M-Pesa payment of KES ${payment.amount} failed: ${ResultDesc}`,
          channel: 'in_app',
        },
      });
    }
  }

  // Handle successful payment
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
              voiceMinutesUsed: 0,
              smsUsed: 0,
            },
          });

          // Create notification
          await prisma.notification.create({
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
      await prisma.notification.create({
        data: {
          userId: payment.customer.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Received',
          message: `Your M-Pesa payment of KES ${payment.amount} has been received successfully.`,
          channel: 'in_app',
        },
      });

      logger.info('Payment processed successfully:', { paymentId: payment.id });
    } catch (error) {
      logger.error('Error processing successful payment:', error);
    }
  }

  // Validate callback signature
  validateCallback(body: any): boolean {
    // In production, validate the callback using the certificate
    // For now, we'll just check if the body has required fields
    return body?.Body?.stkCallback?.MerchantRequestID != null;
  }
}

export const mpesaService = new MpesaService();
export default mpesaService;
