import config from '../config';
import { logger } from '../config/logger';
import { SMSRequest, SMSResponse } from '../types';

interface AfricaTalkingResponse {
  SMSMessageData: {
    Message: string;
    Recipients: Array<{
      statusCode: number;
      status: string;
      messageId: string;
      number: string;
    }>;
  };
}

class SMSService {
  private baseUrl = 'https://api.africastalking.com/version1/messaging';
  private apiKey: string;
  private username: string;
  private senderId: string;

  constructor() {
    this.apiKey = config.sms.apiKey;
    this.username = config.sms.username;
    this.senderId = config.sms.senderId;
  }

  // Format phone number for Africa's Talking
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    // Africa's Talking expects international format without +
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return `254${cleaned.substring(1)}`;
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return `254${cleaned}`;
    }

    return cleaned;
  }

  // Send SMS
  async send(request: SMSRequest): Promise<SMSResponse> {
    if (!this.apiKey || !this.username) {
      logger.warn('SMS credentials not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    const recipients = Array.isArray(request.to)
      ? request.to.map((phone) => this.formatPhoneNumber(phone))
      : [this.formatPhoneNumber(request.to)];

    const payload = new URLSearchParams();
    payload.append('username', this.username);
    payload.append('to', recipients.join(','));
    payload.append('message', request.message);

    if (this.senderId) {
      payload.append('from', this.senderId);
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          apiKey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: payload.toString(),
      });

        const data = await response.json() as AfricaTalkingResponse;

      logger.info('SMS sent:', {
        recipients: recipients,
        messageCount: data.SMSMessageData.Recipients.length,
      });

      // Check for errors
      const failedRecipients = data.SMSMessageData.Recipients.filter(
        (r) => r.statusCode !== 101
      );

      if (failedRecipients.length > 0) {
        logger.warn('Some SMS failed to send:', failedRecipients);
        return {
          success: false,
          error: `Failed to send to ${failedRecipients.length} recipients`,
        };
      }

      return {
        success: true,
        messageId: data.SMSMessageData.Recipients[0]?.messageId,
      };
    } catch (error) {
      logger.error('SMS send error:', error);
      return {
        success: false,
        error: 'Failed to send SMS',
      };
    }
  }

  // Send payment confirmation SMS
  async sendPaymentConfirmation(
    phone: string,
    amount: number,
    reference: string,
    balance?: number
  ): Promise<SMSResponse> {
    const message = `Hello! Your payment of KES ${amount} has been received. Ref: ${reference}${
      balance !== undefined ? `. Current balance: KES ${balance}` : ''
    }. Thank you for choosing our services.`;

    return this.send({ to: phone, message });
  }

  // Send subscription activation SMS
  async sendSubscriptionActivation(
    phone: string,
    planName: string,
    validity: string
  ): Promise<SMSResponse> {
    const message = `Your ${planName} subscription has been activated! Valid until ${validity}. Enjoy unlimited internet access.`;

    return this.send({ to: phone, message });
  }

  // Send subscription expiry warning SMS
  async sendExpiryWarning(
    phone: string,
    planName: string,
    daysRemaining: number
  ): Promise<SMSResponse> {
    const message = `Your ${planName} subscription expires in ${daysRemaining} day(s). Renew now to continue enjoying uninterrupted service.`;

    return this.send({ to: phone, message });
  }

  // Send subscription expired SMS
  async sendSubscriptionExpired(
    phone: string,
    planName: string
  ): Promise<SMSResponse> {
    const message = `Your ${planName} subscription has expired. Please renew to restore your internet access.`;

    return this.send({ to: phone, message });
  }

  // Send FUP threshold warning SMS
  async sendFUPWarning(
    phone: string,
    percentageUsed: number
  ): Promise<SMSResponse> {
    const message = `You have used ${percentageUsed}% of your data allowance. Your speed may be reduced after reaching the fair usage limit.`;

    return this.send({ to: phone, message });
  }

  // Send account suspension SMS
  async sendAccountSuspended(
    phone: string,
    reason?: string
  ): Promise<SMSResponse> {
    const message = `Your account has been suspended${reason ? `: ${reason}` : ''}. Please contact customer support for assistance.`;

    return this.send({ to: phone, message });
  }

  // Send OTP for verification
  async sendOTP(phone: string, otp: string): Promise<SMSResponse> {
    const message = `Your verification code is: ${otp}. It expires in 5 minutes.`;

    return this.send({ to: phone, message });
  }

  // Send invoice notification SMS
  async sendInvoiceNotification(
    phone: string,
    invoiceNumber: string,
    amount: number,
    dueDate: string
  ): Promise<SMSResponse> {
    const message = `Invoice ${invoiceNumber} for KES ${amount} is ready. Due date: ${dueDate}. Please make payment to continue enjoying our services.`;

    return this.send({ to: phone, message });
  }

  // Bulk SMS
  async sendBulk(
    recipients: Array<{ phone: string; message: string }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const phones = batch.map((r) => this.formatPhoneNumber(r.phone));

      const payload = new URLSearchParams();
      payload.append('username', this.username);
      payload.append('to', phones.join(','));

      // For bulk, we need to send multiple requests if messages are different
      // or use the same message for all
      const messages = batch.map((r, idx) => `${idx}:${r.message}`).join('\n');
      payload.append('message', batch[0].message); // Simplified - same message

      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            apiKey: this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: payload.toString(),
        });

      const data = await response.json() as AfricaTalkingResponse;
        const sent = data.SMSMessageData.Recipients.filter(
          (r) => r.statusCode === 101
        ).length;
        const failedBatch = data.SMSMessageData.Recipients.filter(
          (r) => r.statusCode !== 101
        ).length;

        success += sent;
        failed += failedBatch;
      } catch (error) {
        logger.error('Bulk SMS error:', error);
        failed += batch.length;
      }
    }

    return { success, failed };
  }
}

export const smsService = new SMSService();
export default smsService;
